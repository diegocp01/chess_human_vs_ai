"""Stable per-user storage shared by every checkout and Git worktree."""

from __future__ import annotations

import json
import os
import shutil
import sys
import threading
from copy import deepcopy
from pathlib import Path


DATA_DIR_ENV = "KINGSIDE_DATA_DIR"
_MIGRATION_LOCK = threading.Lock()


def default_data_root() -> Path:
    """Return the operating system's persistent data directory for Kingside."""
    configured = os.getenv(DATA_DIR_ENV)
    if configured:
        return Path(configured).expanduser().resolve()

    home = Path.home()
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / "Kingside"
    if os.name == "nt":
        local_app_data = os.getenv("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / "Kingside"
        return home / "AppData" / "Local" / "Kingside"

    xdg_data_home = os.getenv("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home).expanduser() / "kingside"
    return home / ".local" / "share" / "kingside"


def storage_paths(data_root: Path) -> dict[str, Path]:
    """Return every mutable application path below one stable root."""
    return {
        "data_root": data_root,
        "game_log_dir": data_root / "game_logs",
        "trained_model_path": data_root / "trained_ai" / "model.json",
        "player_data_path": data_root / "player_data" / "profiles.json",
    }


def _git_main_worktree(project_root: Path) -> Path | None:
    """Resolve the main checkout when ``project_root`` is a linked worktree."""
    git_marker = project_root / ".git"
    if not git_marker.is_file():
        return None

    try:
        marker = git_marker.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not marker.startswith("gitdir:"):
        return None

    git_dir = Path(marker.removeprefix("gitdir:").strip())
    if not git_dir.is_absolute():
        git_dir = (project_root / git_dir).resolve()

    for parent in (git_dir, *git_dir.parents):
        if parent.name == ".git":
            return parent.parent
    return None


def legacy_project_roots(project_root: Path) -> list[Path]:
    """Return checkout roots that may contain the old repository-local data."""
    candidates = [project_root.resolve()]
    main_worktree = _git_main_worktree(project_root.resolve())
    if main_worktree is not None:
        candidates.append(main_worktree.resolve())

    unique: list[Path] = []
    for candidate in candidates:
        if candidate not in unique:
            unique.append(candidate)
    return unique


def _read_json(path: Path, fallback: dict) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return deepcopy(fallback)
    return payload if isinstance(payload, dict) else deepcopy(fallback)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _profile_identity(profile: dict) -> str:
    return str(
        profile.get("normalized_username")
        or profile.get("username")
        or ""
    ).casefold()


def _merge_profile_store(destination: Path, source: Path) -> int:
    """Merge missing local profiles without duplicating usernames."""
    empty = {
        "schema_version": 2,
        "current_player_id": None,
        "players": {},
        "opponents": {},
    }
    target = _read_json(destination, empty)
    incoming = _read_json(source, empty)
    target_players = target.setdefault("players", {})
    target_opponents = target.setdefault("opponents", {})
    known_names = {
        _profile_identity(profile): player_id
        for player_id, profile in target_players.items()
    }
    imported_ids: dict[str, str] = {}
    changes = 0
    profiles_imported = 0

    for player_id, profile in incoming.get("players", {}).items():
        if not isinstance(profile, dict):
            continue
        identity = _profile_identity(profile)
        existing_id = player_id if player_id in target_players else known_names.get(identity)
        if existing_id is None:
            target_players[player_id] = profile
            known_names[identity] = player_id
            imported_ids[player_id] = player_id
            changes += 1
            profiles_imported += 1
            continue

        imported_ids[player_id] = existing_id
        existing = target_players[existing_id]
        if int(profile.get("games", 0)) > int(existing.get("games", 0)):
            target_players[existing_id] = {**profile, "id": existing_id}
            changes += 1
            profiles_imported += 1

    for opponent_id, opponent in incoming.get("opponents", {}).items():
        if not isinstance(opponent, dict):
            continue
        existing = target_opponents.get(opponent_id)
        if existing is None or int(opponent.get("games", 0)) > int(
            existing.get("games", 0)
        ):
            target_opponents[opponent_id] = opponent
            changes += 1

    current_id = target.get("current_player_id")
    if current_id not in target_players:
        incoming_current = incoming.get("current_player_id")
        target["current_player_id"] = imported_ids.get(incoming_current)
        if target["current_player_id"]:
            changes += 1

    target["schema_version"] = max(
        int(target.get("schema_version", 1)),
        int(incoming.get("schema_version", 1)),
        2,
    )
    if changes or not destination.exists():
        _write_json(destination, target)
    return profiles_imported


def _copy_game_logs(destination: Path, source: Path) -> int:
    if not source.exists():
        return 0
    destination.mkdir(parents=True, exist_ok=True)
    copied = 0
    for source_file in source.glob("*.json"):
        target_file = destination / source_file.name
        if target_file.exists():
            continue
        shutil.copy2(source_file, target_file)
        copied += 1
    return copied


def migrate_legacy_storage(project_root: Path, data_root: Path) -> dict:
    """Import repository-local data into the stable per-user store.

    The operation is additive and idempotent. Existing persistent files win
    unless a matching legacy profile has a longer recorded game history.
    """
    paths = storage_paths(data_root)
    summary = {
        "profiles_imported": 0,
        "game_logs_imported": 0,
        "trained_model_imported": False,
    }

    with _MIGRATION_LOCK:
        for legacy_root in legacy_project_roots(project_root):
            legacy_profiles = legacy_root / "player_data" / "profiles.json"
            if legacy_profiles.exists():
                summary["profiles_imported"] += _merge_profile_store(
                    paths["player_data_path"],
                    legacy_profiles,
                )

            summary["game_logs_imported"] += _copy_game_logs(
                paths["game_log_dir"],
                legacy_root / "game_logs",
            )

            legacy_model = legacy_root / "trained_ai" / "model.json"
            if (
                legacy_model.exists()
                and not paths["trained_model_path"].exists()
            ):
                paths["trained_model_path"].parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )
                shutil.copy2(legacy_model, paths["trained_model_path"])
                summary["trained_model_imported"] = True

        paths["data_root"].mkdir(parents=True, exist_ok=True)
    return summary

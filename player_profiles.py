"""Persistent local player profiles and Elo ratings."""

from __future__ import annotations

import json
import math
import secrets
import threading
from datetime import datetime, timezone
from pathlib import Path


STARTING_ELO = 0
ELO_K_FACTOR = 32
RATING_SCHEMA_VERSION = 2
_STORE_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _empty_store() -> dict:
    return {
        "schema_version": RATING_SCHEMA_VERSION,
        "current_player_id": None,
        "players": {},
        "opponents": {},
    }


def _load_store(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return _empty_store()
    if not isinstance(data.get("players"), dict):
        data["players"] = {}
    if not isinstance(data.get("opponents"), dict):
        data["opponents"] = {}
    migrated = int(data.get("schema_version", 1)) < RATING_SCHEMA_VERSION
    if migrated:
        for profile in data["players"].values():
            if (
                int(profile.get("games", 0)) == 0
                and not profile.get("rating_history")
                and int(profile.get("elo", 1200)) == 1200
            ):
                profile["elo"] = STARTING_ELO
        for opponent in data["opponents"].values():
            if (
                int(opponent.get("games", 0)) == 0
                and int(opponent.get("elo", 1200)) == 1200
            ):
                opponent["elo"] = STARTING_ELO
        data["schema_version"] = RATING_SCHEMA_VERSION
        _save_store(path, data)
    return data


def _save_store(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _validate_username(username: str) -> str:
    value = " ".join(str(username or "").strip().split())
    if not 2 <= len(value) <= 24:
        raise ValueError("Username must be between 2 and 24 characters.")
    if not any(char.isalnum() for char in value):
        raise ValueError("Username must contain at least one letter or number.")
    if any(not (char.isalnum() or char in " _-.") for char in value):
        raise ValueError(
            "Username may use letters, numbers, spaces, periods, hyphens, and underscores."
        )
    return value


def _public_profile(profile: dict) -> dict:
    return {
        "id": profile["id"],
        "username": profile["username"],
        "elo": profile["elo"],
        "games": profile["games"],
        "wins": profile["wins"],
        "losses": profile["losses"],
        "draws": profile["draws"],
        "created_at": profile["created_at"],
        "last_played_at": profile.get("last_played_at"),
    }


def list_players(path: Path) -> dict:
    with _STORE_LOCK:
        data = _load_store(path)
        players = sorted(
            (_public_profile(profile) for profile in data["players"].values()),
            key=lambda profile: (
                profile.get("last_played_at") or profile["created_at"],
                profile["username"].casefold(),
            ),
            reverse=True,
        )
        return {
            "players": players,
            "current_player_id": data.get("current_player_id"),
            "authentication": "local-no-password",
        }


def create_player(path: Path, username: str) -> dict:
    value = _validate_username(username)
    normalized = value.casefold()
    with _STORE_LOCK:
        data = _load_store(path)
        if any(
            profile.get("normalized_username") == normalized
            for profile in data["players"].values()
        ):
            raise ValueError("That username already exists on this computer.")

        slug = "".join(
            char.lower() if char.isalnum() else "-"
            for char in value
        ).strip("-")[:18] or "player"
        player_id = f"{slug}-{secrets.token_hex(3)}"
        created_at = utc_now()
        profile = {
            "id": player_id,
            "username": value,
            "normalized_username": normalized,
            "created_at": created_at,
            "last_played_at": None,
            "elo": STARTING_ELO,
            "games": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "rating_history": [],
        }
        data["players"][player_id] = profile
        data["current_player_id"] = player_id
        _save_store(path, data)
        return _public_profile(profile)


def select_player(path: Path, player_id: str) -> dict:
    with _STORE_LOCK:
        data = _load_store(path)
        profile = data["players"].get(player_id)
        if not profile:
            raise ValueError("Unknown local player profile.")
        data["current_player_id"] = player_id
        _save_store(path, data)
        return _public_profile(profile)


def get_player(path: Path, player_id: str | None = None) -> dict | None:
    with _STORE_LOCK:
        data = _load_store(path)
        resolved_id = player_id or data.get("current_player_id")
        profile = data["players"].get(resolved_id)
        return _public_profile(profile) if profile else None


def _expected_score(rating: int, opponent_rating: int) -> float:
    return 1 / (1 + math.pow(10, (opponent_rating - rating) / 400))


def record_game_result(
    path: Path,
    *,
    game_id: str,
    player_id: str,
    opponent_key: str,
    opponent_provider: str,
    opponent_model: str,
    opponent_name: str,
    human_score: float,
) -> dict:
    """Apply a standard Elo update exactly once for a completed game."""
    if human_score not in {0.0, 0.5, 1.0}:
        raise ValueError("Human score must be 0, 0.5, or 1.")

    with _STORE_LOCK:
        data = _load_store(path)
        player = data["players"].get(player_id)
        if not player:
            raise ValueError("Unknown local player profile.")

        for event in player.get("rating_history", []):
            if event.get("game_id") == game_id:
                return event

        opponent = data["opponents"].setdefault(
            opponent_key,
            {
                "key": opponent_key,
                "provider": opponent_provider,
                "model_id": opponent_model,
                "display_name": opponent_name,
                "elo": STARTING_ELO,
                "games": 0,
                "wins": 0,
                "losses": 0,
                "draws": 0,
            },
        )

        player_before = int(player["elo"])
        opponent_before = int(opponent["elo"])
        expected = _expected_score(player_before, opponent_before)
        delta = round(ELO_K_FACTOR * (human_score - expected))
        player_after = max(0, player_before + delta)
        opponent_after = max(0, opponent_before - delta)
        played_at = utc_now()

        player["elo"] = player_after
        opponent["elo"] = opponent_after
        player["games"] += 1
        opponent["games"] += 1
        player["last_played_at"] = played_at

        if human_score == 1.0:
            player["wins"] += 1
            opponent["losses"] += 1
            result = "win"
        elif human_score == 0.0:
            player["losses"] += 1
            opponent["wins"] += 1
            result = "loss"
        else:
            player["draws"] += 1
            opponent["draws"] += 1
            result = "draw"

        event = {
            "status": "complete",
            "game_id": game_id,
            "rated_at": played_at,
            "result": result,
            "score": human_score,
            "player_id": player_id,
            "player_name": player["username"],
            "rating_before": player_before,
            "rating_after": player_after,
            "rating_delta": player_after - player_before,
            "opponent_key": opponent_key,
            "opponent_name": opponent_name,
            "opponent_rating_before": opponent_before,
            "opponent_rating_after": opponent_after,
            "k_factor": ELO_K_FACTOR,
        }
        player.setdefault("rating_history", []).append(event)
        data["current_player_id"] = player_id
        _save_store(path, data)
        return event

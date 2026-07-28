"""Player-scoped aggregation for the local results dashboard."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _read_game_records(game_log_dir: Path) -> tuple[list[dict], int]:
    records = []
    files_scanned = 0
    if not game_log_dir.exists():
        return records, files_scanned

    for path in sorted(game_log_dir.glob("*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, TypeError):
            continue
        if isinstance(record, dict) and record.get("game_id"):
            files_scanned += 1
            records.append(record)
    return records, files_scanned


def _result_name(record: dict) -> str | None:
    result = record.get("result") or {}
    if result.get("status") == "incomplete" or result.get("outcome") == "incomplete":
        return None
    winner = result.get("winner")
    if winner == "human":
        return "win"
    if winner == "ai":
        return "loss"
    if winner == "draw":
        return "draw"
    return None


def build_results_dashboard(
    game_log_dir: Path,
    player: dict,
) -> dict:
    """Aggregate completed JSON game records for exactly one local player."""
    records, files_scanned = _read_game_records(game_log_dir)
    player_id = player["id"]
    player_records = [
        record
        for record in records
        if (record.get("player") or {}).get("id") == player_id
    ]
    completed_records = [
        record
        for record in player_records
        if record.get("ended_at") and _result_name(record)
    ]
    completed_records.sort(
        key=lambda record: (
            record.get("ended_at") or record.get("started_at") or "",
            record.get("game_id") or "",
        )
    )

    totals = {"win": 0, "loss": 0, "draw": 0}
    cumulative_wins = 0
    total_plies = 0
    timeline = []
    opponent_groups: dict[str, dict] = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
        }
    )

    for game_number, record in enumerate(completed_records, start=1):
        result = _result_name(record)
        totals[result] += 1
        if result == "win":
            cumulative_wins += 1

        moves = record.get("moves") if isinstance(record.get("moves"), list) else []
        move_count = len(moves)
        human_move_count = sum(
            1 for move in moves if isinstance(move, dict) and move.get("actor") == "human"
        )
        total_plies += move_count
        opponent = record.get("opponent") or {}
        rating = record.get("rating_update") or {}
        coach = record.get("coach") or {}
        opponent_name = opponent.get("display_name") or opponent.get("model_id") or "AI"
        opponent_key = (
            f"{opponent.get('provider') or 'unknown'}:"
            f"{opponent.get('model_id') or opponent_name}"
        )
        group = opponent_groups[opponent_key]
        group.update(
            {
                "key": opponent_key,
                "provider": opponent.get("provider") or "unknown",
                "model": opponent_name,
            }
        )
        group["games"] += 1
        group[{"win": "wins", "loss": "losses", "draw": "draws"}[result]] += 1

        timeline.append(
            {
                "game_id": record.get("game_id"),
                "game_number": game_number,
                "played_at": record.get("ended_at") or record.get("started_at"),
                "result": result,
                "cumulative_wins": cumulative_wins,
                "opponent": opponent_name,
                "provider": opponent.get("provider") or "unknown",
                "human_color": record.get("human_color"),
                "move_count": move_count,
                "human_move_count": human_move_count,
                "elo_before": rating.get("rating_before"),
                "elo_after": rating.get("rating_after"),
                "elo_delta": rating.get("rating_delta"),
                "coach_insight": (
                    coach.get("one_line_insight")
                    if coach.get("status") == "complete"
                    else None
                ),
            }
        )

    games = len(timeline)
    win_rate = round((totals["win"] / games) * 100, 1) if games else 0.0
    opponent_breakdown = []
    for group in opponent_groups.values():
        group["win_rate"] = round((group["wins"] / group["games"]) * 100, 1)
        opponent_breakdown.append(group)
    opponent_breakdown.sort(
        key=lambda group: (-group["games"], -group["wins"], group["model"].casefold())
    )

    first_rating = next(
        (item["elo_before"] for item in timeline if item["elo_before"] is not None),
        player.get("elo"),
    )
    current_elo = int(player.get("elo", 0))
    starting_elo = current_elo if first_rating is None else int(first_rating)
    return {
        "player": {
            "id": player_id,
            "username": player["username"],
            "current_elo": current_elo,
        },
        "summary": {
            "games": games,
            "wins": totals["win"],
            "losses": totals["loss"],
            "draws": totals["draw"],
            "win_rate": win_rate,
            "current_elo": current_elo,
            "elo_change": current_elo - starting_elo,
            "total_plies": total_plies,
        },
        "timeline": timeline,
        "opponents": opponent_breakdown,
        "recent_games": list(reversed(timeline[-6:])),
        "source": {
            "kind": "local_game_json",
            "path": "game_logs/*.json",
            "generated_at": _utc_now(),
            "files_scanned": files_scanned,
            "player_records": len(player_records),
            "completed_games": games,
            "unfinished_games": len(player_records) - games,
        },
    }

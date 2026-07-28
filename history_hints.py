"""Private, deterministic hints from a player's own historical positions."""

from __future__ import annotations

import json
from pathlib import Path

import chess

from trained_ai import position_features


MINIMUM_HINT_PLY = 4
MINIMUM_SIMILARITY = 0.74

FEATURE_WEIGHTS = {
    "material_balance": 2.5,
    "own_material": 1.0,
    "opponent_material": 1.0,
    "game_phase": 1.8,
    "mobility": 0.7,
    "in_check": 3.0,
    "own_castling": 1.2,
    "opponent_castling": 0.8,
    "center_balance": 1.4,
    "move_phase": 1.0,
}


def _oriented_square(square: chess.Square, human_color: chess.Color) -> chess.Square:
    """Orient both colors as if the human pieces were playing up the board."""
    if human_color == chess.WHITE:
        return square
    return chess.square(
        7 - chess.square_file(square),
        7 - chess.square_rank(square),
    )


def _placement_tokens(
    board: chess.Board,
    human_color: chess.Color,
) -> set[tuple[str, int, int]]:
    tokens = set()
    for square, piece in board.piece_map().items():
        owner = "human" if piece.color == human_color else "opponent"
        tokens.add((owner, piece.piece_type, _oriented_square(square, human_color)))
    return tokens


def _placement_similarity(
    current_board: chess.Board,
    current_human_color: chess.Color,
    historic_board: chess.Board,
    historic_human_color: chess.Color,
) -> float:
    current = _placement_tokens(current_board, current_human_color)
    historic = _placement_tokens(historic_board, historic_human_color)
    union = current | historic
    return len(current & historic) / len(union) if union else 1.0


def _feature_similarity(current_board: chess.Board, historic_board: chess.Board) -> float:
    current = position_features(current_board)
    historic = position_features(historic_board)
    weighted_distance = sum(
        weight * abs(float(current.get(field, 0)) - float(historic.get(field, 0)))
        for field, weight in FEATURE_WEIGHTS.items()
    )
    return max(0.0, 1.0 - (weighted_distance / sum(FEATURE_WEIGHTS.values())))


def position_similarity(
    current_board: chess.Board,
    current_human_color: chess.Color,
    historic_board: chess.Board,
    historic_human_color: chess.Color,
) -> float:
    """Compare board structure and tactical features from the human perspective."""
    placement = _placement_similarity(
        current_board,
        current_human_color,
        historic_board,
        historic_human_color,
    )
    features = _feature_similarity(current_board, historic_board)
    return (placement * 0.78) + (features * 0.22)


def _load_record(path: Path) -> dict | None:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return None
    return record if isinstance(record, dict) else None


def find_history_hint(
    *,
    board: chess.Board,
    human_color: str,
    player_id: str,
    current_game_id: str,
    current_ply: int,
    game_log_dir: Path,
    minimum_similarity: float = MINIMUM_SIMILARITY,
) -> dict | None:
    """Return the strongest prior human-position match, if it is meaningful."""
    if current_ply < MINIMUM_HINT_PLY or board.is_game_over(claim_draw=True):
        return None
    if human_color not in {"white", "black"}:
        return None

    current_human_color = human_color == "white"
    best_match = None

    for path in sorted(game_log_dir.glob("*.json")) if game_log_dir.exists() else []:
        record = _load_record(path)
        if not record or record.get("game_id") == current_game_id:
            continue
        if (record.get("player") or {}).get("id") != player_id:
            continue

        coach = record.get("coach") or {}
        strategy = coach.get("tactic_used")
        if coach.get("status") != "complete" or not strategy:
            continue

        historic_color_name = record.get("human_color")
        if historic_color_name not in {"white", "black"}:
            continue
        historic_human_color = historic_color_name == "white"
        historic_board = chess.Board()

        for move_record in record.get("moves") or []:
            if (
                move_record.get("actor") == "human"
                and historic_board.turn == historic_human_color
            ):
                similarity = position_similarity(
                    board,
                    current_human_color,
                    historic_board,
                    historic_human_color,
                )
                if similarity >= minimum_similarity:
                    try:
                        historic_move = chess.Move.from_uci(move_record.get("uci", ""))
                        san = move_record.get("san") or historic_board.san(historic_move)
                    except (TypeError, ValueError):
                        san = move_record.get("san") or move_record.get("uci")

                    candidate = {
                        "similarity": round(similarity, 4),
                        "strategy": strategy,
                        "move": san,
                        "source_game_id": record.get("game_id"),
                        "played_at": record.get("started_at"),
                        "opponent": (record.get("opponent") or {}).get("display_name"),
                        "result": (record.get("result") or {}).get("winner"),
                    }
                    if (
                        best_match is None
                        or candidate["similarity"] > best_match["similarity"]
                        or (
                            candidate["similarity"] == best_match["similarity"]
                            and str(candidate.get("played_at") or "")
                            > str(best_match.get("played_at") or "")
                        )
                    ):
                        best_match = candidate

            try:
                move = chess.Move.from_uci(move_record.get("uci", ""))
            except (TypeError, ValueError):
                break
            if move not in historic_board.legal_moves:
                break
            historic_board.push(move)

    return best_match

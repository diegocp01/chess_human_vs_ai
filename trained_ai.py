"""Local outcome-weighted chess policy trained from historical AI moves."""

from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import chess


STRATEGY_NAMES = (
    "tactical_attack",
    "center_control",
    "piece_development",
    "king_safety",
    "positional_pressure",
    "defense",
    "simplification",
    "pawn_play",
    "endgame_conversion",
    "forcing_mate",
)

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}

CENTER_SQUARES = {chess.D4, chess.D5, chess.E4, chess.E5}

LINEAR_FEATURE_NAMES = (
    "position_material_balance",
    "position_game_phase",
    "position_mobility",
    "position_in_check",
    "position_castling",
    "position_center_balance",
    "position_move_phase",
    "move_capture_value",
    "move_gives_check",
    "move_gives_mate",
    "move_castles",
    "move_promotes",
    "move_enters_center",
    "move_develops_minor",
    "move_piece_value",
    "move_restricts_reply",
    "move_material_balance",
    *(f"strategy_{strategy}" for strategy in STRATEGY_NAMES),
)

VALUE_FEATURE_NAMES = (
    "ai_material_balance",
    "ai_material",
    "opponent_material",
    "game_phase",
    "ai_castling",
    "opponent_castling",
    "center_balance",
    "ai_to_move",
    "ai_in_check",
    "opponent_in_check",
    "move_phase",
)

FEATURE_LABELS = {
    "position_material_balance": "material balance",
    "position_game_phase": "game phase",
    "position_mobility": "available mobility",
    "position_in_check": "check pressure",
    "position_castling": "castling rights",
    "position_center_balance": "center control",
    "position_move_phase": "move phase",
    "move_capture_value": "capture value",
    "move_gives_check": "forcing check",
    "move_gives_mate": "checkmate pattern",
    "move_castles": "king safety",
    "move_promotes": "promotion chance",
    "move_enters_center": "central square",
    "move_develops_minor": "piece development",
    "move_piece_value": "piece commitment",
    "move_restricts_reply": "opponent restriction",
    "move_material_balance": "resulting material",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def position_key(board: chess.Board) -> str:
    """Use the rule-relevant FEN fields while ignoring clock counters."""
    return " ".join(board.fen().split()[:4])


def _material(board: chess.Board, color: chess.Color) -> int:
    return sum(
        len(board.pieces(piece_type, color)) * value
        for piece_type, value in PIECE_VALUES.items()
    )


def _center_control(board: chess.Board, color: chess.Color) -> int:
    return sum(len(board.attackers(color, square)) for square in CENTER_SQUARES)


def position_features(board: chess.Board) -> dict[str, float]:
    """Describe a position from the side-to-move perspective."""
    side = board.turn
    opponent = not side
    own_material = _material(board, side)
    opponent_material = _material(board, opponent)
    non_pawn_material = sum(
        len(board.pieces(piece_type, color)) * PIECE_VALUES[piece_type]
        for piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for color in (chess.WHITE, chess.BLACK)
    )

    return {
        "material_balance": round((own_material - opponent_material) / 39, 4),
        "own_material": round(own_material / 39, 4),
        "opponent_material": round(opponent_material / 39, 4),
        "game_phase": round(non_pawn_material / 62, 4),
        "mobility": round(min(board.legal_moves.count(), 40) / 40, 4),
        "in_check": 1.0 if board.is_check() else 0.0,
        "own_castling": 1.0 if (
            board.has_kingside_castling_rights(side)
            or board.has_queenside_castling_rights(side)
        ) else 0.0,
        "opponent_castling": 1.0 if (
            board.has_kingside_castling_rights(opponent)
            or board.has_queenside_castling_rights(opponent)
        ) else 0.0,
        "center_balance": round(
            (_center_control(board, side) - _center_control(board, opponent)) / 16,
            4,
        ),
        "move_phase": round(min(board.fullmove_number, 60) / 60, 4),
    }


def _ai_outcome_score(record: dict) -> float:
    winner = (record.get("result") or {}).get("winner")
    if winner == "ai":
        return 1.0
    if winner == "draw":
        return 0.5
    return 0.0


def _capture_value(board: chess.Board, move: chess.Move) -> int:
    if not board.is_capture(move):
        return 0
    captured_square = move.to_square
    if board.is_en_passant(move):
        captured_square += -8 if board.turn == chess.WHITE else 8
    piece = board.piece_at(captured_square)
    return PIECE_VALUES.get(piece.piece_type, 0) if piece else 0


def _infer_strategy(board: chess.Board, move: chess.Move) -> str:
    """Create a local strategy label when the optional Coach label is absent."""
    piece = board.piece_at(move.from_square)
    capture_value = _capture_value(board, move)
    from_home_rank = chess.square_rank(move.from_square) in (0, 7)

    next_board = board.copy(stack=False)
    next_board.push(move)
    if next_board.is_checkmate():
        return "forcing_mate"
    if board.is_check():
        return "defense"
    if board.is_castling(move):
        return "king_safety"
    if move.promotion:
        return "endgame_conversion"
    if capture_value >= 3 or next_board.is_check():
        return "tactical_attack"
    if (
        piece
        and piece.piece_type in (chess.KNIGHT, chess.BISHOP)
        and from_home_rank
    ):
        return "piece_development"
    if move.to_square in CENTER_SQUARES:
        return "center_control"
    if piece and piece.piece_type == chess.PAWN:
        return "pawn_play"
    if capture_value and _material(board, board.turn) >= _material(board, not board.turn):
        return "simplification"
    if sum(len(board.pieces(kind, color)) for kind in PIECE_VALUES for color in (True, False)) <= 12:
        return "endgame_conversion"
    return "positional_pressure"


def _move_features(
    board: chess.Board,
    move: chess.Move,
    strategy: str | None = None,
) -> dict[str, float]:
    actor = board.turn
    piece = board.piece_at(move.from_square)
    base = position_features(board)
    strategy = strategy if strategy in STRATEGY_NAMES else _infer_strategy(board, move)
    from_home_rank = chess.square_rank(move.from_square) in (0, 7)
    develops_minor = bool(
        piece
        and piece.piece_type in (chess.KNIGHT, chess.BISHOP)
        and from_home_rank
    )

    next_board = board.copy(stack=False)
    next_board.push(move)
    reply_mobility = min(next_board.legal_moves.count(), 40) / 40
    features = {
        "position_material_balance": base["material_balance"],
        "position_game_phase": base["game_phase"],
        "position_mobility": base["mobility"],
        "position_in_check": base["in_check"],
        "position_castling": base["own_castling"],
        "position_center_balance": base["center_balance"],
        "position_move_phase": base["move_phase"],
        "move_capture_value": _capture_value(board, move) / 9,
        "move_gives_check": 1.0 if next_board.is_check() else 0.0,
        "move_gives_mate": 1.0 if next_board.is_checkmate() else 0.0,
        "move_castles": 1.0 if board.is_castling(move) else 0.0,
        "move_promotes": 1.0 if move.promotion else 0.0,
        "move_enters_center": 1.0 if move.to_square in CENTER_SQUARES else 0.0,
        "move_develops_minor": 1.0 if develops_minor else 0.0,
        "move_piece_value": PIECE_VALUES.get(piece.piece_type, 0) / 9 if piece else 0.0,
        "move_restricts_reply": 1.0 - reply_mobility,
        "move_material_balance": (
            _material(next_board, actor) - _material(next_board, not actor)
        ) / 39,
    }
    for name in STRATEGY_NAMES:
        features[f"strategy_{name}"] = 1.0 if name == strategy else 0.0
    return {name: round(float(features.get(name, 0)), 5) for name in LINEAR_FEATURE_NAMES}


def _value_features(
    board: chess.Board,
    ai_color: chess.Color,
) -> dict[str, float]:
    """Describe the whole position from the historical AI's perspective."""
    opponent = not ai_color
    ai_material = _material(board, ai_color)
    opponent_material = _material(board, opponent)
    non_pawn_material = sum(
        len(board.pieces(piece_type, color)) * PIECE_VALUES[piece_type]
        for piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for color in (chess.WHITE, chess.BLACK)
    )
    side_in_check = board.is_check()
    features = {
        "ai_material_balance": (ai_material - opponent_material) / 39,
        "ai_material": ai_material / 39,
        "opponent_material": opponent_material / 39,
        "game_phase": non_pawn_material / 62,
        "ai_castling": 1.0 if (
            board.has_kingside_castling_rights(ai_color)
            or board.has_queenside_castling_rights(ai_color)
        ) else 0.0,
        "opponent_castling": 1.0 if (
            board.has_kingside_castling_rights(opponent)
            or board.has_queenside_castling_rights(opponent)
        ) else 0.0,
        "center_balance": (
            _center_control(board, ai_color) - _center_control(board, opponent)
        ) / 16,
        "ai_to_move": 1.0 if board.turn == ai_color else 0.0,
        "ai_in_check": 1.0 if side_in_check and board.turn == ai_color else 0.0,
        "opponent_in_check": 1.0 if side_in_check and board.turn == opponent else 0.0,
        "move_phase": min(board.fullmove_number, 60) / 60,
    }
    return {name: round(float(features[name]), 5) for name in VALUE_FEATURE_NAMES}


def _sigmoid(value: float) -> float:
    value = max(-20.0, min(20.0, value))
    return 1.0 / (1.0 + math.exp(-value))


def _train_linear_policy(examples: list[dict]) -> dict:
    """Fit a tiny deterministic logistic policy with no external ML dependency."""
    weights = {name: 0.0 for name in LINEAR_FEATURE_NAMES}
    intercept = 0.0
    epochs = 180
    base_rate = 0.085
    l2 = 0.012

    if examples:
        for epoch in range(epochs):
            rate = base_rate / (1.0 + epoch * 0.018)
            for example in examples:
                features = example["move_features"]
                target = float(example["outcome"])
                score = intercept + sum(
                    weights[name] * float(features.get(name, 0))
                    for name in LINEAR_FEATURE_NAMES
                )
                error = _sigmoid(score) - target
                outcome_weight = 0.75 + abs(target - 0.5)
                intercept -= rate * error * outcome_weight
                for name in LINEAR_FEATURE_NAMES:
                    value = float(features.get(name, 0))
                    weights[name] -= rate * (
                        error * value * outcome_weight + l2 * weights[name]
                    )

    loss = 0.0
    for example in examples:
        target = float(example["outcome"])
        probability = _sigmoid(
            intercept
            + sum(
                weights[name] * float(example["move_features"].get(name, 0))
                for name in LINEAR_FEATURE_NAMES
            )
        )
        loss += -(target * math.log(max(probability, 1e-8))) - (
            (1.0 - target) * math.log(max(1.0 - probability, 1e-8))
        )

    return {
        "type": "outcome_weighted_linear_policy",
        "feature_names": list(LINEAR_FEATURE_NAMES),
        "weights": {name: round(value, 7) for name, value in weights.items()},
        "intercept": round(intercept, 7),
        "epochs": epochs,
        "learning_rate": base_rate,
        "l2": l2,
        "training_loss": round(loss / len(examples), 6) if examples else None,
    }


def _train_value_policy(examples: list[dict]) -> dict:
    """Learn the probability that the AI eventually wins from any board state."""
    weights = {name: 0.0 for name in VALUE_FEATURE_NAMES}
    intercept = 0.0
    epochs = 180
    base_rate = 0.08
    l2 = 0.012

    if examples:
        for epoch in range(epochs):
            rate = base_rate / (1.0 + epoch * 0.018)
            for example in examples:
                features = example["features"]
                target = float(example["outcome"])
                score = intercept + sum(
                    weights[name] * float(features.get(name, 0))
                    for name in VALUE_FEATURE_NAMES
                )
                error = _sigmoid(score) - target
                outcome_weight = 0.75 + abs(target - 0.5)
                intercept -= rate * error * outcome_weight
                for name in VALUE_FEATURE_NAMES:
                    value = float(features.get(name, 0))
                    weights[name] -= rate * (
                        error * value * outcome_weight + l2 * weights[name]
                    )

    loss = 0.0
    for example in examples:
        target = float(example["outcome"])
        probability = _sigmoid(
            intercept
            + sum(
                weights[name] * float(example["features"].get(name, 0))
                for name in VALUE_FEATURE_NAMES
            )
        )
        loss += -(target * math.log(max(probability, 1e-8))) - (
            (1.0 - target) * math.log(max(1.0 - probability, 1e-8))
        )

    return {
        "type": "ai_win_probability_linear_value_model",
        "feature_names": list(VALUE_FEATURE_NAMES),
        "weights": {name: round(value, 7) for name, value in weights.items()},
        "intercept": round(intercept, 7),
        "epochs": epochs,
        "learning_rate": base_rate,
        "l2": l2,
        "training_loss": round(loss / len(examples), 6) if examples else None,
    }


def rebuild_trained_model(game_log_dir: Path, model_path: Path) -> dict:
    """Rebuild exact memory and a small learned policy from completed game logs."""
    samples = []
    exact_positions: dict[str, dict] = {}
    exact_position_values: dict[str, dict] = {}
    value_samples = []
    strategy_stats = defaultdict(lambda: {"samples": 0, "success_score": 0.0})
    processed_game_ids = []
    outcomes = {"wins": 0, "draws": 0, "losses": 0}
    paths = sorted(game_log_dir.glob("*.json")) if game_log_dir.exists() else []

    for path in paths:
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, TypeError):
            continue

        winner = (record.get("result") or {}).get("winner")
        if winner not in {"ai", "human", "draw"}:
            continue

        labels = ((record.get("trained_ai_analysis") or {}).get("move_labels") or [])
        labels_by_ply = {
            int(label["ply"]): label["strategy"]
            for label in labels
            if (
                isinstance(label, dict)
                and str(label.get("ply", "")).isdigit()
                and label.get("strategy") in STRATEGY_NAMES
            )
        }
        board = chess.Board()
        outcome = _ai_outcome_score(record)
        game_id = record.get("game_id") or path.stem
        ai_color_name = record.get("ai_color")
        if ai_color_name not in {"white", "black"}:
            ai_color_name = next(
                (
                    (
                        move_record.get("color")
                        if move_record.get("color") in {"white", "black"}
                        else "white"
                        if int(move_record.get("ply", 0)) % 2 == 1
                        else "black"
                    )
                    for move_record in record.get("moves", [])
                    if move_record.get("actor") == "ai"
                    and str(move_record.get("ply", "")).isdigit()
                ),
                None,
            )
        if ai_color_name not in {"white", "black"}:
            continue
        ai_color = chess.WHITE if ai_color_name == "white" else chess.BLACK
        used_sample = False

        def remember_position(ply: int) -> None:
            value_key = f"{ai_color_name}|{position_key(board)}"
            value_samples.append({
                "game_id": game_id,
                "ply": ply,
                "features": _value_features(board, ai_color),
                "outcome": outcome,
            })
            entry = exact_position_values.setdefault(
                value_key,
                {"samples": 0, "success_score": 0.0},
            )
            entry["samples"] += 1
            entry["success_score"] += outcome

        remember_position(0)

        for move_record in record.get("moves", []):
            try:
                ply = int(move_record.get("ply"))
                move = chess.Move.from_uci(move_record.get("uci", ""))
            except (TypeError, ValueError):
                continue
            if move not in board.legal_moves:
                break

            if move_record.get("actor") == "ai":
                strategy = labels_by_ply.get(ply) or _infer_strategy(board, move)
                key = position_key(board)
                sample = {
                    "game_id": game_id,
                    "ply": ply,
                    "features": position_features(board),
                    "move_features": _move_features(board, move, strategy),
                    "strategy": strategy,
                    "strategy_source": "coach" if ply in labels_by_ply else "local",
                    "move_uci": move.uci(),
                    "outcome": outcome,
                }
                samples.append(sample)
                used_sample = True

                position_entry = exact_positions.setdefault(
                    key,
                    {"samples": 0, "moves": {}},
                )
                position_entry["samples"] += 1
                move_entry = position_entry["moves"].setdefault(
                    move.uci(),
                    {"samples": 0, "success_score": 0.0, "strategies": {}},
                )
                move_entry["samples"] += 1
                move_entry["success_score"] += outcome
                move_entry["strategies"][strategy] = (
                    move_entry["strategies"].get(strategy, 0) + 1
                )
                strategy_stats[strategy]["samples"] += 1
                strategy_stats[strategy]["success_score"] += outcome

            board.push(move)
            remember_position(ply)

        if used_sample:
            processed_game_ids.append(game_id)
            outcomes[
                "wins" if winner == "ai" else "draws" if winner == "draw" else "losses"
            ] += 1

    for position_entry in exact_positions.values():
        for move_entry in position_entry["moves"].values():
            move_entry["success_score"] = round(move_entry["success_score"], 4)
            move_entry["success_probability"] = round(
                (move_entry["success_score"] + 1) / (move_entry["samples"] + 2),
                4,
            )

    for value_entry in exact_position_values.values():
        value_entry["success_score"] = round(value_entry["success_score"], 4)
        value_entry["win_probability"] = round(
            (value_entry["success_score"] + 1) / (value_entry["samples"] + 2),
            4,
        )

    strategy_totals = {}
    for strategy in STRATEGY_NAMES:
        stats = strategy_stats[strategy]
        strategy_totals[strategy] = {
            "samples": stats["samples"],
            "success_score": round(stats["success_score"], 4),
            "success_probability": round(
                (stats["success_score"] + 1) / (stats["samples"] + 2),
                4,
            ),
        }

    model = {
        "schema_version": 3,
        "generated_at": utc_now(),
        "model_type": "outcome_weighted_linear_policy",
        "description": (
            "Local chess policy trained from historical AI-authored moves and final "
            "game outcomes. Human moves are replayed only to reconstruct positions."
        ),
        "games_processed": len(processed_game_ids),
        "processed_game_ids": processed_game_ids,
        "game_outcomes": outcomes,
        "positions_seen": len(samples),
        "value_positions_seen": len(value_samples),
        "strategies_known": sum(
            1 for stats in strategy_totals.values() if stats["samples"] > 0
        ),
        "strategy_totals": strategy_totals,
        "exact_positions": exact_positions,
        "exact_position_values": exact_position_values,
        "linear_policy": _train_linear_policy(samples),
        "value_policy": _train_value_policy(value_samples),
        "samples": samples,
        "value_samples": value_samples,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = model_path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(model, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(model_path)
    return model


def load_trained_model(model_path: Path) -> dict:
    try:
        return json.loads(model_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return {
            "schema_version": 3,
            "model_type": "outcome_weighted_linear_policy",
            "games_processed": 0,
            "positions_seen": 0,
            "value_positions_seen": 0,
            "strategies_known": 0,
            "game_outcomes": {"wins": 0, "draws": 0, "losses": 0},
            "exact_positions": {},
            "exact_position_values": {},
            "samples": [],
            "strategy_totals": {},
            "linear_policy": _train_linear_policy([]),
            "value_policy": _train_value_policy([]),
            "value_samples": [],
        }


def trained_model_summary(model_path: Path) -> dict:
    model = load_trained_model(model_path)
    return {
        "model_type": model.get("model_type", "outcome_weighted_linear_policy"),
        "games_processed": int(model.get("games_processed", 0)),
        "positions_seen": int(model.get("positions_seen", 0)),
        "value_positions_seen": int(model.get("value_positions_seen", 0)),
        "strategies_known": int(model.get("strategies_known", 0)),
        "feature_count": len((model.get("linear_policy") or {}).get("feature_names", [])),
        "game_outcomes": model.get("game_outcomes") or {},
        "generated_at": model.get("generated_at"),
    }


def predict_trained_win_probability(
    board: chess.Board,
    ai_color: str | chess.Color,
    model_path: Path,
) -> dict:
    """Estimate the trained opponent's chance of winning the current position."""
    color = (
        chess.WHITE
        if ai_color in {"white", chess.WHITE}
        else chess.BLACK
    )
    return _predict_win_probability_from_model(
        board,
        color,
        load_trained_model(model_path),
    )


def _predict_win_probability_from_model(
    board: chess.Board,
    color: chess.Color,
    model: dict,
) -> dict:
    """Evaluate one board with an already-loaded local value model."""
    color_name = "white" if color == chess.WHITE else "black"
    ply = board.ply()

    if board.is_game_over(claim_draw=True):
        outcome = board.outcome(claim_draw=True)
        probability = (
            0.5
            if not outcome or outcome.winner is None
            else 1.0 if outcome.winner == color else 0.0
        )
        return {
            "win_probability": probability,
            "source": "final_result",
            "samples": 1,
            "positions_seen": 0,
            "ply": ply,
            "factors": [],
            "explanation": "The board is final, so the forecast equals the result.",
        }

    value_positions_seen = int(model.get("value_positions_seen", 0))
    value_key = f"{color_name}|{position_key(board)}"
    exact = (model.get("exact_position_values") or {}).get(value_key)
    if exact:
        probability = float(exact.get("win_probability", 0.5))
        samples = int(exact.get("samples", 0))
        return {
            "win_probability": round(probability, 4),
            "source": "exact_position_value",
            "samples": samples,
            "positions_seen": value_positions_seen,
            "ply": ply,
            "factors": [],
            "explanation": (
                f"Exact position value from {samples} completed-game sample"
                f"{'' if samples == 1 else 's'}."
            ),
        }

    policy = model.get("value_policy") or {}
    weights = policy.get("weights") or {}
    if value_positions_seen and weights:
        features = _value_features(board, color)
        score = float(policy.get("intercept", 0)) + sum(
            float(weights.get(name, 0)) * value
            for name, value in features.items()
        )
        probability = max(0.02, min(0.98, _sigmoid(score)))
        contributions = sorted(
            (
                (name, float(weights.get(name, 0)) * value)
                for name, value in features.items()
                if value
            ),
            key=lambda item: abs(item[1]),
            reverse=True,
        )[:3]
        factors = [
            {
                "label": name.replace("_", " "),
                "effect": "raises" if value >= 0 else "lowers",
                "weight": round(value, 4),
            }
            for name, value in contributions
        ]
        return {
            "win_probability": round(probability, 4),
            "source": "learned_value_model",
            "samples": value_positions_seen,
            "positions_seen": value_positions_seen,
            "ply": ply,
            "factors": factors,
            "explanation": (
                f"Learned position value from {value_positions_seen} historical "
                "board states and their final outcomes."
            ),
        }

    return {
        "win_probability": 0.5,
        "source": "untrained_baseline",
        "samples": 0,
        "positions_seen": 0,
        "ply": ply,
        "factors": [],
        "explanation": "No completed-game position data yet; forecast starts at 50%.",
    }


def _move_score(board: chess.Board, move: chess.Move, strategy: str) -> float:
    """Small cold-start safety heuristic used only before any model is trained."""
    actor = board.turn
    piece = board.piece_at(move.from_square)
    next_board = board.copy(stack=False)
    next_board.push(move)
    capture_value = _capture_value(board, move)
    from_home_rank = chess.square_rank(move.from_square) in (0, 7)
    develops_minor = bool(
        piece
        and piece.piece_type in (chess.KNIGHT, chess.BISHOP)
        and from_home_rank
    )
    score = capture_value * 1.8
    score += 1000 if next_board.is_checkmate() else 0
    score += 1.2 if next_board.is_check() else 0
    score += 0.8 if board.is_castling(move) else 0
    score += 0.4 if develops_minor else 0
    score += 0.35 if move.to_square in CENTER_SQUARES else 0
    score += 8 if move.promotion == chess.QUEEN else 0
    if strategy == "piece_development" and develops_minor:
        score += 3
    return score


def _predict_move(model: dict, board: chess.Board, move: chess.Move) -> dict:
    strategy = _infer_strategy(board, move)
    features = _move_features(board, move, strategy)
    policy = model.get("linear_policy") or {}
    weights = policy.get("weights") or {}
    score = float(policy.get("intercept", 0)) + sum(
        float(weights.get(name, 0)) * value for name, value in features.items()
    )
    probability = _sigmoid(score)
    contributions = sorted(
        (
            (name, float(weights.get(name, 0)) * value)
            for name, value in features.items()
            if value
        ),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:3]
    factors = [
        {
            "label": (
                name.removeprefix("strategy_").replace("_", " ")
                if name.startswith("strategy_")
                else FEATURE_LABELS.get(name, name.replace("_", " "))
            ),
            "effect": "supports" if value >= 0 else "reduces",
            "weight": round(value, 4),
        }
        for name, value in contributions
    ]
    return {
        "move": move,
        "move_uci": move.uci(),
        "strategy": strategy,
        "probability": probability,
        "factors": factors,
    }


def _base_decision_metadata(model: dict, legal_count: int) -> dict:
    return {
        "model_type": model.get("model_type", "outcome_weighted_linear_policy"),
        "games_processed": int(model.get("games_processed", 0)),
        "positions_seen": int(model.get("positions_seen", 0)),
        "strategies_known": int(model.get("strategies_known", 0)),
        "candidate_count": legal_count,
    }


def choose_trained_move(
    board: chess.Board,
    model_path: Path,
) -> tuple[str, str, dict]:
    """Choose from exact AI memory, then the learned policy, then cold-start safety."""
    legal_moves = sorted(board.legal_moves, key=lambda move: move.uci())
    if not legal_moves:
        raise RuntimeError("Trained AI has no legal moves.")

    model = load_trained_model(model_path)
    metadata = _base_decision_metadata(model, len(legal_moves))

    key = position_key(board)
    exact_entry = (model.get("exact_positions") or {}).get(key)
    if exact_entry:
        candidates = []
        for move in legal_moves:
            stats = (exact_entry.get("moves") or {}).get(move.uci())
            if not stats:
                continue
            strategy_counts = stats.get("strategies") or {}
            strategy = max(
                strategy_counts,
                key=lambda name: (strategy_counts[name], name),
                default="positional_pressure",
            )
            candidates.append({
                "move": move,
                "move_uci": move.uci(),
                "strategy": strategy,
                "probability": float(stats.get("success_probability", 0.5)),
                "samples": int(stats.get("samples", 0)),
            })
        if candidates:
            candidates.sort(
                key=lambda item: (
                    item["probability"],
                    item["samples"],
                    item["move_uci"],
                ),
                reverse=True,
            )
            selected = candidates[0]
            metadata.update({
                "match_type": "exact",
                "strategy": selected["strategy"],
                "success_probability": round(selected["probability"], 4),
                "samples": selected["samples"],
                "selected_move": selected["move_uci"],
                "candidate_moves": [
                    {
                        "move": item["move_uci"],
                        "probability": round(item["probability"], 4),
                        "strategy": item["strategy"],
                        "samples": item["samples"],
                    }
                    for item in candidates[:3]
                ],
                "decision_path": [
                    {
                        "label": "Exact position memory",
                        "status": "selected",
                        "detail": f"Matched {exact_entry.get('samples', 0)} earlier AI decision(s).",
                    },
                    {
                        "label": "Outcome-weighted linear policy",
                        "status": "skipped",
                        "detail": "Exact memory has priority.",
                    },
                    {
                        "label": "Cold-start safety",
                        "status": "skipped",
                        "detail": "A learned decision was available.",
                    },
                ],
            })
            reasoning = (
                f"Trained AI remembered this exact position and replayed the strongest "
                f"historical AI decision. Strategy: {selected['strategy'].replace('_', ' ')} "
                f"· {round(selected['probability'] * 100)}% outcome estimate from "
                f"{selected['samples']} sample{'' if selected['samples'] == 1 else 's'}."
            )
            return selected["move_uci"], reasoning, metadata

    if int(model.get("positions_seen", 0)) > 0:
        candidates = [_predict_move(model, board, move) for move in legal_moves]
        candidates.sort(
            key=lambda item: (
                item["probability"],
                item["move_uci"],
            ),
            reverse=True,
        )
        selected = candidates[0]
        metadata.update({
            "match_type": "linear",
            "strategy": selected["strategy"],
            "success_probability": round(selected["probability"], 4),
            "samples": int(model.get("positions_seen", 0)),
            "selected_move": selected["move_uci"],
            "candidate_moves": [
                {
                    "move": item["move_uci"],
                    "probability": round(item["probability"], 4),
                    "strategy": item["strategy"],
                    "factors": item["factors"],
                }
                for item in candidates[:3]
            ],
            "decision_path": [
                {
                    "label": "Exact position memory",
                    "status": "missed",
                    "detail": "This precise position was not in the dataset.",
                },
                {
                    "label": "Outcome-weighted linear policy",
                    "status": "selected",
                    "detail": (
                        f"Scored {len(legal_moves)} legal moves using "
                        f"{model.get('positions_seen', 0)} prior AI decisions."
                    ),
                },
                {
                    "label": "Cold-start safety",
                    "status": "skipped",
                    "detail": "The learned policy had enough data to decide.",
                },
            ],
        })
        reasoning = (
            f"Trained AI had no exact memory, so its outcome-weighted linear policy "
            f"ranked {len(legal_moves)} legal moves from {model.get('positions_seen', 0)} "
            f"earlier AI decisions. Selected {selected['move_uci']} as "
            f"{selected['strategy'].replace('_', ' ')} at "
            f"{round(selected['probability'] * 100)}%."
        )
        return selected["move_uci"], reasoning, metadata

    strategy = "piece_development"
    move = max(
        legal_moves,
        key=lambda candidate: (
            _move_score(board, candidate, strategy),
            candidate.uci(),
        ),
    )
    metadata.update({
        "match_type": "fallback",
        "strategy": strategy,
        "success_probability": None,
        "samples": 0,
        "selected_move": move.uci(),
        "candidate_moves": [],
        "decision_path": [
            {
                "label": "Exact position memory",
                "status": "missed",
                "detail": "No completed game data exists yet.",
            },
            {
                "label": "Outcome-weighted linear policy",
                "status": "skipped",
                "detail": "The first training samples arrive after a completed game.",
            },
            {
                "label": "Cold-start safety",
                "status": "selected",
                "detail": "Used a deterministic legal development move.",
            },
        ],
    })
    reasoning = (
        "Trained AI has no completed-game samples yet, so it used a minimal local "
        "development and safety fallback. No SDK or API call."
    )
    return move.uci(), reasoning, metadata

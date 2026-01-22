import json
import time
import logging
import anthropic
from openai import OpenAI
from pydantic import BaseModel
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

# Initialize clients
anthropic_client = anthropic.Anthropic()
openai_client = OpenAI()


# OpenAI structured response
class ChessMoveAnswer(BaseModel):
    move: str  # UCI format like "e2e4" or "g1f3"


# Anthropic JSON schema
CHESS_MOVE_SCHEMA = {
    "type": "object",
    "properties": {
        "move": {
            "type": "string",
            "description": "Chess move in UCI format (e.g., 'e2e4', 'g1f3', 'e7e8q' for promotion)"
        }
    },
    "required": ["move"],
    "additionalProperties": False
}


CHESS_SYSTEM_PROMPT = """You are a chess engine playing as Black against a human player (White).

BOARD NOTATION:
- Columns are labeled a-h (left to right from White's perspective)
- Rows are labeled 1-8 (bottom to top from White's perspective)
- Each square is identified by column+row (e.g., e4, d7)

PIECE SYMBOLS:
- K/k = King (White/Black)
- Q/q = Queen (White/Black)
- R/r = Rook (White/Black)
- B/b = Bishop (White/Black)
- N/n = Knight (White/Black)
- P/p = Pawn (White/Black)
- . = Empty square

MOVE FORMAT (UCI notation):
- Standard move: source_square + destination_square (e.g., "e2e4", "g8f6")
- Pawn promotion: source + destination + piece (e.g., "e7e8q" for queen promotion)
- Castling: King's move notation (e.g., "e1g1" for White kingside, "e8g8" for Black kingside)

RULES:
- You must return a legal move
- Consider tactics: pins, forks, skewers, discovered attacks
- Protect your king and look for checkmate opportunities
- Consider piece development, center control, and king safety

OUTPUT: Return only a valid UCI move string.""".strip()


# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1


# OpenAI reasoning effort config
MINIMAL_REASONING_MODELS = {'gpt-5-mini'}
LOW_REASONING_MODELS = {'gpt-5.1-low'}
HIGH_REASONING_MODELS = {'gpt-5.2-high'}


def generate_chess_prompt(board_ascii: str, move_history: list, legal_moves: list) -> str:
    """Generate the prompt for the AI to make a chess move."""

    # Format move history
    if move_history:
        history_lines = []
        for i, move in enumerate(move_history):
            if i % 2 == 0:
                move_num = (i // 2) + 1
                history_lines.append(f"{move_num}. {move}")
            else:
                history_lines[-1] += f" {move}"
        history_text = " ".join(history_lines)
    else:
        history_text = "Game just started - no moves yet."

    # Format legal moves (show first 20 to keep prompt reasonable)
    legal_moves_sample = legal_moves[:30] if len(legal_moves) > 30 else legal_moves
    legal_moves_text = ", ".join(legal_moves_sample)
    if len(legal_moves) > 30:
        legal_moves_text += f" ... ({len(legal_moves)} total legal moves)"

    return f"""Current board position:

{board_ascii}

Move history: {history_text}

Your legal moves: {legal_moves_text}

It is your turn (Black). Choose your move in UCI format."""


def call_openai_chess_move(prompt: str, model: str = "gpt-5.1", model_key: str = None) -> tuple[str, str | None]:
    """
    Call OpenAI to make a chess move.
    Returns (move, reasoning_summary) where move is in UCI format.
    """
    key = model_key or model
    use_full_reasoning = key not in MINIMAL_REASONING_MODELS
    use_low_reasoning = key in LOW_REASONING_MODELS
    use_high_reasoning = key in HIGH_REASONING_MODELS

    if use_full_reasoning:
        if use_high_reasoning:
            reasoning_effort = "high"
        elif use_low_reasoning:
            reasoning_effort = "low"
        else:
            reasoning_effort = "medium"

        response = openai_client.responses.parse(
            model=model,
            input=[
                {"role": "system", "content": CHESS_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            text_format=ChessMoveAnswer,
            reasoning={
                "effort": reasoning_effort,
                "summary": "auto"
            },
        )

        move = response.output_parsed.move

        # Get reasoning summary
        reasoning_summary = None
        for item in response.output:
            if getattr(item, "type", None) == "reasoning":
                parts = []
                for s in (item.summary or []):
                    if getattr(s, "text", None):
                        parts.append(s.text)
                if parts:
                    reasoning_summary = "\n".join(parts)
                break

        return move, reasoning_summary
    else:
        response = openai_client.responses.parse(
            model=model,
            input=[
                {"role": "system", "content": CHESS_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            text_format=ChessMoveAnswer,
            reasoning={
                "effort": "minimal"
            },
        )

        move = response.output_parsed.move
        return move, None


def call_anthropic_chess_move(prompt: str, model: str, use_thinking: bool) -> tuple[str, str | None]:
    """
    Call Anthropic to make a chess move.
    Returns (move, thinking_summary) where move is in UCI format.
    """
    for attempt in range(MAX_RETRIES):
        if use_thinking:
            response = anthropic_client.beta.messages.create(
                model=model,
                max_tokens=4096,
                thinking={
                    "type": "enabled",
                    "budget_tokens": 2048,
                },
                betas=["structured-outputs-2025-11-13"],
                system=CHESS_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                output_format={
                    "type": "json_schema",
                    "schema": CHESS_MOVE_SCHEMA
                }
            )

            thinking_summary = None
            thinking_parts = []
            for block in response.content:
                if getattr(block, "type", None) == "thinking":
                    s = getattr(block, "thinking", None) or getattr(block, "summary", None) or ""
                    if s:
                        thinking_parts.append(s)
            if thinking_parts:
                thinking_summary = "\n".join(thinking_parts).strip()

            json_text = ""
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    t = getattr(block, "text", "") or ""
                    if t.strip():
                        json_text += t

            if not json_text.strip():
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)
                    logging.warning(f"Claude chess move returned thinking-only, retry {attempt+1}/{MAX_RETRIES} in {delay}s")
                    time.sleep(delay)
                    continue
                raise RuntimeError(f"No text response from Claude after {MAX_RETRIES} attempts.")

            data = json.loads(json_text)
            return data["move"], thinking_summary
        else:
            response = anthropic_client.beta.messages.create(
                model=model,
                max_tokens=2048,
                betas=["structured-outputs-2025-11-13"],
                system=CHESS_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                output_format={
                    "type": "json_schema",
                    "schema": CHESS_MOVE_SCHEMA
                }
            )

            json_text = ""
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    t = getattr(block, "text", "") or ""
                    if t.strip():
                        json_text += t

            if not json_text.strip():
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)
                    time.sleep(delay)
                    continue
                raise RuntimeError(f"No text response from Claude after {MAX_RETRIES} attempts.")

            data = json.loads(json_text)
            return data["move"], None

    raise RuntimeError("Unexpected error in call_anthropic_chess_move")


# Test
if __name__ == "__main__":
    test_board = """  a b c d e f g h
8 r n b q k b n r 8
7 p p p p p p p p 7
6 . . . . . . . . 6
5 . . . . . . . . 5
4 . . . . P . . . 4
3 . . . . . . . . 3
2 P P P P . P P P 2
1 R N B Q K B N R 1
  a b c d e f g h"""

    test_prompt = generate_chess_prompt(
        test_board,
        ["e2e4"],
        ["e7e5", "e7e6", "d7d5", "d7d6", "c7c5", "c7c6", "g8f6", "b8c6"]
    )

    print("Test prompt:")
    print(test_prompt)
    print("\n" + "="*50 + "\n")

    # Test with Anthropic
    move, thinking = call_anthropic_chess_move(test_prompt, "claude-haiku-4-5-20251001", True)
    print(f"Claude's move: {move}")
    print(f"Thinking: {thinking[:200] if thinking else 'None'}...")

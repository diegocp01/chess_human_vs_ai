import json
import time
import logging
from pydantic import BaseModel
from dotenv import load_dotenv
from trained_ai import STRATEGY_NAMES

load_dotenv()


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

CODEX_CHESS_MOVE_SCHEMA = {
    "type": "object",
    "properties": {
        "move": {
            "type": "string",
            "description": "Chess move in UCI format (for example, 'e7e5' or 'e8g8')"
        },
        "reasoning": {
            "type": "string",
            "description": "A concise explanation of the chess idea behind the move"
        }
    },
    "required": ["move", "reasoning"],
    "additionalProperties": False
}

CODEX_GAME_COACH_SCHEMA = {
    "type": "object",
    "properties": {
        "tactics": {
            "type": "array",
            "minItems": 4,
            "maxItems": 4,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "evidence": {"type": "string"},
                },
                "required": ["name", "description", "evidence"],
                "additionalProperties": False,
            },
        },
        "used_tactic_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3,
            "description": "Zero-based index of the tactic the human used most clearly",
        },
        "one_line_insight": {"type": "string"},
        "what_went_wrong": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": {"type": "string"},
        },
        "best_improvement": {"type": "string"},
        "ai_strategy_analysis": {
            "type": "object",
            "properties": {
                "overall_strategy": {
                    "type": "string",
                    "enum": list(STRATEGY_NAMES),
                },
                "summary": {"type": "string"},
                "move_labels": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 200,
                    "items": {
                        "type": "object",
                        "properties": {
                            "ply": {"type": "integer", "minimum": 1},
                            "strategy": {
                                "type": "string",
                                "enum": list(STRATEGY_NAMES),
                            },
                            "evidence": {"type": "string"},
                        },
                        "required": ["ply", "strategy", "evidence"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["overall_strategy", "summary", "move_labels"],
            "additionalProperties": False,
        },
    },
    "required": [
        "tactics",
        "used_tactic_index",
        "one_line_insight",
        "what_went_wrong",
        "best_improvement",
        "ai_strategy_analysis",
    ],
    "additionalProperties": False,
}


CHESS_SYSTEM_PROMPT = """You are a chess engine playing against a human. The current user prompt states whether you are White or Black; analyze and move only for that color.

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

CHESS_CORE_INSTRUCTIONS = CHESS_SYSTEM_PROMPT.rsplit("\n\nOUTPUT:", 1)[0]

CODEX_CHESS_INSTRUCTIONS = f"""{CHESS_CORE_INSTRUCTIONS}

You are running as the chess opponent inside a web game. Do not inspect files, run
commands, browse, or call tools. Analyze only the board, history, and legal moves
provided by the user. You do not receive the human's prior games, Coach profile,
or historical tendencies. Return the requested structured response with the UCI
move and a concise chess explanation.""".strip()

CODEX_COACH_INSTRUCTIONS = """Role:
You are a world-class chess grandmaster and an exceptional practical coach
reviewing a completed human-versus-AI game.

Goal:
Help the human understand how they played, which tactical idea they demonstrated,
what cost them the most, and what single habit will improve their next game.

Evidence contract:
- The supplied game-record JSON is your complete and only source of truth.
- Read the winner, result, human color, AI color, opponent provider and model,
  timestamps, captures, full SAN and UCI move sequence, FEN after every ply,
  final FEN, and PGN before reaching a conclusion.
- Reconstruct the game chronologically and evaluate only the human player's
  decisions. Never confuse an AI move with a human move.
- Ground tactical evidence and mistakes in specific SAN moves or short move
  sequences from the record.
- Accurately account for whether the human won, lost, or drew and which model
  they played.
- Separately classify the AI opponent's moves for the local Trained AI dataset.
  Label only records whose actor is "ai"; never train from the human's moves.

Coaching standard:
- Name exactly four tactical themes that were genuinely demonstrated, attempted,
  missed, or decisive in this game.
- Select the one tactic the human demonstrated most clearly; do not simply pick
  the tactic that decided the result if the AI, rather than the human, used it.
- Explain mistakes directly but constructively, prioritizing decisions that
  materially changed the position.
- Do not invent engine evaluations, centipawn scores, forced lines, or board
  facts unsupported by the record.
- If the game is too short for a broad style judgment, describe only what this
  game demonstrates instead of generalizing about the player.
- For every AI move, return its ply number and exactly one strategy label from
  the supplied taxonomy. This is the one and only classification pass for this
  game, so cover every legal AI move present in the JSON.

Personality:
Sound like a calm grandmaster beside the board: precise, candid, encouraging,
and free of generic praise.

Output:
Return only the requested structured response. Keep the one-line insight to one
sentence, make every tactic's evidence move-specific, and keep all other fields
concise. Do not inspect files, run commands, browse, or call tools.""".strip()


# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1


# OpenAI reasoning effort config
MINIMAL_REASONING_MODELS = {'gpt-5-mini'}
LOW_REASONING_MODELS = {'gpt-5.1-low'}
HIGH_REASONING_MODELS = {'gpt-5.2-high'}


def generate_chess_prompt(
    board_ascii: str,
    move_history: list,
    legal_moves: list,
    ai_color: str = "black",
) -> str:
    """Generate the prompt for the AI to make a chess move."""
    normalized_ai_color = "white" if ai_color.lower() == "white" else "black"
    human_color = "black" if normalized_ai_color == "white" else "white"

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

    return f"""You are playing {normalized_ai_color.title()}. The human is playing {human_color.title()}.

Current board position:

{board_ascii}

Move history: {history_text}

Your legal moves: {legal_moves_text}

It is your turn ({normalized_ai_color.title()}). Choose one of your legal moves in UCI format."""


def call_openai_chess_move(prompt: str, model: str = "gpt-5.1", model_key: str = None) -> tuple[str, str | None]:
    """
    Call OpenAI to make a chess move.
    Returns (move, reasoning_summary) where move is in UCI format.
    """
    from openai import OpenAI

    openai_client = OpenAI()
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
    import anthropic

    anthropic_client = anthropic.Anthropic()
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


def list_codex_models() -> list[dict]:
    """Return every visible model advertised by the signed-in Codex runtime."""
    try:
        from openai_codex import Codex
    except ImportError as exc:
        raise RuntimeError(
            "Codex SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    with Codex() as codex:
        _require_codex_subscription(codex)
        response = codex.models()

    models = []
    for model in response.data:
        if model.hidden:
            continue
        models.append({
            "id": model.model,
            "display": model.display_name,
            "description": model.description,
            "is_default": model.is_default,
            "default_reasoning_effort": model.default_reasoning_effort.value,
            "reasoning_efforts": [
                option.reasoning_effort.value
                for option in model.supported_reasoning_efforts
            ],
        })
    return models


def _require_codex_subscription(codex) -> None:
    """Ensure the SDK path uses ChatGPT subscription auth, never an API key."""
    account = codex.account().account
    account_details = getattr(account, "root", None)
    if getattr(account_details, "type", None) != "chatgpt":
        raise RuntimeError(
            "Codex SDK play requires Codex to be signed in with ChatGPT. "
            "Open Codex, sign out of API-key authentication if necessary, and "
            "choose Sign in with ChatGPT."
        )


def call_codex_chess_move(prompt: str, model: str) -> tuple[str, str | None]:
    """
    Call the Codex SDK using the user's existing ChatGPT/Codex subscription.
    No OpenAI API key or Anthropic API key is used by this path.
    """
    try:
        from openai_codex import Codex, Sandbox
    except ImportError as exc:
        raise RuntimeError(
            "Codex SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    with Codex() as codex:
        _require_codex_subscription(codex)
        thread = codex.thread_start(
            model=model,
            developer_instructions=CODEX_CHESS_INSTRUCTIONS,
            ephemeral=True,
            sandbox=Sandbox.read_only,
        )
        result = thread.run(
            prompt,
            output_schema=CODEX_CHESS_MOVE_SCHEMA,
            sandbox=Sandbox.read_only,
        )

    if not result.final_response:
        raise RuntimeError("Codex SDK returned no final response.")

    try:
        data = json.loads(result.final_response)
        return data["move"], data.get("reasoning")
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise RuntimeError(
            f"Expected a structured chess move from Codex, got: {result.final_response}"
        ) from exc


def generate_codex_coach_prompt(game_record: dict) -> str:
    """Embed the complete game JSON in the post-game coaching request."""
    return f"""Review this completed chess game from the human player's perspective.

Success criteria:
- First establish the human color, opponent model, winner, and result from the JSON.
- Return exactly four relevant tactical themes.
- Pick the tactic the human actually demonstrated most clearly.
- Make the one-line insight describe the human's style in this game and name the opponent model.
- Explain what the human did wrong with move-specific, constructive observations,
  even if the human won.
- End with one highest-value improvement for the next game.
- In the same response, classify every AI-authored move into the fixed strategy
  taxonomy for local mathematical training. Do not label human moves.

Game record:
{json.dumps(game_record, ensure_ascii=False, separators=(",", ":"))}"""


def call_codex_game_coach(game_record: dict, model: str = "gpt-5.6-sol") -> dict:
    """Analyze a completed game with Codex subscription authentication."""
    try:
        from openai_codex import Codex, Sandbox
    except ImportError as exc:
        raise RuntimeError(
            "Codex SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    prompt = generate_codex_coach_prompt(game_record)

    with Codex() as codex:
        _require_codex_subscription(codex)
        thread = codex.thread_start(
            model=model,
            developer_instructions=CODEX_COACH_INSTRUCTIONS,
            ephemeral=True,
            sandbox=Sandbox.read_only,
        )
        result = thread.run(
            prompt,
            output_schema=CODEX_GAME_COACH_SCHEMA,
            sandbox=Sandbox.read_only,
        )

    if not result.final_response:
        raise RuntimeError("Codex Coach returned no final response.")

    try:
        data = json.loads(result.final_response)
    except (json.JSONDecodeError, TypeError) as exc:
        raise RuntimeError(
            f"Expected structured coaching from Codex, got: {result.final_response}"
        ) from exc

    tactics = data.get("tactics")
    used_index = data.get("used_tactic_index")
    if not isinstance(tactics, list) or len(tactics) != 4:
        raise RuntimeError("Codex Coach must return exactly four tactics.")
    if not isinstance(used_index, int) or not 0 <= used_index < 4:
        raise RuntimeError("Codex Coach returned an invalid used tactic index.")
    ai_analysis = data.get("ai_strategy_analysis")
    if not isinstance(ai_analysis, dict) or not ai_analysis.get("move_labels"):
        raise RuntimeError("Codex Coach returned no AI strategy labels.")
    if any(
        label.get("strategy") not in STRATEGY_NAMES
        for label in ai_analysis["move_labels"]
    ):
        raise RuntimeError("Codex Coach returned an unknown AI strategy label.")
    expected_ai_plies = {
        int(move["ply"])
        for move in game_record.get("moves", [])
        if move.get("actor") == "ai" and str(move.get("ply", "")).isdigit()
    }
    labeled_plies = {
        int(label["ply"])
        for label in ai_analysis["move_labels"]
        if str(label.get("ply", "")).isdigit()
    }
    if labeled_plies != expected_ai_plies:
        raise RuntimeError(
            "Codex Coach must label every AI move exactly once and no human moves."
        )

    return data


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

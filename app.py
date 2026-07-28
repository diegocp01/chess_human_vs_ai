from flask import Flask, render_template, jsonify, request
import chess
import chess.pgn
import time
import os
import secrets
import json
from datetime import datetime, timezone
from pathlib import Path

from chess_ai import (
    call_openai_chess_move,
    call_anthropic_chess_move,
    call_codex_chess_move,
    call_codex_game_coach,
    list_codex_models,
    generate_chess_prompt,
)
from trained_ai import (
    choose_trained_move,
    predict_trained_win_probability,
    rebuild_trained_model,
    trained_model_summary,
)
from history_hints import find_history_hint
from results_dashboard import build_results_dashboard
from player_profiles import (
    create_player,
    get_player,
    list_players,
    record_game_result,
    select_player,
)
from persistent_storage import (
    default_data_root,
    migrate_legacy_storage,
    storage_paths,
)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Server-side game state storage
GAME_STATE = {}
PROJECT_ROOT = Path(__file__).resolve().parent
PERSISTENT_DATA_ROOT = default_data_root()
PERSISTENT_STORAGE_PATHS = storage_paths(PERSISTENT_DATA_ROOT)
GAME_LOG_DIR = PERSISTENT_STORAGE_PATHS['game_log_dir']
CODEX_COACH_MODEL = os.getenv('CODEX_COACH_MODEL', 'gpt-5.6-sol')
TRAINED_AI_MODEL_PATH = PERSISTENT_STORAGE_PATHS['trained_model_path']
PLAYER_DATA_PATH = PERSISTENT_STORAGE_PATHS['player_data_path']
_PERSISTENT_STORAGE_READY = False

# API-backed models remain available alongside the Codex subscription option.
API_MODELS = {
    'openai': {
        'gpt-5-mini': {'id': 'gpt-5-mini', 'display': 'GPT 5 Mini'},
        'gpt-5.1-low': {'id': 'gpt-5.1', 'display': 'GPT 5.1 Low'},
        'gpt-5.1': {'id': 'gpt-5.1', 'display': 'GPT 5.1 Medium'},
        'gpt-5.2': {'id': 'gpt-5.2', 'display': 'GPT 5.2 Medium'},
        'gpt-5.2-high': {'id': 'gpt-5.2', 'display': 'GPT 5.2 High'},
    },
    'anthropic': {
        'claude-haiku-4.5-standard': {
            'id': 'claude-haiku-4-5-20251001',
            'display': 'Claude Haiku 4.5',
            'thinking': False,
        },
        'claude-haiku-4.5': {
            'id': 'claude-haiku-4-5-20251001',
            'display': 'Claude Haiku 4.5 Thinking',
            'thinking': True,
        },
        'claude-sonnet-4.5-standard': {
            'id': 'claude-sonnet-4-5-20250929',
            'display': 'Claude Sonnet 4.5',
            'thinking': False,
        },
        'claude-sonnet-4.5': {
            'id': 'claude-sonnet-4-5-20250929',
            'display': 'Claude Sonnet 4.5 Thinking',
            'thinking': True,
        },
        'claude-opus-4.5': {
            'id': 'claude-opus-4-5-20251101',
            'display': 'Claude Opus 4.5 Thinking',
            'thinking': True,
        },
    },
}

DEFAULT_MODELS = {
    'openai': 'gpt-5-mini',
    'anthropic': 'claude-haiku-4.5',
}

TRAINED_MODEL = {
    'trained-local': {
        'id': 'trained-local',
        'display': 'Trained AI Default',
        'description': 'Outcome-weighted learning model trained from prior AI games',
        'thinking': False,
        'is_default': True,
        'available': True,
    },
    'trained-trust-value': {
        'id': 'trained-trust-value',
        'display': 'Trust Value',
        'description': 'Coming soon',
        'thinking': False,
        'is_default': False,
        'available': False,
        'coming_soon': True,
    },
}


def board_to_ascii(board: chess.Board) -> str:
    """Convert board to ASCII representation with coordinates."""
    lines = ["  a b c d e f g h"]

    for rank in range(7, -1, -1):  # 8 to 1
        row = [f"{rank + 1}"]
        for file in range(8):  # a to h
            square = chess.square(file, rank)
            piece = board.piece_at(square)
            if piece:
                row.append(piece.symbol())
            else:
                row.append(".")
        row.append(f"{rank + 1}")
        lines.append(" ".join(row))

    lines.append("  a b c d e f g h")
    return "\n".join(lines)


def ensure_persistent_storage() -> None:
    """Migrate legacy checkout-local data once before serving real requests."""
    global _PERSISTENT_STORAGE_READY
    if _PERSISTENT_STORAGE_READY:
        return

    # Tests replace these paths with temporary files. Do not import a
    # developer's real local data into an isolated test store.
    if (
        GAME_LOG_DIR != PERSISTENT_STORAGE_PATHS['game_log_dir']
        or TRAINED_AI_MODEL_PATH != PERSISTENT_STORAGE_PATHS['trained_model_path']
        or PLAYER_DATA_PATH != PERSISTENT_STORAGE_PATHS['player_data_path']
    ):
        return

    migrate_legacy_storage(PROJECT_ROOT, PERSISTENT_DATA_ROOT)
    _PERSISTENT_STORAGE_READY = True


def get_board_state(board: chess.Board) -> dict:
    """Get the current board state as a dictionary for the frontend."""
    squares = {}
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            square_name = chess.square_name(square)
            squares[square_name] = {
                'piece': piece.symbol(),
                'color': 'white' if piece.color == chess.WHITE else 'black'
            }
    return squares


def resolve_model_config(ai_provider: str, ai_model: str | None) -> tuple[str, dict]:
    """Validate a provider/model selection and return its runtime configuration."""
    if ai_provider in API_MODELS:
        model_key = ai_model or DEFAULT_MODELS[ai_provider]
        model_config = API_MODELS[ai_provider].get(model_key)
        if not model_config:
            raise ValueError(f'Unknown {ai_provider} model: {model_key}')
        return model_key, model_config

    if ai_provider == 'trained':
        model_key = ai_model or 'trained-local'
        model_config = TRAINED_MODEL.get(model_key)
        if not model_config:
            raise ValueError(f'Unknown Trained AI model: {model_key}')
        if not model_config.get('available', True):
            raise ValueError(f"{model_config['display']} is coming soon.")
        return model_key, model_config

    if ai_provider == 'codex':
        models = list_codex_models()
        if not models:
            raise RuntimeError('Codex SDK did not return any available models.')

        selected = None
        if ai_model:
            selected = next((model for model in models if model['id'] == ai_model), None)
            if selected is None:
                raise ValueError(f'Codex model is not available: {ai_model}')
        else:
            selected = next((model for model in models if model['is_default']), models[0])

        return selected['id'], {
            'id': selected['id'],
            'display': selected['display'],
            'thinking': True,
        }

    raise ValueError(f'Unknown AI provider: {ai_provider}')


def init_game_state(
    ai_provider='anthropic',
    ai_model=None,
    human_color=None,
    player_id=None,
):
    """Initialize a fresh chess game state."""
    board = chess.Board()
    model_key, model_config = resolve_model_config(ai_provider, ai_model)
    player = get_player(PLAYER_DATA_PATH, player_id)
    if not player:
        raise ValueError('Create or select a local player profile before starting.')
    if human_color not in {'white', 'black'}:
        human_color = secrets.choice(['white', 'black'])
    ai_color = 'black' if human_color == 'white' else 'white'
    started_at = utc_now()
    game_id = f"{started_at[:10]}-{secrets.token_hex(6)}"
    trained_summary = (
        trained_model_summary(TRAINED_AI_MODEL_PATH)
        if ai_provider == 'trained'
        else None
    )
    trained_prediction = (
        predict_trained_win_probability(
            board,
            ai_color,
            TRAINED_AI_MODEL_PATH,
        )
        if ai_provider == 'trained'
        else None
    )

    return {
        'game_id': game_id,
        'started_at': started_at,
        'ended_at': None,
        'board': board,
        'fen': board.fen(),
        'move_history': [],  # List of UCI moves
        'move_history_san': [],  # List of SAN moves for display
        'move_records': [],
        'game_over': False,
        'winner': None,  # 'human', 'ai', or 'draw'
        'game_result': None,  # Checkmate, stalemate, etc.

        # AI configuration
        'ai_model_key': model_key,
        'ai_model_id': model_config['id'],
        'ai_provider': ai_provider,
        'ai_display_name': model_config['display'],
        'ai_use_thinking': model_config.get('thinking', False),
        'human_color': human_color,
        'ai_color': ai_color,
        'player': player,
        'trained_model_summary': trained_summary,
        'trained_ai_last_decision': None,
        'trained_ai_win_prediction': trained_prediction,
        'trained_ai_prediction_history': (
            [{**trained_prediction, 'after_move': None}]
            if trained_prediction
            else []
        ),

        # AI reasoning (last move)
        'ai_reasoning': '',

        # Timing
        'ai_last_time': 0.0,
        'ai_total_time': 0.0,

        # Turn tracking
        'current_turn': 'white',
        'coach': {'status': 'pending'},
        'trained_ai_analysis': {'status': 'pending'},
        'rating_update': {'status': 'pending'},
    }


def utc_now() -> str:
    """Return an ISO-8601 UTC timestamp suitable for JSON records."""
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def game_log_path(game_id: str) -> Path:
    """Resolve a game record path without accepting arbitrary path components."""
    safe_id = ''.join(char for char in game_id if char.isalnum() or char in {'-', '_'})
    return GAME_LOG_DIR / f'{safe_id}.json'


def game_pgn(state: dict) -> str:
    """Export the current move stack as compact PGN."""
    game = chess.pgn.Game.from_board(state['board'])
    game.headers['Event'] = 'Kingside local match'
    game.headers['Date'] = state['started_at'][:10].replace('-', '.')
    game.headers['White'] = 'Human' if state['human_color'] == 'white' else state['ai_display_name']
    game.headers['Black'] = 'Human' if state['human_color'] == 'black' else state['ai_display_name']
    return str(game)


def build_game_record(state: dict) -> dict:
    """Build the serializable, durable record for a game."""
    result = {
        'status': 'incomplete',
        'outcome': 'incomplete',
        'winner': None,
        'loser': None,
        'description': 'Game incomplete',
        'chess_result': '*',
    }
    if state['game_over']:
        winner = state['winner']
        result = {
            'status': 'complete',
            'outcome': 'draw' if winner == 'draw' else 'win',
            'winner': winner,
            'loser': (
                None
                if winner == 'draw'
                else 'ai' if winner == 'human' else 'human'
            ),
            'description': state['game_result'],
            'chess_result': state['board'].result(claim_draw=True),
        }

    return {
        'schema_version': 2,
        'game_id': state['game_id'],
        'started_at': state['started_at'],
        'last_updated_at': utc_now(),
        'ended_at': state['ended_at'],
        'opponent': {
            'provider': state['ai_provider'],
            'model_id': state['ai_model_id'],
            'model_key': state['ai_model_key'],
            'display_name': state['ai_display_name'],
        },
        'player': {
            'id': state['player']['id'],
            'username': state['player']['username'],
            'elo_at_start': state['player']['elo'],
        },
        'human_color': state['human_color'],
        'ai_color': state['ai_color'],
        'moves': state['move_records'],
        'final_fen': state['fen'],
        'pgn': game_pgn(state),
        'result': result,
        'coach': state['coach'],
        'trained_ai_analysis': state['trained_ai_analysis'],
        'trained_ai_predictions': state.get('trained_ai_prediction_history', []),
        'rating_update': state['rating_update'],
    }


def persist_game_record(state: dict) -> Path:
    """Atomically save the latest game record to disk."""
    GAME_LOG_DIR.mkdir(parents=True, exist_ok=True)
    destination = game_log_path(state['game_id'])
    temporary = destination.with_suffix('.json.tmp')
    temporary.write_text(
        json.dumps(build_game_record(state), indent=2, ensure_ascii=False) + '\n',
        encoding='utf-8',
    )
    temporary.replace(destination)
    return destination


def migrate_legacy_incomplete_game_logs() -> int:
    """Give older unfinished JSON records the explicit incomplete result schema."""
    if not GAME_LOG_DIR.exists():
        return 0
    migrated = 0
    for destination in sorted(GAME_LOG_DIR.glob('*.json')):
        try:
            record = json.loads(destination.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError, TypeError):
            continue
        if (
            not isinstance(record, dict)
            or record.get('result') is not None
            or record.get('ended_at')
        ):
            continue
        record['schema_version'] = max(int(record.get('schema_version', 1)), 2)
        record['last_updated_at'] = (
            record.get('last_updated_at')
            or record.get('started_at')
            or utc_now()
        )
        record['result'] = {
            'status': 'incomplete',
            'outcome': 'incomplete',
            'winner': None,
            'loser': None,
            'description': 'Game incomplete',
            'chess_result': '*',
        }
        temporary = destination.with_suffix('.json.tmp')
        temporary.write_text(
            json.dumps(record, indent=2, ensure_ascii=False) + '\n',
            encoding='utf-8',
        )
        temporary.replace(destination)
        migrated += 1
    return migrated


def persist_game_and_refresh_training(state: dict) -> Path:
    """Save a move and teach the local policy immediately after a completed game."""
    destination = persist_game_record(state)
    if not state['game_over']:
        return destination

    try:
        rebuild_trained_model(GAME_LOG_DIR, TRAINED_AI_MODEL_PATH)
        state['trained_model_summary'] = trained_model_summary(
            TRAINED_AI_MODEL_PATH
        )
    except Exception as exc:
        state['trained_model_summary'] = {
            **(state.get('trained_model_summary') or {}),
            'training_error': str(exc),
        }
    return destination


def update_trained_win_prediction(state: dict) -> None:
    """Record the local value model's AI win forecast for the current ply."""
    if state.get('ai_provider') != 'trained':
        return
    prediction = predict_trained_win_probability(
        state['board'],
        state['ai_color'],
        TRAINED_AI_MODEL_PATH,
    )
    prediction['after_move'] = (
        state['move_records'][-1]['uci']
        if state.get('move_records')
        else None
    )
    state['trained_ai_win_prediction'] = prediction
    history = state.setdefault('trained_ai_prediction_history', [])
    if history and history[-1].get('ply') == prediction['ply']:
        history[-1] = prediction
    else:
        history.append(prediction)


def append_move_record(state: dict, move_uci: str, san: str, actor: str, capture: dict | None) -> None:
    """Add one timestamped ply to the durable move timeline."""
    state['move_records'].append({
        'ply': len(state['move_records']) + 1,
        'played_at': utc_now(),
        'actor': actor,
        'color': state['human_color'] if actor == 'human' else state['ai_color'],
        'uci': move_uci,
        'san': san,
        'fen_after': state['fen'],
        'capture': capture,
    })


def finalize_game(state: dict, checkmate_winner: str) -> None:
    """Update terminal metadata after a move, if the board is complete."""
    board = state['board']
    if not board.is_game_over(claim_draw=True):
        return

    state['game_over'] = True
    state['ended_at'] = utc_now()
    if board.is_checkmate():
        state['winner'] = checkmate_winner
        state['game_result'] = (
            'Checkmate! You win!' if checkmate_winner == 'human'
            else 'Checkmate! AI wins!'
        )
    elif board.is_stalemate():
        state['winner'] = 'draw'
        state['game_result'] = 'Stalemate - Draw'
    elif board.is_insufficient_material():
        state['winner'] = 'draw'
        state['game_result'] = 'Insufficient material - Draw'
    elif board.can_claim_fifty_moves() or board.is_fifty_moves():
        state['winner'] = 'draw'
        state['game_result'] = 'Fifty-move rule - Draw'
    elif board.can_claim_threefold_repetition() or board.is_repetition():
        state['winner'] = 'draw'
        state['game_result'] = 'Threefold repetition - Draw'
    else:
        state['winner'] = 'draw'
        state['game_result'] = 'Game drawn'

    if state.get('rating_update', {}).get('status') != 'complete':
        human_score = 0.5
        if state['winner'] == 'human':
            human_score = 1.0
        elif state['winner'] == 'ai':
            human_score = 0.0
        try:
            rating_update = record_game_result(
                PLAYER_DATA_PATH,
                game_id=state['game_id'],
                player_id=state['player']['id'],
                opponent_key=f"{state['ai_provider']}:{state['ai_model_id']}",
                opponent_provider=state['ai_provider'],
                opponent_model=state['ai_model_id'],
                opponent_name=state['ai_display_name'],
                human_score=human_score,
            )
            state['rating_update'] = rating_update
            state['player']['elo'] = rating_update['rating_after']
            state['player']['games'] += 1
            if human_score == 1.0:
                state['player']['wins'] += 1
            elif human_score == 0.0:
                state['player']['losses'] += 1
            else:
                state['player']['draws'] += 1
        except Exception as exc:
            state['rating_update'] = {
                'status': 'error',
                'error': str(exc),
            }


@app.before_request
def prepare_persistent_storage():
    ensure_persistent_storage()


@app.route('/')
def index():
    migrate_legacy_incomplete_game_logs()
    return render_template('index.html')


@app.route('/api/players', methods=['GET'])
def get_players():
    """List local profiles; no authentication is applied in this version."""
    return jsonify(list_players(PLAYER_DATA_PATH))


@app.route('/api/players', methods=['POST'])
def create_player_route():
    """Create an immutable local username and select it."""
    data = request.get_json(silent=True) or {}
    try:
        player = create_player(PLAYER_DATA_PATH, data.get('username', ''))
        return jsonify({'success': True, 'player': player}), 201
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400


@app.route('/api/players/select', methods=['POST'])
def select_player_route():
    """Select any existing local profile without a password."""
    data = request.get_json(silent=True) or {}
    try:
        player = select_player(PLAYER_DATA_PATH, data.get('player_id', ''))
        return jsonify({'success': True, 'player': player})
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400


@app.route('/api/results', methods=['GET'])
def get_results_dashboard():
    """Return a private dashboard aggregated from one player's local game JSON."""
    migrate_legacy_incomplete_game_logs()
    player_id = request.args.get('player_id')
    player = get_player(PLAYER_DATA_PATH, player_id)
    if not player:
        return jsonify({'error': 'Select a local player to view results.'}), 404
    return jsonify(build_results_dashboard(GAME_LOG_DIR, player))


@app.route('/api/models', methods=['GET'])
def get_models():
    """List models for the selected provider."""
    provider = request.args.get('provider', 'codex')

    try:
        if provider == 'codex':
            models = list_codex_models()
        elif provider == 'trained':
            models = [
                {
                    'id': key,
                    'display': config['display'],
                    'description': config['description'],
                    'is_default': config.get('is_default', False),
                    'available': config.get('available', True),
                    'coming_soon': config.get('coming_soon', False),
                }
                for key, config in TRAINED_MODEL.items()
            ]
        elif provider in API_MODELS:
            models = [
                {
                    'id': key,
                    'display': config['display'],
                    'is_default': key == DEFAULT_MODELS[provider],
                }
                for key, config in API_MODELS[provider].items()
            ]
        else:
            return jsonify({'error': f'Unknown AI provider: {provider}'}), 400

        return jsonify({'provider': provider, 'models': models})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 503


@app.route('/api/start-game', methods=['POST'])
def start_game():
    """Start a new chess game."""
    global GAME_STATE
    data = request.get_json(silent=True) or {}
    ai_provider = data.get('ai_provider', 'anthropic')
    ai_model = data.get('ai_model')
    player_id = data.get('player_id')

    try:
        if ai_provider == 'trained':
            rebuild_trained_model(GAME_LOG_DIR, TRAINED_AI_MODEL_PATH)
        state = init_game_state(
            ai_provider=ai_provider,
            ai_model=ai_model,
            player_id=player_id,
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        return jsonify({'error': str(exc)}), 503

    GAME_STATE = state
    persist_game_record(state)

    return jsonify({
        'success': True,
        'game_state': get_client_state(state)
    })


@app.route('/api/game-state', methods=['GET'])
def get_game_state_route():
    """Get current game state."""
    global GAME_STATE
    if not GAME_STATE:
        return jsonify({'active': False})
    return jsonify(get_client_state(GAME_STATE))


@app.route('/api/human-move', methods=['POST'])
def human_move():
    """Process the human player's move."""
    global GAME_STATE
    state = GAME_STATE
    if not state:
        return jsonify({'error': 'No game in progress'}), 400

    if state['game_over']:
        return jsonify({'error': 'Game is over'}), 400

    if state['current_turn'] != state['human_color']:
        return jsonify({'error': 'Not your turn'}), 400

    data = request.get_json()
    move_uci = data.get('move')  # Expected in UCI format like "e2e4"

    if not move_uci:
        return jsonify({'error': 'No move provided'}), 400

    board = state['board']

    # Validate and make the move
    try:
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            return jsonify({'error': 'Illegal move', 'legal_moves': [m.uci() for m in board.legal_moves]}), 400

        capture = get_capture_details(board, move)

        # Get SAN before pushing
        san = board.san(move)
        board.push(move)

        state['fen'] = board.fen()
        state['move_history'].append(move_uci)
        state['move_history_san'].append(san)
        state['current_turn'] = 'white' if board.turn == chess.WHITE else 'black'
        append_move_record(state, move_uci, san, 'human', capture)
        finalize_game(state, 'human')
        update_trained_win_prediction(state)

        GAME_STATE = state
        persist_game_and_refresh_training(state)

        return jsonify({
            'success': True,
            'move': move_uci,
            'san': san,
            'capture': capture,
            'game_state': get_client_state(state)
        })

    except ValueError as e:
        return jsonify({'error': f'Invalid move format: {str(e)}'}), 400


MAX_AI_RETRIES = 3


@app.route('/api/ai-move', methods=['POST'])
def ai_move():
    """Get the AI's move."""
    global GAME_STATE
    state = GAME_STATE
    if not state:
        return jsonify({'error': 'No game in progress'}), 400

    if state['game_over']:
        return jsonify({'error': 'Game is over'}), 400

    if state['current_turn'] != state['ai_color']:
        return jsonify({'error': "Not AI's turn"}), 400

    board = state['board']
    legal_moves_list = [m.uci() for m in board.legal_moves]

    # Retry loop for AI moves
    start_time = time.time()
    move = None
    ai_move_uci = None
    reasoning = None
    last_error = None
    attempted_moves = []

    for attempt in range(MAX_AI_RETRIES):
        # Generate prompt for AI (include previous illegal attempts if any)
        board_ascii = board_to_ascii(board)
        prompt = generate_chess_prompt(
            board_ascii,
            state['move_history'],
            legal_moves_list,
            ai_color=state['ai_color'],
        )

        # Add context about previous failed attempts
        if attempted_moves:
            prompt += f"\n\nIMPORTANT: Your previous move(s) {attempted_moves} were ILLEGAL. You MUST choose a move from the legal moves list above."

        try:
            if state['ai_provider'] == 'openai':
                ai_move_uci, reasoning = call_openai_chess_move(
                    prompt,
                    state['ai_model_id'],
                    model_key=state['ai_model_key']
                )
            elif state['ai_provider'] == 'anthropic':
                ai_move_uci, reasoning = call_anthropic_chess_move(
                    prompt,
                    state['ai_model_id'],
                    state['ai_use_thinking']
                )
            elif state['ai_provider'] == 'codex':
                ai_move_uci, reasoning = call_codex_chess_move(
                    prompt,
                    state['ai_model_id'],
                )
            else:
                ai_move_uci, reasoning, decision = choose_trained_move(
                    board,
                    TRAINED_AI_MODEL_PATH,
                )
                state['trained_ai_last_decision'] = decision
        except Exception as e:
            last_error = str(e)
            continue

        # Validate AI move
        try:
            move = chess.Move.from_uci(ai_move_uci)
            if move in board.legal_moves:
                # Valid move found
                break
            else:
                # Illegal move, record and retry
                attempted_moves.append(ai_move_uci)
                move = None
        except ValueError:
            # Invalid move format, record and retry
            attempted_moves.append(ai_move_uci if ai_move_uci else "invalid")
            move = None

    # If all retries failed, pick a random legal move as last resort
    if move is None:
        import random
        move = random.choice(list(board.legal_moves))
        ai_move_uci = move.uci()
        if attempted_moves:
            reasoning = f"(AI failed after {len(attempted_moves)} attempts: {attempted_moves}. Playing random: {ai_move_uci})"
        elif last_error:
            reasoning = f"(AI error: {last_error}. Playing random: {ai_move_uci})"
        else:
            reasoning = f"(AI failed to respond. Playing random: {ai_move_uci})"

    elapsed = time.time() - start_time
    state['ai_last_time'] = round(elapsed, 2)
    state['ai_total_time'] = round(state['ai_total_time'] + elapsed, 2)
    state['ai_reasoning'] = reasoning or 'Move made.'

    capture = get_capture_details(board, move)

    # Get SAN before pushing
    san = board.san(move)
    board.push(move)

    state['fen'] = board.fen()
    state['move_history'].append(ai_move_uci)
    state['move_history_san'].append(san)
    state['current_turn'] = 'white' if board.turn == chess.WHITE else 'black'
    append_move_record(state, ai_move_uci, san, 'ai', capture)
    finalize_game(state, 'ai')
    update_trained_win_prediction(state)

    GAME_STATE = state
    persist_game_and_refresh_training(state)

    return jsonify({
        'success': True,
        'move': ai_move_uci,
        'san': san,
        'capture': capture,
        'reasoning': state['ai_reasoning'][:500] if state['ai_reasoning'] else '',
        'game_state': get_client_state(state)
    })


@app.route('/api/game-coach', methods=['POST'])
def game_coach():
    """Run one cached post-game review through the signed-in Codex SDK."""
    global GAME_STATE
    state = GAME_STATE
    if not state:
        return jsonify({'error': 'No game in progress'}), 400
    if not state['game_over']:
        return jsonify({'error': 'The Codex Coach is available after the game ends.'}), 409
    if state['coach'].get('status') == 'complete':
        return jsonify({
            'success': True,
            'game_id': state['game_id'],
            'log_file': game_log_path(state['game_id']).name,
            'coach': state['coach'],
            'trained_ai': state['trained_ai_analysis'],
        })
    if state['coach'].get('status') == 'analyzing':
        return jsonify({'error': 'Codex Coach is already reviewing this game.'}), 409

    state['coach'] = {
        'status': 'analyzing',
        'model': CODEX_COACH_MODEL,
        'started_at': utc_now(),
    }
    persist_game_record(state)

    try:
        analysis = call_codex_game_coach(
            build_game_record(state),
            model=CODEX_COACH_MODEL,
        )
        used_index = analysis['used_tactic_index']
        tactics = [
            {
                **tactic,
                'used': index == used_index,
            }
            for index, tactic in enumerate(analysis['tactics'])
        ]
        state['coach'] = {
            'status': 'complete',
            'model': CODEX_COACH_MODEL,
            'generated_at': utc_now(),
            'opponent_model': state['ai_display_name'],
            'tactics': tactics,
            'tactic_used': tactics[used_index]['name'],
            'one_line_insight': analysis['one_line_insight'],
            'what_went_wrong': analysis['what_went_wrong'],
            'best_improvement': analysis['best_improvement'],
        }
        ai_strategy = analysis['ai_strategy_analysis']
        state['trained_ai_analysis'] = {
            'status': 'complete',
            'classifier_model': CODEX_COACH_MODEL,
            'generated_at': utc_now(),
            'overall_strategy': ai_strategy['overall_strategy'],
            'summary': ai_strategy['summary'],
            'move_labels': ai_strategy['move_labels'],
        }
        persist_game_record(state)
        try:
            trained_model = rebuild_trained_model(
                GAME_LOG_DIR,
                TRAINED_AI_MODEL_PATH,
            )
            state['trained_ai_analysis']['dataset'] = {
                'games_processed': trained_model['games_processed'],
                'positions_seen': trained_model['positions_seen'],
                'strategies_known': trained_model['strategies_known'],
            }
            state['trained_model_summary'] = trained_model_summary(
                TRAINED_AI_MODEL_PATH
            )
        except Exception as training_exc:
            state['trained_ai_analysis']['training_error'] = str(training_exc)
        persist_game_record(state)
        return jsonify({
            'success': True,
            'game_id': state['game_id'],
            'log_file': game_log_path(state['game_id']).name,
            'coach': state['coach'],
            'trained_ai': state['trained_ai_analysis'],
        })
    except Exception as exc:
        state['coach'] = {
            'status': 'error',
            'model': CODEX_COACH_MODEL,
            'generated_at': utc_now(),
            'error': str(exc),
        }
        state['trained_ai_analysis'] = {
            'status': 'error',
            'classifier_model': CODEX_COACH_MODEL,
            'generated_at': utc_now(),
            'error': str(exc),
        }
        persist_game_record(state)
        return jsonify({
            'error': f'Codex Coach could not analyze this game: {exc}',
            'game_id': state['game_id'],
        }), 503


@app.route('/api/legal-moves', methods=['GET'])
def get_legal_moves():
    """Get legal moves for the current position."""
    global GAME_STATE
    if not GAME_STATE:
        return jsonify({'error': 'No game in progress'}), 400

    board = GAME_STATE['board']
    legal_moves = []

    for move in board.legal_moves:
        from_sq = chess.square_name(move.from_square)
        to_sq = chess.square_name(move.to_square)
        legal_moves.append({
            'uci': move.uci(),
            'from': from_sq,
            'to': to_sq,
            'san': board.san(move)
        })

    return jsonify({
        'legal_moves': legal_moves,
        'current_turn': GAME_STATE['current_turn']
    })


@app.route('/api/history-hint', methods=['GET'])
def get_history_hint():
    """Find a private mid-game hint in the selected player's own game history."""
    state = GAME_STATE
    if not state:
        return jsonify({'error': 'No game in progress'}), 400
    if state['game_over'] or state['current_turn'] != state['human_color']:
        return jsonify({'hint': None})

    hint = find_history_hint(
        board=state['board'],
        human_color=state['human_color'],
        player_id=state['player']['id'],
        current_game_id=state['game_id'],
        current_ply=len(state['move_records']),
        game_log_dir=GAME_LOG_DIR,
    )
    return jsonify({
        'hint': hint,
        'privacy': 'Local player history only; not shared with the opponent model.',
    })


@app.route('/api/legal-moves-from/<square>', methods=['GET'])
def get_legal_moves_from_square(square):
    """Get legal moves from a specific square."""
    global GAME_STATE
    if not GAME_STATE:
        return jsonify({'error': 'No game in progress'}), 400

    board = GAME_STATE['board']
    legal_destinations = []

    try:
        from_square = chess.parse_square(square)
        for move in board.legal_moves:
            if move.from_square == from_square:
                to_sq = chess.square_name(move.to_square)
                legal_destinations.append({
                    'uci': move.uci(),
                    'to': to_sq,
                    'san': board.san(move),
                    'promotion': chess.piece_name(move.promotion) if move.promotion else None,
                    'capture': board.is_capture(move),
                })
    except ValueError:
        return jsonify({'error': 'Invalid square'}), 400

    return jsonify({
        'from': square,
        'destinations': legal_destinations
    })


def get_client_state(state):
    """Get state formatted for the client."""
    board = state['board']

    return {
        'fen': state['fen'],
        'board': get_board_state(board),
        'move_history': state['move_history'],
        'move_history_san': state['move_history_san'],
        'game_over': state['game_over'],
        'winner': state['winner'],
        'game_result': state['game_result'],
        'current_turn': state['current_turn'],
        'is_check': board.is_check(),
        'human_color': state['human_color'],
        'ai_color': state['ai_color'],
        'player': state['player'],
        'rating_update': state['rating_update'],

        'ai_provider': state['ai_provider'],
        'ai_display_name': state['ai_display_name'],
        'ai_reasoning': state['ai_reasoning'][:500] if state['ai_reasoning'] else '',
        'ai_last_time': state['ai_last_time'],
        'ai_total_time': state['ai_total_time'],
        'game_id': state['game_id'],
        'started_at': state['started_at'],
        'coach_status': state['coach'].get('status', 'pending'),
        'trained_model_summary': state.get('trained_model_summary'),
        'trained_ai_last_decision': state.get('trained_ai_last_decision'),
        'trained_ai_win_prediction': state.get('trained_ai_win_prediction'),
        'trained_ai_prediction_history': state.get(
            'trained_ai_prediction_history',
            [],
        ),
    }


def get_capture_details(board: chess.Board, move: chess.Move) -> dict | None:
    """Describe a captured piece before the move is pushed."""
    if not board.is_capture(move):
        return None

    captured_square = move.to_square
    if board.is_en_passant(move):
        offset = -8 if board.turn == chess.WHITE else 8
        captured_square = move.to_square + offset

    captured_piece = board.piece_at(captured_square)
    attacker = board.piece_at(move.from_square)
    if captured_piece is None or attacker is None:
        return None

    return {
        'square': chess.square_name(captured_square),
        'piece': captured_piece.symbol(),
        'color': 'white' if captured_piece.color == chess.WHITE else 'black',
        'attacker': attacker.symbol(),
    }


if __name__ == '__main__':
    app.run(debug=True, port=5001)

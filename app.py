from flask import Flask, render_template, jsonify, request
import chess
import time
import os

from chess_ai import (
    call_openai_chess_move,
    call_anthropic_chess_move,
    generate_chess_prompt
)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Server-side game state storage
GAME_STATE = {}

# All available AI models (combined OpenAI and Anthropic)
AI_MODELS = {
    # OpenAI models
    'gpt-5-mini': {'id': 'gpt-5-mini', 'provider': 'openai', 'display': 'GPT 5 Mini'},
    'gpt-5.1-low': {'id': 'gpt-5.1', 'provider': 'openai', 'display': 'GPT 5.1 Low'},
    'gpt-5.1': {'id': 'gpt-5.1', 'provider': 'openai', 'display': 'GPT 5.1 Medium'},
    'gpt-5.2': {'id': 'gpt-5.2', 'provider': 'openai', 'display': 'GPT 5.2 Medium'},
    'gpt-5.2-high': {'id': 'gpt-5.2', 'provider': 'openai', 'display': 'GPT 5.2 High'},
    # Anthropic models
    'claude-haiku-4.5-standard': {'id': 'claude-haiku-4-5-20251001', 'provider': 'anthropic', 'display': 'Claude Haiku 4.5', 'thinking': False},
    'claude-haiku-4.5': {'id': 'claude-haiku-4-5-20251001', 'provider': 'anthropic', 'display': 'Claude Haiku 4.5 Thinking', 'thinking': True},
    'claude-sonnet-4.5-standard': {'id': 'claude-sonnet-4-5-20250929', 'provider': 'anthropic', 'display': 'Claude Sonnet 4.5', 'thinking': False},
    'claude-sonnet-4.5': {'id': 'claude-sonnet-4-5-20250929', 'provider': 'anthropic', 'display': 'Claude Sonnet 4.5 Thinking', 'thinking': True},
    'claude-opus-4.5': {'id': 'claude-opus-4-5-20251101', 'provider': 'anthropic', 'display': 'Claude Opus 4.5 Thinking', 'thinking': True},
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


def init_game_state(ai_model='claude-haiku-4.5'):
    """Initialize a fresh chess game state."""
    board = chess.Board()
    model_config = AI_MODELS.get(ai_model, AI_MODELS['claude-haiku-4.5'])

    return {
        'board': board,
        'fen': board.fen(),
        'move_history': [],  # List of UCI moves
        'move_history_san': [],  # List of SAN moves for display
        'game_over': False,
        'winner': None,  # 'human', 'ai', or 'draw'
        'game_result': None,  # Checkmate, stalemate, etc.

        # AI configuration
        'ai_model_key': ai_model,
        'ai_model_id': model_config['id'],
        'ai_provider': model_config['provider'],
        'ai_display_name': model_config['display'],
        'ai_use_thinking': model_config.get('thinking', False),

        # AI reasoning (last move)
        'ai_reasoning': '',

        # Timing
        'ai_last_time': 0.0,
        'ai_total_time': 0.0,

        # Turn tracking
        'current_turn': 'white',  # Human always plays white
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/start-game', methods=['POST'])
def start_game():
    """Start a new chess game."""
    global GAME_STATE
    data = request.get_json()
    ai_model = data.get('ai_model', 'claude-haiku-4.5')

    state = init_game_state(ai_model=ai_model)
    GAME_STATE = state

    return jsonify({
        'success': True,
        'game_state': get_client_state(state)
    })


@app.route('/api/game-state', methods=['GET'])
def get_game_state_route():
    """Get current game state."""
    global GAME_STATE
    if not GAME_STATE:
        GAME_STATE = init_game_state()
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

    if state['current_turn'] != 'white':
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

        # Get SAN before pushing
        san = board.san(move)
        board.push(move)

        state['fen'] = board.fen()
        state['move_history'].append(move_uci)
        state['move_history_san'].append(san)
        state['current_turn'] = 'black'

        # Check if game is over after human move
        if board.is_game_over():
            state['game_over'] = True
            if board.is_checkmate():
                state['winner'] = 'human'
                state['game_result'] = 'Checkmate! You win!'
            elif board.is_stalemate():
                state['winner'] = 'draw'
                state['game_result'] = 'Stalemate - Draw'
            elif board.is_insufficient_material():
                state['winner'] = 'draw'
                state['game_result'] = 'Insufficient material - Draw'
            elif board.is_fifty_moves():
                state['winner'] = 'draw'
                state['game_result'] = 'Fifty-move rule - Draw'
            elif board.is_repetition():
                state['winner'] = 'draw'
                state['game_result'] = 'Threefold repetition - Draw'

        GAME_STATE = state

        return jsonify({
            'success': True,
            'move': move_uci,
            'san': san,
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

    if state['current_turn'] != 'black':
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
        prompt = generate_chess_prompt(board_ascii, state['move_history'], legal_moves_list)

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
            else:  # anthropic
                ai_move_uci, reasoning = call_anthropic_chess_move(
                    prompt,
                    state['ai_model_id'],
                    state['ai_use_thinking']
                )
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

    # Get SAN before pushing
    san = board.san(move)
    board.push(move)

    state['fen'] = board.fen()
    state['move_history'].append(ai_move_uci)
    state['move_history_san'].append(san)
    state['current_turn'] = 'white'

    # Check if game is over after AI move
    if board.is_game_over():
        state['game_over'] = True
        if board.is_checkmate():
            state['winner'] = 'ai'
            state['game_result'] = 'Checkmate! AI wins!'
        elif board.is_stalemate():
            state['winner'] = 'draw'
            state['game_result'] = 'Stalemate - Draw'
        elif board.is_insufficient_material():
            state['winner'] = 'draw'
            state['game_result'] = 'Insufficient material - Draw'
        elif board.is_fifty_moves():
            state['winner'] = 'draw'
            state['game_result'] = 'Fifty-move rule - Draw'
        elif board.is_repetition():
            state['winner'] = 'draw'
            state['game_result'] = 'Threefold repetition - Draw'

    GAME_STATE = state

    return jsonify({
        'success': True,
        'move': ai_move_uci,
        'san': san,
        'reasoning': state['ai_reasoning'][:500] if state['ai_reasoning'] else '',
        'game_state': get_client_state(state)
    })


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
                    'promotion': chess.piece_name(move.promotion) if move.promotion else None
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

        'ai_display_name': state['ai_display_name'],
        'ai_reasoning': state['ai_reasoning'][:500] if state['ai_reasoning'] else '',
        'ai_last_time': state['ai_last_time'],
        'ai_total_time': state['ai_total_time'],
    }


if __name__ == '__main__':
    app.run(debug=True, port=5001)

// DOM Elements
const modalOverlay = document.getElementById('modal-overlay');
const aiModelSelect = document.getElementById('ai-model');
const btnStart = document.getElementById('btn-start');
const btnNewGame = document.getElementById('btn-new-game');
const gameContainer = document.getElementById('game-container');
const chessBoard = document.getElementById('chess-board');
const turnIndicator = document.getElementById('turn-indicator');
const gameStatus = document.getElementById('game-status');
const aiNameEl = document.getElementById('ai-name');
const aiDisplayNameEl = document.getElementById('ai-display-name');
const aiThinkingEl = document.getElementById('ai-thinking');
const aiTimerEl = document.getElementById('ai-timer');
const aiLastTimeEl = document.getElementById('ai-last-time');
const aiTotalTimeEl = document.getElementById('ai-total-time');
const aiReasoningEl = document.getElementById('ai-reasoning');
const moveHistoryEl = document.getElementById('move-history');
const promotionModal = document.getElementById('promotion-modal');

// Chess piece Unicode symbols
const PIECE_SYMBOLS = {
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F'
};

// Game state
let gameState = null;
let selectedSquare = null;
let legalMoves = [];
let isWaitingForAI = false;
let timerInterval = null;
let timerStartTime = null;
let pendingPromotion = null;

// Initialize
btnStart.addEventListener('click', startGame);
btnNewGame.addEventListener('click', showModal);

// Promotion piece selection
document.querySelectorAll('.promotion-piece').forEach(btn => {
    btn.addEventListener('click', () => {
        if (pendingPromotion) {
            const piece = btn.dataset.piece;
            const move = pendingPromotion.from + pendingPromotion.to + piece;
            promotionModal.classList.add('hidden');
            makeHumanMove(move);
            pendingPromotion = null;
        }
    });
});

function showModal() {
    modalOverlay.classList.remove('hidden');
    gameContainer.classList.add('hidden');
}

async function startGame() {
    const aiModel = aiModelSelect.value;

    try {
        const response = await fetch('/api/start-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ai_model: aiModel })
        });

        const data = await response.json();
        if (data.success) {
            gameState = data.game_state;
            modalOverlay.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            selectedSquare = null;
            legalMoves = [];
            isWaitingForAI = false;
            renderBoard();
            updateUI();
        }
    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game. Check console for details.');
    }
}

function renderBoard() {
    chessBoard.innerHTML = '';

    // Create 64 squares (from white's perspective: a1 bottom-left, h8 top-right)
    for (let rank = 7; rank >= 0; rank--) {
        for (let file = 0; file < 8; file++) {
            const square = document.createElement('div');
            const squareName = String.fromCharCode(97 + file) + (rank + 1);
            const isLight = (file + rank) % 2 === 1;

            square.className = `square ${isLight ? 'light' : 'dark'}`;
            square.dataset.square = squareName;

            // Add file labels on bottom row
            if (rank === 0) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'file-label';
                fileLabel.textContent = String.fromCharCode(97 + file);
                square.appendChild(fileLabel);
            }

            // Add rank labels on left column
            if (file === 0) {
                const rankLabel = document.createElement('span');
                rankLabel.className = 'rank-label';
                rankLabel.textContent = rank + 1;
                square.appendChild(rankLabel);
            }

            // Add piece if present
            if (gameState && gameState.board[squareName]) {
                const pieceData = gameState.board[squareName];
                const pieceEl = document.createElement('span');
                pieceEl.className = `piece ${pieceData.color}`;
                pieceEl.textContent = PIECE_SYMBOLS[pieceData.piece];
                square.appendChild(pieceEl);
            }

            square.addEventListener('click', () => handleSquareClick(squareName));
            chessBoard.appendChild(square);
        }
    }

    // Highlight selected square and legal moves
    updateHighlights();
}

function updateHighlights() {
    // Remove all highlights
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move', 'check');
    });

    // Highlight selected square
    if (selectedSquare) {
        const selectedEl = document.querySelector(`[data-square="${selectedSquare}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
    }

    // Highlight legal move destinations
    legalMoves.forEach(move => {
        const destEl = document.querySelector(`[data-square="${move.to}"]`);
        if (destEl) {
            destEl.classList.add('legal-move');
        }
    });

    // Highlight king in check
    if (gameState && gameState.is_check) {
        const kingPiece = gameState.current_turn === 'white' ? 'K' : 'k';
        for (const [square, pieceData] of Object.entries(gameState.board)) {
            if (pieceData.piece === kingPiece) {
                const kingEl = document.querySelector(`[data-square="${square}"]`);
                if (kingEl) {
                    kingEl.classList.add('check');
                }
                break;
            }
        }
    }
}

async function handleSquareClick(squareName) {
    if (!gameState || gameState.game_over || isWaitingForAI) return;
    if (gameState.current_turn !== 'white') return;

    // If a piece is already selected
    if (selectedSquare) {
        // Check if clicking on a legal destination
        const move = legalMoves.find(m => m.to === squareName);
        if (move) {
            // Check if it's a pawn promotion
            if (move.promotion) {
                pendingPromotion = { from: selectedSquare, to: squareName };
                promotionModal.classList.remove('hidden');
                return;
            }
            // Make the move
            makeHumanMove(move.uci);
            return;
        }

        // Clicking on the same square deselects
        if (squareName === selectedSquare) {
            selectedSquare = null;
            legalMoves = [];
            updateHighlights();
            return;
        }
    }

    // Try to select a piece
    const pieceData = gameState.board[squareName];
    if (pieceData && pieceData.color === 'white') {
        selectedSquare = squareName;
        await fetchLegalMovesFromSquare(squareName);
        updateHighlights();
    } else {
        selectedSquare = null;
        legalMoves = [];
        updateHighlights();
    }
}

async function fetchLegalMovesFromSquare(square) {
    try {
        const response = await fetch(`/api/legal-moves-from/${square}`);
        const data = await response.json();
        legalMoves = data.destinations || [];
    } catch (error) {
        console.error('Error fetching legal moves:', error);
        legalMoves = [];
    }
}

async function makeHumanMove(moveUci) {
    selectedSquare = null;
    legalMoves = [];

    try {
        const response = await fetch('/api/human-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ move: moveUci })
        });

        const data = await response.json();
        if (data.success) {
            gameState = data.game_state;
            renderBoard();
            updateUI();

            // If game is not over and it's AI's turn, get AI move
            if (!gameState.game_over && gameState.current_turn === 'black') {
                await getAIMove();
            }
        } else {
            console.error('Move error:', data.error);
            gameStatus.textContent = 'Invalid move: ' + data.error;
        }
    } catch (error) {
        console.error('Error making move:', error);
    }
}

function startTimer() {
    stopTimer();
    timerStartTime = Date.now();
    aiTimerEl.textContent = '0.0s';

    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - timerStartTime) / 1000;
        aiTimerEl.textContent = elapsed.toFixed(1) + 's';
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

async function getAIMove() {
    isWaitingForAI = true;
    aiThinkingEl.classList.remove('hidden');
    turnIndicator.textContent = "AI's turn (Black)";
    turnIndicator.className = 'turn-indicator ai-turn';
    startTimer();

    try {
        const response = await fetch('/api/ai-move', { method: 'POST' });
        const data = await response.json();

        stopTimer();
        aiThinkingEl.classList.add('hidden');
        isWaitingForAI = false;

        if (data.success) {
            gameState = data.game_state;
            renderBoard();
            updateUI();

            // Highlight the AI's move briefly
            highlightLastMove(data.move);
        } else {
            console.error('AI move error:', data.error);
            gameStatus.textContent = 'AI Error: ' + data.error;
        }
    } catch (error) {
        console.error('Error getting AI move:', error);
        stopTimer();
        aiThinkingEl.classList.add('hidden');
        isWaitingForAI = false;
        gameStatus.textContent = 'API Error - check console';
    }
}

function highlightLastMove(moveUci) {
    if (!moveUci || moveUci.length < 4) return;

    const from = moveUci.substring(0, 2);
    const to = moveUci.substring(2, 4);

    const fromEl = document.querySelector(`[data-square="${from}"]`);
    const toEl = document.querySelector(`[data-square="${to}"]`);

    if (fromEl) fromEl.classList.add('last-move');
    if (toEl) toEl.classList.add('last-move');

    // Remove highlight after delay
    setTimeout(() => {
        if (fromEl) fromEl.classList.remove('last-move');
        if (toEl) toEl.classList.remove('last-move');
    }, 2000);
}

function updateUI() {
    if (!gameState) return;

    // Update AI info
    aiNameEl.textContent = gameState.ai_display_name;
    aiDisplayNameEl.textContent = gameState.ai_display_name;
    aiLastTimeEl.textContent = gameState.ai_last_time + 's';
    aiTotalTimeEl.textContent = gameState.ai_total_time + 's';

    if (gameState.ai_reasoning) {
        aiReasoningEl.textContent = gameState.ai_reasoning;
    }

    // Update turn indicator
    if (gameState.game_over) {
        if (gameState.winner === 'human') {
            turnIndicator.textContent = 'You win!';
            turnIndicator.className = 'turn-indicator winner-human';
        } else if (gameState.winner === 'ai') {
            turnIndicator.textContent = 'AI wins!';
            turnIndicator.className = 'turn-indicator winner-ai';
        } else {
            turnIndicator.textContent = 'Draw!';
            turnIndicator.className = 'turn-indicator draw';
        }
        gameStatus.textContent = gameState.game_result;
    } else if (gameState.current_turn === 'white') {
        turnIndicator.textContent = 'Your turn (White)';
        turnIndicator.className = 'turn-indicator human-turn';
        if (gameState.is_check) {
            gameStatus.textContent = 'Check!';
        } else {
            gameStatus.textContent = '';
        }
    } else {
        turnIndicator.textContent = "AI's turn (Black)";
        turnIndicator.className = 'turn-indicator ai-turn';
    }

    // Update move history
    updateMoveHistory();
}

function updateMoveHistory() {
    if (!gameState || !gameState.move_history_san || gameState.move_history_san.length === 0) {
        moveHistoryEl.innerHTML = '<span class="no-moves">Game starting...</span>';
        return;
    }

    const moves = gameState.move_history_san;
    let html = '';

    for (let i = 0; i < moves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = moves[i];
        const blackMove = moves[i + 1] || '';

        html += `<div class="move-row">
            <span class="move-num">${moveNum}.</span>
            <span class="white-move">${whiteMove}</span>
            <span class="black-move">${blackMove}</span>
        </div>`;
    }

    moveHistoryEl.innerHTML = html;
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

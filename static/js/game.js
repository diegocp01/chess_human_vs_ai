// DOM Elements
const modalOverlay = document.getElementById('modal-overlay');
const aiProviderSelect = document.getElementById('ai-provider');
const providerChoices = document.querySelectorAll('.provider-choice');
const aiConnectionStatus = document.getElementById('ai-connection-status');
const aiConnectionCopy = document.getElementById('ai-connection-copy');
const aiModelSelect = document.getElementById('ai-model');
const modelError = document.getElementById('model-error');
const playerPicker = document.getElementById('player-picker');
const playerSelect = document.getElementById('player-select');
const btnNewPlayer = document.getElementById('btn-new-player');
const playerCreateForm = document.getElementById('player-create-form');
const playerUsernameInput = document.getElementById('player-username');
const playerProfileNote = document.getElementById('player-profile-note');
const playerProfileCopy = document.getElementById('player-profile-copy');
const playerError = document.getElementById('player-error');
const btnStart = document.getElementById('btn-start');
const btnNewGame = document.getElementById('btn-new-game');
const gameContainer = document.getElementById('game-container');
const chessBoard = document.getElementById('chess-board');
const boardStage = document.querySelector('.board-stage');
const voxelBoardContainer = document.getElementById('voxel-board');
const voxelBoardShell = document.getElementById('voxel-board-shell');
const resetVoxelViewButton = document.getElementById('reset-voxel-view');
const boardModeInputs = document.querySelectorAll('input[name="board-mode"]');
const commentatorToggle = document.getElementById('commentator-toggle');
const commentatorState = document.getElementById('commentator-state');
const commentatorCopy = document.getElementById('commentator-copy');
const historyHintPanel = document.getElementById('history-hint');
const historyHintMatch = document.getElementById('history-hint-match');
const historyHintCopy = document.getElementById('history-hint-copy');
const historyHintOpponent = document.getElementById('history-hint-opponent');
const coachPanel = document.getElementById('coach-panel');
const coachContent = document.getElementById('coach-content');
const coachModel = document.getElementById('coach-model');
const turnIndicator = document.getElementById('turn-indicator');
const gameStatus = document.getElementById('game-status');
const aiDisplayNameEl = document.getElementById('ai-display-name');
const trainedDecisionTrigger = document.getElementById('trained-decision-trigger');
const trainedDecisionPopover = document.getElementById('trained-decision-popover');
const aiPanelEl = trainedDecisionPopover?.closest('.ai-panel');
const railAiNameEl = document.getElementById('rail-ai-name');
const railAiStateEl = document.getElementById('rail-ai-state');
const railAiColorEl = document.getElementById('rail-ai-color');
const railHumanColorEl = document.getElementById('rail-human-color');
const railHumanNameEl = document.getElementById('rail-human-name');
const railHumanRatingEl = document.getElementById('rail-human-rating');
const railAiCapturesEl = document.getElementById('rail-ai-captures');
const railHumanCapturesEl = document.getElementById('rail-human-captures');
const opponentColorCopyEl = document.getElementById('opponent-color-copy');
const railAiAvatarEl = document.querySelector('.ai-avatar');
const railHumanAvatarEl = document.querySelector('.human-avatar');
const aiProviderBadgeEl = document.getElementById('ai-provider-badge');
const aiThinkingEl = document.getElementById('ai-thinking');
const aiTimerEl = document.getElementById('ai-timer');
const aiLastTimeEl = document.getElementById('ai-last-time');
const aiTotalTimeEl = document.getElementById('ai-total-time');
const aiReasoningEl = document.getElementById('ai-reasoning');
const moveHistoryEl = document.getElementById('move-history');
const moveCountEl = document.getElementById('move-count');
const promotionModal = document.getElementById('promotion-modal');
const btnOpenResults = document.getElementById('btn-open-results');
const resultsOverlay = document.getElementById('results-overlay');
const btnCloseResults = document.getElementById('btn-close-results');
const btnRetryResults = document.getElementById('btn-retry-results');
const resultsLoading = document.getElementById('results-loading');
const resultsError = document.getElementById('results-error');
const resultsErrorCopy = document.getElementById('results-error-copy');
const resultsContent = document.getElementById('results-content');
const resultsSubtitle = document.getElementById('results-subtitle');
const resultsGames = document.getElementById('results-games');
const resultsWins = document.getElementById('results-wins');
const resultsDraws = document.getElementById('results-draws');
const resultsLosses = document.getElementById('results-losses');
const resultsWinRate = document.getElementById('results-win-rate');
const resultsElo = document.getElementById('results-elo');
const resultsEloChange = document.getElementById('results-elo-change');
const resultsChart = document.getElementById('results-chart');
const resultsChartTooltip = document.getElementById('results-chart-tooltip');
const resultsChartEmpty = document.getElementById('results-chart-empty');
const resultsOpponents = document.getElementById('results-opponents');
const resultsRecentGames = document.getElementById('results-recent-games');
const resultsSourceCount = document.getElementById('results-source-count');
const resultsSourceCopy = document.getElementById('results-source-copy');
const resultsAccessibleRows = document.getElementById('results-accessible-rows');

// Bespoke SVG piece set. Every piece uses the same material system, then adds
// its own silhouette, bevels, engraving, and jewel details.
function renderPieceSvg(symbol, squareName) {
    const type = symbol.toLowerCase();
    const gradientId = `piece-${squareName}-${symbol === symbol.toUpperCase() ? 'ivory' : 'obsidian'}`;
    const art = {
        p: `
            <ellipse class="piece-ground" cx="50" cy="89" rx="27" ry="4"/>
            <path class="piece-main" d="M30 79c2-9 8-15 15-19v-8h10v8c8 4 14 10 16 19H30Z"/>
            <path class="piece-base" d="M25 79h50l5 8H20l5-8Z"/>
            <path class="piece-band" d="M33 49c0-4 3-7 7-8h20c4 1 7 4 7 8l-4 5H37l-4-5Z"/>
            <circle class="piece-main" cx="50" cy="29" r="14"/>
            <path class="piece-highlight" d="M42 24c2-5 7-8 12-7"/>
            <path class="piece-engraving" d="M35 74h30M31 82h38"/>
            <circle class="piece-jewel" cx="45" cy="26" r="2.2"/>
        `,
        r: `
            <ellipse class="piece-ground" cx="50" cy="90" rx="33" ry="4"/>
            <path class="piece-main" d="M28 31V15h10v8h8v-8h9v8h8v-8h10v16l-7 8H35l-7-8Z"/>
            <path class="piece-band" d="M31 35h38l-3 9H34l-3-9Z"/>
            <path class="piece-main" d="M36 43h28l5 32H31l5-32Z"/>
            <path class="piece-base" d="M27 72h46l3 8H24l3-8ZM20 80h60l5 8H15l5-8Z"/>
            <path class="piece-highlight" d="M39 47l-3 21M32 28h34"/>
            <path class="piece-engraving" d="M42 47v22M50 47v22M58 47v22M29 77h42M25 83h50"/>
            <path class="piece-inlay" d="M38 27h24v4H38z"/>
        `,
        n: `
            <ellipse class="piece-ground" cx="51" cy="90" rx="32" ry="4"/>
            <path class="piece-main" d="M31 76C31 66 32 60 36 56C41 51 40 47 34 46L19 48C15 48 13 46 14 43C15 41 17 40 19 39L42 18C46 14 50 11 55 10L58 2L67 17C73 24 77 33 78 44C79 55 78 66 76 76Z"/>
            <path class="piece-base" d="M23 76h53l5 11H18l5-11Z"/>
            <path class="piece-inlay" d="M56 12c8 7 13 17 15 28 2 11 2 23 1 36h-6c1-13 1-25-1-35-2-10-6-19-12-25l3-4Z"/>
            <path class="piece-highlight" d="M23 40 40 24M47 15c4-2 7-3 11-3"/>
            <path class="piece-engraving" d="M59 20c4 7 7 15 8 24M64 27c3 6 5 14 6 21M29 81h45"/>
            <circle class="piece-jewel" cx="43" cy="24" r="2.4"/>
            <path class="piece-cut knight-mouth" d="M16 46c3 1 5 1 8 1"/>
            <circle class="piece-inlay" cx="21" cy="43" r="1.4"/>
        `,
        b: `
            <ellipse class="piece-ground" cx="50" cy="90" rx="30" ry="4"/>
            <path class="piece-main" d="M50 12c9 8 15 15 15 24 0 8-5 14-11 18l6 8 11 17H29l11-17 6-8c-7-4-11-10-11-18 0-9 6-16 15-24Z"/>
            <path class="piece-base" d="M27 76h46l4 11H23l4-11Z"/>
            <path class="piece-band" d="M35 58h30l4 8H31l4-8Z"/>
            <path class="piece-cut" d="M56 22 43 43"/>
            <path class="piece-highlight" d="M43 28c-3 7-1 14 5 18"/>
            <path class="piece-engraving" d="M38 72h24M29 81h42"/>
            <circle class="piece-jewel" cx="50" cy="17" r="2"/>
        `,
        q: `
            <ellipse class="piece-ground" cx="50" cy="90" rx="35" ry="4"/>
            <path class="piece-main" d="M23 34 31 19l12 17 7-22 7 22 12-17 8 15-9 27H32l-9-27Z"/>
            <path class="piece-band" d="M30 55h40l-2 10H32l-2-10Z"/>
            <path class="piece-main" d="M35 64h30l8 15H27l8-15Z"/>
            <path class="piece-base" d="M24 77h52l5 10H19l5-10Z"/>
            <circle class="piece-jewel" cx="28" cy="17" r="5"/>
            <circle class="piece-jewel" cx="42" cy="12" r="5"/>
            <circle class="piece-jewel crown-jewel" cx="50" cy="9" r="5.5"/>
            <circle class="piece-jewel" cx="58" cy="12" r="5"/>
            <circle class="piece-jewel" cx="72" cy="17" r="5"/>
            <path class="piece-highlight" d="M33 29 39 48M49 21v29M67 29l-6 19"/>
            <path class="piece-engraving" d="M34 59h32M34 69h32M27 81h46"/>
            <path class="piece-inlay" d="M43 43h14l-2 8H45l-2-8Z"/>
        `,
        k: `
            <ellipse class="piece-ground" cx="50" cy="90" rx="35" ry="4"/>
            <path class="piece-main" d="M47 9h6v9h9v6h-9v8h-6v-8h-9v-6h9V9Z"/>
            <path class="piece-main" d="M50 29c7 0 12 5 13 11 9-2 17 5 17 14 0 9-8 15-17 16H37c-9-1-17-7-17-16 0-9 8-16 17-14 1-6 6-11 13-11Z"/>
            <path class="piece-band" d="M31 64h38l-1 9H32l-1-9Z"/>
            <path class="piece-main" d="M35 72h30l8 8H27l8-8Z"/>
            <path class="piece-base" d="M23 78h54l5 9H18l5-9Z"/>
            <path class="piece-cut" d="M50 35v27M36 45c-7 1-10 5-10 10M64 45c7 1 10 5 10 10"/>
            <path class="piece-highlight" d="M39 43c3-5 7-8 11-8"/>
            <path class="piece-engraving" d="M36 68h28M28 82h44"/>
            <circle class="piece-jewel crown-jewel" cx="50" cy="42" r="3"/>
        `
    }[type];

    const detailedArt = art.replaceAll(
        'class="piece-jewel',
        `fill="url(#${gradientId}-jewel)" class="piece-jewel`
    );

    return `
        <svg class="piece-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="${gradientId}-body" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="var(--piece-glint)"/>
                    <stop offset=".28" stop-color="var(--piece-light)"/>
                    <stop offset=".58" stop-color="var(--piece-mid)"/>
                    <stop offset="1" stop-color="var(--piece-deep)"/>
                </linearGradient>
                <linearGradient id="${gradientId}-base" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="var(--piece-light)"/>
                    <stop offset=".48" stop-color="var(--piece-mid)"/>
                    <stop offset="1" stop-color="var(--piece-deep)"/>
                </linearGradient>
                <radialGradient id="${gradientId}-jewel" cx=".35" cy=".3" r=".75">
                    <stop offset="0" stop-color="var(--jewel-glint)"/>
                    <stop offset=".3" stop-color="var(--jewel)"/>
                    <stop offset="1" stop-color="var(--jewel-deep)"/>
                </radialGradient>
            </defs>
            <g class="piece-sculpture" fill="url(#${gradientId}-body)">
                ${detailedArt}
            </g>
        </svg>
    `;
}

// Game state
let gameState = null;
let selectedSquare = null;
let legalMoves = [];
let isWaitingForAI = false;
let timerInterval = null;
let timerStartTime = null;
let pendingPromotion = null;
let modelRequestId = 0;
let lastMove = null;
let isMoveAnimating = false;
let gameAudioContext = null;
let voxelBoard = null;
let voxelBoardAvailable = false;
let selectedBoardMode = (
    document.querySelector('input[name="board-mode"]:checked')?.value || 'voxel'
);
let commentatorEnabled = false;
let commentatorVoice = null;
let coachRequestGameId = null;
let selectedPlayer = null;
let profileLoading = true;
let historyHintRequestId = 0;
let lastHistoryHintKey = null;
let resultsDashboardData = null;
let resultsChartPoints = [];
let resultsLastTrigger = null;
let resultsResizeFrame = null;
let trainedDecisionPinned = false;
let dragState = null;
let suppressBoardClick = false;
let suppressBoardClickTimer = null;
let legalMovesPromise = null;

// Initialize
btnStart.addEventListener('click', startGame);
btnNewGame.addEventListener('click', showModal);
btnOpenResults?.addEventListener('click', openResultsDashboard);
btnCloseResults?.addEventListener('click', closeResultsDashboard);
btnRetryResults?.addEventListener('click', loadResultsDashboard);
resultsOverlay?.addEventListener('click', event => {
    if (event.target === resultsOverlay) closeResultsDashboard();
});
playerSelect?.addEventListener('change', selectLocalPlayer);
btnNewPlayer?.addEventListener('click', () => {
    playerCreateForm.classList.toggle('hidden');
    if (!playerCreateForm.classList.contains('hidden')) {
        playerUsernameInput.focus();
    }
});
playerCreateForm?.addEventListener('submit', createLocalPlayer);
commentatorToggle?.addEventListener('click', toggleCommentator);
trainedDecisionTrigger?.addEventListener('click', () => {
    trainedDecisionPinned = !trainedDecisionPinned;
    aiPanelEl?.classList.toggle('decision-pinned', trainedDecisionPinned);
    trainedDecisionTrigger.setAttribute('aria-expanded', String(trainedDecisionPinned));
});
boardModeInputs.forEach(input => {
    input.addEventListener('change', () => {
        if (!input.checked) return;
        selectedBoardMode = input.value;
        applyBoardMode();
    });
});
aiProviderSelect.addEventListener('change', loadModels);
providerChoices.forEach(choice => {
    choice.addEventListener('click', () => {
        const provider = choice.dataset.provider;
        if (provider === aiProviderSelect.value) return;
        aiProviderSelect.value = provider;
        aiProviderSelect.dispatchEvent(new Event('change'));
    });
});
syncProviderChoices(aiProviderSelect.value);
loadPlayers();
loadModels();
initializeVoxelBoard();

document.addEventListener('pointerdown', unlockGameAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockGameAudio, { once: true, capture: true });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !resultsOverlay?.classList.contains('hidden')) {
        closeResultsDashboard();
    }
    if (event.key === 'Escape' && trainedDecisionPinned) {
        trainedDecisionPinned = false;
        aiPanelEl?.classList.remove('decision-pinned');
        trainedDecisionTrigger?.setAttribute('aria-expanded', 'false');
        trainedDecisionTrigger?.focus();
    }
});
window.addEventListener('resize', () => {
    if (!resultsDashboardData || resultsOverlay?.classList.contains('hidden')) return;
    window.cancelAnimationFrame(resultsResizeFrame);
    resultsResizeFrame = window.requestAnimationFrame(() => {
        renderResultsChart(resultsDashboardData.timeline);
    });
});
resultsChart?.addEventListener('pointermove', handleResultsChartPointer);
resultsChart?.addEventListener('pointerleave', hideResultsChartTooltip);
chessBoard.addEventListener('focusin', () => {
    boardStage?.classList.add('keyboard-board-active');
    voxelBoard?.setActive(false);
});
chessBoard.addEventListener('focusout', () => {
    window.setTimeout(() => {
        if (!chessBoard.contains(document.activeElement)) {
            boardStage?.classList.remove('keyboard-board-active');
            applyBoardMode();
        }
    }, 0);
});
chessBoard.addEventListener('pointerdown', handleBoardPointerDown);

const promotionButtons = document.querySelectorAll('.promotion-piece');
promotionButtons.forEach(btn => {
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
renderPromotionChoices('white');

function renderPromotionChoices(color) {
    promotionButtons.forEach(btn => {
        const type = btn.dataset.piece;
        const label = btn.getAttribute('aria-label').replace('Promote to ', '');
        const symbol = color === 'white' ? type.toUpperCase() : type;
        btn.innerHTML = `
            <span class="piece piece-${type} ${color} promotion-piece-art">
                ${renderPieceSvg(symbol, `promotion-${type}-${color}`)}
            </span>
            <small>${label}</small>
        `;
    });
}

async function initializeVoxelBoard() {
    if (!voxelBoardContainer) return;

    try {
        const { VoxelChessBoard } = await import('/static/js/voxel-board.js');
        voxelBoard = new VoxelChessBoard({
            container: voxelBoardContainer,
            resetButton: resetVoxelViewButton,
            onSquareSelect: square => handleSquareClick(square),
            onSquareDrop: (from, to) => handleVoxelDrop(from, to),
            onPieceGrab: square => {
                if (selectedSquare !== square) selectPiece(square);
            },
            canDragSquare: square => isHumanPieceSquare(square),
        });
        voxelBoardAvailable = true;
        voxelBoardShell?.classList.remove('webgl-error');
        applyBoardMode();
        syncVoxelBoard();
    } catch (error) {
        console.error('Voxel board could not start. Falling back to the 2D board:', error);
        voxelBoardAvailable = false;
        voxelBoardShell?.classList.add('webgl-error');
        selectBoardMode('classic');
    }
}

function selectBoardMode(mode) {
    selectedBoardMode = mode === 'classic' ? 'classic' : 'voxel';
    boardModeInputs.forEach(input => {
        input.checked = input.value === selectedBoardMode;
    });
    applyBoardMode();
}

function applyBoardMode() {
    const gameIsVisible = (
        Boolean(gameState)
        && !gameContainer.classList.contains('hidden')
    );
    const useVoxel = (
        selectedBoardMode === 'voxel'
        && voxelBoardAvailable
        && gameIsVisible
    );

    boardStage?.classList.toggle('voxel-ready', useVoxel);
    boardStage?.setAttribute('data-board-mode', useVoxel ? 'voxel' : 'classic');
    voxelBoard?.setActive(useVoxel);
}

function getCheckedKingSquare() {
    if (!gameState?.is_check) return null;
    const kingPiece = gameState.current_turn === 'white' ? 'K' : 'k';
    return Object.entries(gameState.board).find(
        ([, pieceData]) => pieceData.piece === kingPiece
    )?.[0] || null;
}

function syncVoxelBoard() {
    if (!voxelBoard || !gameState) return;
    voxelBoard.sync({
        board: gameState.board,
        humanColor: gameState.human_color,
        selectedSquare,
        legalMoves,
        lastMove,
        checkSquare: getCheckedKingSquare(),
        interactive: (
            !gameState.game_over
            && !isWaitingForAI
            && !isMoveAnimating
            && gameState.current_turn === gameState.human_color
        ),
    });
}

function updateVoxelHighlights() {
    voxelBoard?.updateHighlights({
        selectedSquare,
        legalMoves,
        lastMove,
        checkSquare: getCheckedKingSquare(),
    });
}

function updateVoxelInteractivity() {
    voxelBoard?.setInteractive(
        Boolean(
            gameState
            && !gameState.game_over
            && !isWaitingForAI
            && !isMoveAnimating
            && gameState.current_turn === gameState.human_color
        )
    );
}

function chooseCommentatorVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    const preferredNames = [
        'Daniel',
        'Samantha',
        'Alex',
        'Karen',
        'Google UK English Male',
        'Microsoft Guy Online',
    ];
    commentatorVoice = preferredNames
        .map(name => voices.find(voice => voice.name.includes(name)))
        .find(Boolean)
        || voices.find(voice => /^en[-_](GB|US)/i.test(voice.lang))
        || voices.find(voice => /^en/i.test(voice.lang))
        || voices[0];
}

if ('speechSynthesis' in window) {
    chooseCommentatorVoice();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', chooseCommentatorVoice);
    } else {
        window.speechSynthesis.onvoiceschanged = chooseCommentatorVoice;
    }
}

function toggleCommentator() {
    if (!('speechSynthesis' in window)) {
        commentatorToggle.setAttribute('aria-pressed', 'false');
        commentatorToggle.setAttribute('aria-label', 'Commentator unavailable');
        commentatorToggle.setAttribute('title', 'Commentator unavailable');
        commentatorToggle.disabled = true;
        commentatorState.textContent = 'Commentator unavailable';
        commentatorCopy.textContent = 'Text-to-speech is not available in this browser.';
        return;
    }

    commentatorEnabled = !commentatorEnabled;
    commentatorToggle.setAttribute('aria-pressed', String(commentatorEnabled));
    const nextAction = commentatorEnabled
        ? 'Turn commentator off'
        : 'Turn commentator on';
    commentatorToggle.setAttribute('aria-label', nextAction);
    commentatorToggle.setAttribute('title', nextAction);
    commentatorState.textContent = commentatorEnabled ? 'Commentator on' : 'Commentator off';

    if (!commentatorEnabled) {
        window.speechSynthesis?.cancel();
        commentatorCopy.textContent = 'Spoken commentary is off.';
        return;
    }

    const openingLine = gameState
        ? `Commentary is live. You command the ${gameState.human_color} pieces against ${gameState.ai_display_name}.`
        : 'Commentary is live. The match will be narrated locally when play begins.';
    announceCommentary(openingLine);
}

function announceCommentary(text) {
    commentatorCopy.textContent = text;
    if (!commentatorEnabled || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = commentatorVoice;
    utterance.lang = commentatorVoice?.lang || 'en-US';
    utterance.rate = 0.94;
    utterance.pitch = 0.91;
    utterance.volume = 0.88;
    window.speechSynthesis.speak(utterance);
}

function getMovePieceName(symbol) {
    const names = {
        p: 'pawn',
        n: 'knight',
        b: 'bishop',
        r: 'rook',
        q: 'queen',
        k: 'king',
    };
    return names[symbol?.toLowerCase()] || 'piece';
}

function getPositionInsight(moveUci, movingSymbol, capture, nextState) {
    const from = moveUci.slice(0, 2);
    const to = moveUci.slice(2, 4);
    const type = movingSymbol?.toLowerCase();

    if (nextState?.game_over) {
        return nextState.game_result || 'The game is over.';
    }
    if (nextState?.is_check) {
        return 'The king is in check, and the reply must be precise.';
    }
    if (['e1g1', 'e1c1', 'e8g8', 'e8c8'].includes(moveUci.slice(0, 4))) {
        return 'The king castles into safety and the rook joins the position.';
    }
    if (capture) {
        return 'Material comes off the board, changing the balance of the position.';
    }
    if (['d4', 'd5', 'e4', 'e5'].includes(to)) {
        return 'The center is under fresh pressure.';
    }
    if (['n', 'b'].includes(type) && ['1', '8'].includes(from[1])) {
        return 'Another piece develops toward the center.';
    }
    if (type === 'p' && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
        return 'The pawn advances two squares and claims new space.';
    }
    return 'The position shifts, and both sides reassess their plans.';
}

function buildMoveCommentary({
    moveUci,
    capture,
    actor,
    previousState,
    nextState,
}) {
    if (!moveUci) return 'The board has changed.';
    const from = moveUci.slice(0, 2);
    const to = moveUci.slice(2, 4);
    const movingSymbol = capture?.attacker || previousState?.board?.[from]?.piece;
    const movingPiece = getMovePieceName(movingSymbol);
    const subject = actor === 'human'
        ? 'You'
        : (previousState?.ai_display_name || nextState?.ai_display_name || 'The opponent');

    let action;
    if (capture) {
        const defeatedPiece = getMovePieceName(capture.piece);
        action = `${subject} sends the ${movingPiece} from ${from.toUpperCase()} to ${to.toUpperCase()}, taking the ${defeatedPiece}.`;
    } else if (['e1g1', 'e1c1', 'e8g8', 'e8c8'].includes(moveUci.slice(0, 4))) {
        action = `${subject} castles.`;
    } else if (moveUci.length > 4) {
        const promotedPiece = getMovePieceName(moveUci[4]);
        action = `${subject} advances from ${from.toUpperCase()} to ${to.toUpperCase()} and promotes to a ${promotedPiece}.`;
    } else {
        action = `${subject} moves the ${movingPiece} from ${from.toUpperCase()} to ${to.toUpperCase()}.`;
    }

    return `${action} ${getPositionInsight(moveUci, movingSymbol, capture, nextState)}`;
}

async function showModal() {
    modalOverlay.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    document.body.classList.add('modal-open');
    applyBoardMode();
    await Promise.all([loadPlayers(), loadModels()]);
}

function syncStartButtonState() {
    btnStart.disabled = (
        profileLoading
        || !selectedPlayer
        || aiModelSelect.disabled
        || !aiModelSelect.value
    );
}

function renderSelectedPlayer(player) {
    selectedPlayer = player || null;
    if (!player) {
        playerProfileNote.classList.remove('hidden');
        playerProfileCopy.textContent = 'Create a player to begin.';
        syncStartButtonState();
        return;
    }

    playerProfileNote.classList.add('hidden');
    playerProfileCopy.textContent = '';
    syncStartButtonState();
}

function openResultsDashboard() {
    resultsLastTrigger = document.activeElement;
    resultsOverlay.classList.remove('hidden');
    modalOverlay.setAttribute('aria-hidden', 'true');
    btnCloseResults.focus();
    loadResultsDashboard();
}

function closeResultsDashboard() {
    resultsOverlay.classList.add('hidden');
    modalOverlay.removeAttribute('aria-hidden');
    hideResultsChartTooltip();
    if (resultsLastTrigger instanceof HTMLElement) resultsLastTrigger.focus();
}

async function loadResultsDashboard() {
    resultsLoading.classList.remove('hidden');
    resultsError.classList.add('hidden');
    resultsContent.classList.add('hidden');
    resultsDashboardData = null;
    hideResultsChartTooltip();

    if (!selectedPlayer) {
        renderResultsError('Create or select a local player profile first.');
        return;
    }

    try {
        const response = await fetch(
            `/api/results?player_id=${encodeURIComponent(selectedPlayer.id)}`
        );
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Could not read the local results history.');
        }
        resultsDashboardData = data;
        renderResultsDashboard(data);
    } catch (error) {
        console.error('Results dashboard error:', error);
        renderResultsError(error.message);
    }
}

function renderResultsError(message) {
    resultsLoading.classList.add('hidden');
    resultsContent.classList.add('hidden');
    resultsErrorCopy.textContent = message;
    resultsError.classList.remove('hidden');
}

function renderResultsDashboard(data) {
    const { summary, player, source } = data;
    resultsSubtitle.textContent = (
        `${player.username}'s completed games, pulled directly from the local JSON history.`
    );
    resultsGames.textContent = String(summary.games);
    resultsWins.textContent = String(summary.wins);
    resultsDraws.textContent = String(summary.draws);
    resultsLosses.textContent = String(summary.losses);
    resultsWinRate.textContent = `${formatNumber(summary.win_rate)}% win rate`;
    resultsElo.textContent = String(summary.current_elo);
    resultsEloChange.textContent = summary.elo_change
        ? `${formatSignedNumber(summary.elo_change)} across recorded games`
        : 'No rated change';
    resultsSourceCount.textContent = (
        `${source.completed_games} completed · ${source.unfinished_games} unfinished`
    );
    resultsSourceCopy.textContent = (
        `${source.files_scanned} local JSON file${source.files_scanned === 1 ? '' : 's'} scanned`
        + ` · ${source.completed_games} completed result`
        + `${source.completed_games === 1 ? '' : 's'} for ${player.username}`
        + ` · refreshed ${formatDateTime(source.generated_at)}`
    );

    renderResultsOpponents(data.opponents);
    renderRecentResults(data.recent_games);
    renderAccessibleResults(data.timeline);
    resultsLoading.classList.add('hidden');
    resultsError.classList.add('hidden');
    resultsContent.classList.remove('hidden');
    window.requestAnimationFrame(() => renderResultsChart(data.timeline));
}

function renderResultsOpponents(opponents) {
    resultsOpponents.replaceChildren();
    if (!opponents.length) {
        const empty = document.createElement('p');
        empty.className = 'results-opponents-empty';
        empty.textContent = 'Opponent breakdowns will appear after your first completed game.';
        resultsOpponents.appendChild(empty);
        return;
    }

    opponents.slice(0, 6).forEach(opponent => {
        const row = document.createElement('article');
        row.className = 'results-opponent-row';

        const top = document.createElement('div');
        top.className = 'results-opponent-top';
        const name = document.createElement('strong');
        name.textContent = opponent.model;
        const rate = document.createElement('span');
        rate.textContent = `${formatNumber(opponent.win_rate)}% wins`;
        top.append(name, rate);

        const meta = document.createElement('div');
        meta.className = 'results-opponent-meta';
        const games = document.createElement('span');
        games.textContent = `${opponent.games} game${opponent.games === 1 ? '' : 's'}`;
        const record = document.createElement('span');
        record.textContent = `${opponent.wins}W · ${opponent.draws}D · ${opponent.losses}L`;
        meta.append(games, record);

        const bar = document.createElement('div');
        bar.className = 'results-opponent-bar';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', `${opponent.model} win rate`);
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', String(opponent.win_rate));
        const fill = document.createElement('span');
        fill.style.width = `${Math.max(0, Math.min(100, opponent.win_rate))}%`;
        bar.appendChild(fill);

        row.append(top, meta, bar);
        resultsOpponents.appendChild(row);
    });
}

function renderRecentResults(games) {
    resultsRecentGames.replaceChildren();
    if (!games.length) {
        const empty = document.createElement('p');
        empty.className = 'results-recent-empty';
        empty.textContent = 'No completed games yet. Your first result will be saved here.';
        resultsRecentGames.appendChild(empty);
        return;
    }

    games.forEach(game => {
        const row = document.createElement('article');
        row.className = 'results-game-row';

        const result = document.createElement('span');
        result.className = `results-game-result ${game.result}`;
        result.textContent = game.result;

        const opponent = document.createElement('span');
        opponent.className = 'results-game-opponent';
        const opponentName = document.createElement('strong');
        opponentName.textContent = game.opponent;
        const playedAt = document.createElement('small');
        playedAt.textContent = formatDateTime(game.played_at);
        opponent.append(opponentName, playedAt);

        const detail = document.createElement('span');
        detail.className = 'results-game-detail';
        const gameColor = document.createElement('strong');
        gameColor.textContent = `${capitalize(game.human_color || 'unknown')} · ${game.move_count} plies`;
        const insight = document.createElement('small');
        insight.textContent = game.coach_insight || `${game.human_move_count} human moves recorded`;
        detail.append(gameColor, insight);

        const rating = document.createElement('span');
        rating.className = 'results-game-rating';
        const ratingAfter = document.createElement('strong');
        ratingAfter.textContent = game.elo_after == null ? 'Unrated' : `${game.elo_after} Elo`;
        const ratingDelta = document.createElement('small');
        ratingDelta.textContent = game.elo_delta == null
            ? 'No Elo change'
            : `${formatSignedNumber(game.elo_delta)} rating`;
        rating.append(ratingAfter, ratingDelta);

        row.append(result, opponent, detail, rating);
        resultsRecentGames.appendChild(row);
    });
}

function renderAccessibleResults(games) {
    resultsAccessibleRows.replaceChildren();
    games.forEach(game => {
        const row = document.createElement('tr');
        [
            formatDateTime(game.played_at),
            game.result,
            game.opponent,
            game.cumulative_wins,
        ].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.appendChild(cell);
        });
        resultsAccessibleRows.appendChild(row);
    });
}

function renderResultsChart(games) {
    if (!resultsChart) return;
    const rect = resultsChart.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    const ratio = Math.max(1, window.devicePixelRatio || 1);
    resultsChart.width = Math.round(rect.width * ratio);
    resultsChart.height = Math.round(rect.height * ratio);
    const context = resultsChart.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    resultsChartPoints = [];
    resultsChartEmpty.classList.toggle('hidden', games.length > 0);

    const margin = { top: 18, right: 18, bottom: 38, left: 48 };
    const chartWidth = Math.max(1, rect.width - margin.left - margin.right);
    const chartHeight = Math.max(1, rect.height - margin.top - margin.bottom);
    const maxWins = Math.max(1, ...games.map(game => game.cumulative_wins));
    const yStep = maxWins <= 4 ? 1 : Math.ceil(maxWins / 4);
    const yMax = Math.max(1, Math.ceil(maxWins / yStep) * yStep);

    context.lineWidth = 1;
    context.font = '9px "IBM Plex Mono", monospace';
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    for (let value = 0; value <= yMax; value += yStep) {
        const y = margin.top + chartHeight - (value / yMax) * chartHeight;
        context.strokeStyle = value === 0
            ? 'rgba(215, 164, 72, 0.25)'
            : 'rgba(205, 212, 214, 0.08)';
        context.beginPath();
        context.moveTo(margin.left, y);
        context.lineTo(margin.left + chartWidth, y);
        context.stroke();
        context.fillStyle = '#687073';
        context.fillText(String(value), margin.left - 10, y);
    }

    context.save();
    context.translate(12, margin.top + chartHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = '#747b7d';
    context.font = '8px "IBM Plex Mono", monospace';
    context.textAlign = 'center';
    context.fillText('CUMULATIVE WINS', 0, 0);
    context.restore();

    if (!games.length) return;

    const timestamps = games.map((game, index) => {
        const parsed = Date.parse(game.played_at);
        return Number.isFinite(parsed) ? parsed : index;
    });
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const sameTime = minTime === maxTime;
    const xForIndex = index => {
        if (games.length === 1) return margin.left + chartWidth / 2;
        const progress = sameTime
            ? index / (games.length - 1)
            : (timestamps[index] - minTime) / (maxTime - minTime);
        return margin.left + progress * chartWidth;
    };
    const yForWins = wins => (
        margin.top + chartHeight - (wins / yMax) * chartHeight
    );

    context.strokeStyle = '#c9953b';
    context.lineWidth = 1.6;
    context.beginPath();
    games.forEach((game, index) => {
        const x = xForIndex(index);
        const y = yForWins(game.cumulative_wins);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.stroke();

    games.forEach((game, index) => {
        const x = xForIndex(index);
        const y = yForWins(game.cumulative_wins);
        drawResultMarker(context, x, y, game.result);
        resultsChartPoints.push({ x, y, game });
    });

    const labelIndexes = new Set(
        games.length <= 4
            ? games.map((_, index) => index)
            : [0, Math.round((games.length - 1) / 3), Math.round((games.length - 1) * 2 / 3), games.length - 1]
    );
    context.fillStyle = '#687073';
    context.font = '8px "IBM Plex Mono", monospace';
    context.textBaseline = 'top';
    labelIndexes.forEach(index => {
        const x = xForIndex(index);
        context.textAlign = index === 0 ? 'left' : index === games.length - 1 ? 'right' : 'center';
        context.fillText(formatShortDate(games[index].played_at), x, margin.top + chartHeight + 13);
    });
}

function drawResultMarker(context, x, y, result) {
    context.save();
    context.lineWidth = 1.7;
    if (result === 'win') {
        context.fillStyle = '#dca94b';
        context.strokeStyle = '#f0cd7b';
        context.beginPath();
        context.arc(x, y, 5.2, 0, Math.PI * 2);
        context.fill();
        context.stroke();
    } else if (result === 'draw') {
        context.fillStyle = '#0d1216';
        context.strokeStyle = '#d4d1c8';
        context.translate(x, y);
        context.rotate(Math.PI / 4);
        context.fillRect(-4.3, -4.3, 8.6, 8.6);
        context.strokeRect(-4.3, -4.3, 8.6, 8.6);
    } else {
        context.fillStyle = '#0d1216';
        context.strokeStyle = '#846948';
        context.fillRect(x - 4.5, y - 4.5, 9, 9);
        context.strokeRect(x - 4.5, y - 4.5, 9, 9);
    }
    context.restore();
}

function handleResultsChartPointer(event) {
    if (!resultsChartPoints.length) return;
    const rect = resultsChart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let nearest = null;
    let nearestDistance = Infinity;
    resultsChartPoints.forEach(point => {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) {
            nearest = point;
            nearestDistance = distance;
        }
    });
    if (!nearest || nearestDistance > 18) {
        hideResultsChartTooltip();
        return;
    }

    const game = nearest.game;
    resultsChartTooltip.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = `${capitalize(game.result)} · Game ${game.game_number}`;
    const opponent = document.createElement('span');
    opponent.textContent = `${game.opponent} · ${formatDateTime(game.played_at)}`;
    const details = document.createElement('span');
    details.textContent = (
        `${game.cumulative_wins} cumulative win${game.cumulative_wins === 1 ? '' : 's'}`
        + `${game.elo_delta == null ? '' : ` · ${formatSignedNumber(game.elo_delta)} Elo`}`
    );
    resultsChartTooltip.append(title, opponent, details);
    resultsChartTooltip.style.left = `${nearest.x}px`;
    resultsChartTooltip.style.top = `${nearest.y}px`;
    resultsChartTooltip.classList.remove('hidden');
}

function hideResultsChartTooltip() {
    resultsChartTooltip?.classList.add('hidden');
}

function formatNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value || 0);
}

function formatSignedNumber(value) {
    const numeric = Number(value || 0);
    return `${numeric > 0 ? '+' : ''}${numeric}`;
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatShortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
    }).format(date);
}

async function loadPlayers() {
    profileLoading = true;
    syncStartButtonState();
    playerError.classList.add('hidden');

    try {
        const response = await fetch('/api/players');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load local players.');

        playerSelect.replaceChildren();
        data.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.username} · ${player.elo} Elo`;
            option.dataset.player = JSON.stringify(player);
            option.selected = player.id === data.current_player_id;
            playerSelect.appendChild(option);
        });

        if (data.players.length === 0) {
            playerPicker.classList.add('hidden');
            playerCreateForm.classList.remove('hidden');
            renderSelectedPlayer(null);
        } else {
            playerPicker.classList.remove('hidden');
            playerCreateForm.classList.add('hidden');
            const current = data.players.find(
                player => player.id === data.current_player_id
            ) || data.players[0];
            playerSelect.value = current.id;
            renderSelectedPlayer(current);
            if (!data.current_player_id) {
                await selectLocalPlayer();
            }
        }
    } catch (error) {
        selectedPlayer = null;
        playerError.textContent = error.message;
        playerError.classList.remove('hidden');
    } finally {
        profileLoading = false;
        syncStartButtonState();
    }
}

async function selectLocalPlayer() {
    const playerId = playerSelect.value;
    if (!playerId) return;
    profileLoading = true;
    syncStartButtonState();
    playerError.classList.add('hidden');

    try {
        const response = await fetch('/api/players/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not select player.');
        renderSelectedPlayer(data.player);
    } catch (error) {
        playerError.textContent = error.message;
        playerError.classList.remove('hidden');
    } finally {
        profileLoading = false;
        syncStartButtonState();
    }
}

async function createLocalPlayer(event) {
    event.preventDefault();
    const username = playerUsernameInput.value.trim();
    if (!username) return;
    profileLoading = true;
    syncStartButtonState();
    playerError.classList.add('hidden');

    try {
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not create player.');
        playerUsernameInput.value = '';
        await loadPlayers();
    } catch (error) {
        playerError.textContent = error.message;
        playerError.classList.remove('hidden');
        profileLoading = false;
        syncStartButtonState();
    }
}

function syncProviderChoices(provider) {
    providerChoices.forEach(choice => {
        const selected = choice.dataset.provider === provider;
        choice.classList.toggle('selected', selected);
        choice.setAttribute('aria-checked', String(selected));
    });
}

function updateProviderNote(provider) {
    syncProviderChoices(provider);
}

function setAIConnectionStatus(connected) {
    aiConnectionStatus?.classList.toggle('connected', connected);
    aiConnectionStatus?.classList.toggle('disconnected', !connected);
    if (aiConnectionCopy) {
        aiConnectionCopy.textContent = connected
            ? 'AI Model connected'
            : 'AI Model disconnected';
    }
}

async function loadModels() {
    const provider = aiProviderSelect.value;
    const requestId = ++modelRequestId;
    updateProviderNote(provider);
    setAIConnectionStatus(false);

    aiModelSelect.disabled = true;
    aiModelSelect.innerHTML = '<option>Loading models...</option>';
    aiModelSelect.closest('.select-shell').classList.add('loading');
    syncStartButtonState();
    modelError.classList.add('hidden');
    modelError.textContent = '';

    try {
        const response = await fetch(`/api/models?provider=${encodeURIComponent(provider)}`);
        const data = await response.json();

        // Ignore an older response if the user changed providers quickly.
        if (requestId !== modelRequestId) return;
        if (!response.ok) {
            throw new Error(data.error || 'Could not load models.');
        }

        aiModelSelect.innerHTML = '';
        data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            const alreadySaysDefault = /\bdefault\b/i.test(model.display);
            option.textContent = model.coming_soon
                ? `${model.display} — Coming soon`
                : model.display + (
                    model.is_default && !alreadySaysDefault ? ' (Default)' : ''
                );
            option.disabled = model.available === false;
            option.selected = Boolean(
                model.is_default && model.available !== false
            );
            if (model.description) option.title = model.description;
            aiModelSelect.appendChild(option);
        });

        if (data.models.length === 0) {
            throw new Error('No models are available for this provider.');
        }

        aiModelSelect.disabled = false;
        aiModelSelect.closest('.select-shell').classList.remove('loading');
        setAIConnectionStatus(true);
        syncStartButtonState();
    } catch (error) {
        if (requestId !== modelRequestId) return;
        setAIConnectionStatus(false);
        console.error('Error loading models:', error);
        aiModelSelect.innerHTML = '<option>No models available</option>';
        aiModelSelect.closest('.select-shell').classList.remove('loading');
        modelError.textContent = error.message;
        modelError.classList.remove('hidden');
    }
}

async function startGame() {
    const aiProvider = aiProviderSelect.value;
    const aiModel = aiModelSelect.value;
    if (!aiModel || aiModelSelect.disabled || !selectedPlayer) return;
    selectedBoardMode = (
        document.querySelector('input[name="board-mode"]:checked')?.value || 'voxel'
    );

    try {
        btnStart.disabled = true;
        btnStart.classList.add('loading');
        btnStart.querySelector('.button-label').textContent = 'Preparing the board';
        const response = await fetch('/api/start-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ai_provider: aiProvider,
                ai_model: aiModel,
                player_id: selectedPlayer.id
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to start game.');
        }

        gameState = data.game_state;
        setAIConnectionStatus(true);
        modalOverlay.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        document.body.classList.remove('modal-open');
        applyBoardMode();
        selectedSquare = null;
        legalMoves = [];
        isWaitingForAI = false;
        isMoveAnimating = false;
        lastMove = null;
        coachRequestGameId = null;
        historyHintRequestId += 1;
        lastHistoryHintKey = null;
        historyHintPanel?.classList.add('hidden');
        resetCoachPanel();
        renderPromotionChoices(gameState.human_color);
        renderBoard();
        updateUI();

        // White always moves first. If the draw gives White to the AI, let it
        // open the match before accepting human input.
        if (!gameState.game_over && gameState.current_turn === gameState.ai_color) {
            await getAIMove();
        }
    } catch (error) {
        setAIConnectionStatus(false);
        console.error('Error starting game:', error);
        modelError.textContent = error.message;
        modelError.classList.remove('hidden');
    } finally {
        btnStart.classList.remove('loading');
        syncStartButtonState();
        btnStart.querySelector('.button-label').textContent = 'Start the match';
    }
}

function renderBoard() {
    chessBoard.innerHTML = '';
    const humanIsBlack = gameState && gameState.human_color === 'black';
    const ranks = humanIsBlack
        ? [0, 1, 2, 3, 4, 5, 6, 7]
        : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = humanIsBlack
        ? [7, 6, 5, 4, 3, 2, 1, 0]
        : [0, 1, 2, 3, 4, 5, 6, 7];
    const bottomRank = humanIsBlack ? 7 : 0;
    const leftFile = humanIsBlack ? 7 : 0;
    chessBoard.setAttribute(
        'aria-label',
        `Chessboard from ${humanIsBlack ? 'Black' : 'White'}'s perspective`
    );

    for (const rank of ranks) {
        for (const file of files) {
            const square = document.createElement('button');
            const squareName = String.fromCharCode(97 + file) + (rank + 1);
            const isLight = (file + rank) % 2 === 1;

            square.className = `square ${isLight ? 'light' : 'dark'}`;
            square.type = 'button';
            square.setAttribute('role', 'gridcell');
            square.dataset.square = squareName;

            // Add file labels on bottom row
            if (rank === bottomRank) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'file-label';
                fileLabel.textContent = String.fromCharCode(97 + file);
                square.appendChild(fileLabel);
            }

            // Add rank labels on left column
            if (file === leftFile) {
                const rankLabel = document.createElement('span');
                rankLabel.className = 'rank-label';
                rankLabel.textContent = rank + 1;
                square.appendChild(rankLabel);
            }

            // Add piece if present
            if (gameState && gameState.board[squareName]) {
                const pieceData = gameState.board[squareName];
                const pieceEl = document.createElement('span');
                const type = pieceData.piece.toLowerCase();
                pieceEl.className = `piece piece-${type} ${pieceData.color} piece-enter`;
                pieceEl.innerHTML = renderPieceSvg(pieceData.piece, squareName);
                pieceEl.setAttribute('aria-hidden', 'true');
                square.appendChild(pieceEl);
                square.setAttribute('aria-label', `${pieceName(pieceData.piece)} on ${squareName}`);
                if (pieceData.color === gameState.human_color) {
                    square.classList.add('own-piece');
                }
            } else {
                square.setAttribute('aria-label', `Empty square ${squareName}`);
            }

            square.addEventListener('click', () => handleSquareClick(squareName));
            chessBoard.appendChild(square);
        }
    }

    // Highlight selected square and legal moves
    updateHighlights();
    highlightLastMove(lastMove);
    syncVoxelBoard();
}

function updateHighlights() {
    // Remove all highlights
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move', 'legal-capture', 'check');
        sq.setAttribute('aria-selected', 'false');
    });

    // Highlight selected square
    if (selectedSquare) {
        const selectedEl = document.querySelector(`[data-square="${selectedSquare}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
            selectedEl.setAttribute('aria-selected', 'true');
        }
    }

    // Highlight legal move destinations
    legalMoves.forEach(move => {
        const destEl = document.querySelector(`[data-square="${move.to}"]`);
        if (destEl) {
            const isCapture = Boolean(move.capture || gameState.board[move.to]);
            destEl.classList.add(isCapture ? 'legal-capture' : 'legal-move');
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

    updateVoxelHighlights();
}

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const CAPTURE_GLYPHS = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];

// Shows each side's captured material and the current point advantage in the
// player rails, derived by comparing the live board against a full piece set.
function renderCapturedPieces() {
    if (!railAiCapturesEl || !railHumanCapturesEl || !gameState) return;

    const remaining = {
        white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
        black: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };
    Object.values(gameState.board).forEach(({ piece, color }) => {
        const type = piece.toLowerCase();
        if (type in remaining[color]) remaining[color][type] += 1;
    });

    const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const captured = color => {
        const taken = {};
        let points = 0;
        CAPTURE_ORDER.forEach(type => {
            // Promotions can leave extra pieces on the board; never go negative.
            taken[type] = Math.max(0, initial[type] - remaining[color][type]);
            points += taken[type] * PIECE_VALUES[type];
        });
        return { taken, points };
    };

    const whiteLoss = captured('white');
    const blackLoss = captured('black');
    const renderRail = (el, loss, capturedColor, advantage) => {
        const glyphs = CAPTURE_ORDER.flatMap(type => (
            Array.from({ length: loss.taken[type] }, () => (
                `<span class="capture-glyph ${capturedColor}" aria-hidden="true">${CAPTURE_GLYPHS[type]}</span>`
            ))
        )).join('');
        const score = advantage > 0
            ? `<span class="capture-score">+${advantage}</span>`
            : '';
        el.innerHTML = glyphs + score;
    };

    const aiColor = gameState.ai_color;
    const humanColor = gameState.human_color;
    const aiPoints = humanColor === 'white' ? whiteLoss.points : blackLoss.points;
    const humanPoints = aiColor === 'white' ? whiteLoss.points : blackLoss.points;
    renderRail(
        railAiCapturesEl,
        humanColor === 'white' ? whiteLoss : blackLoss,
        humanColor,
        aiPoints - humanPoints
    );
    renderRail(
        railHumanCapturesEl,
        aiColor === 'white' ? whiteLoss : blackLoss,
        aiColor,
        humanPoints - aiPoints
    );
}

function pieceName(symbol) {
    const names = {
        k: 'Black king', q: 'Black queen', r: 'Black rook',
        b: 'Black bishop', n: 'Black knight', p: 'Black pawn',
        K: 'White king', Q: 'White queen', R: 'White rook',
        B: 'White bishop', N: 'White knight', P: 'White pawn'
    };
    return names[symbol] || 'Chess piece';
}

async function handleSquareClick(squareName) {
    // A pointer interaction (piece selection or drag) already handled this
    // press; ignore the compatibility click that follows it.
    if (suppressBoardClick) {
        suppressBoardClick = false;
        return;
    }
    if (!gameState || gameState.game_over || isWaitingForAI || isMoveAnimating) return;
    if (gameState.current_turn !== gameState.human_color) return;

    // If a piece is already selected
    if (selectedSquare) {
        // Check if clicking on a legal destination
        if (tryMoveTo(squareName)) return;

        // Clicking on the same square deselects
        if (squareName === selectedSquare) {
            clearSelection();
            return;
        }
    }

    // Try to select a piece
    const pieceData = gameState.board[squareName];
    if (pieceData && pieceData.color === gameState.human_color) {
        await selectPiece(squareName);
    } else {
        clearSelection();
    }
}

// Attempts to play the currently selected piece to squareName. Returns true
// when the square is a legal destination (including promotion hand-off).
function tryMoveTo(squareName) {
    const move = legalMoves.find(m => m.to === squareName);
    if (!move) return false;
    if (move.promotion) {
        pendingPromotion = { from: selectedSquare, to: squareName };
        promotionModal.classList.remove('hidden');
        return true;
    }
    makeHumanMove(move.uci);
    return true;
}

async function selectPiece(squareName) {
    selectedSquare = squareName;
    await fetchLegalMovesFromSquare(squareName);
    updateHighlights();
}

function clearSelection() {
    selectedSquare = null;
    legalMoves = [];
    updateHighlights();
}

// The click event that trails a pointer gesture must not re-run selection
// logic. The timer clears the flag in case the browser never fires the click.
function armClickSuppression() {
    suppressBoardClick = true;
    window.clearTimeout(suppressBoardClickTimer);
    suppressBoardClickTimer = window.setTimeout(() => {
        suppressBoardClick = false;
    }, 250);
}

function isHumanPieceSquare(square) {
    if (!gameState || gameState.game_over || isWaitingForAI || isMoveAnimating) return false;
    if (gameState.current_turn !== gameState.human_color) return false;
    return gameState.board[square]?.color === gameState.human_color;
}

// Drop handler for the 3D board. The 2D board resolves the move inline because
// it owns the pointer sequence; here the voxel board reports the drop instead.
async function handleVoxelDrop(fromSquare, toSquare) {
    if (selectedSquare !== fromSquare) {
        await selectPiece(fromSquare);
    } else if (legalMovesPromise) {
        try {
            await legalMovesPromise;
        } catch {
            // fetchLegalMovesFromSquare already reported the failure.
        }
    }
    if (selectedSquare !== fromSquare) return;
    // An illegal drop leaves the piece selected so a click can still move it.
    tryMoveTo(toSquare);
}

function handleBoardPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!gameState || gameState.game_over || isWaitingForAI || isMoveAnimating) return;
    if (gameState.current_turn !== gameState.human_color) return;

    const squareEl = event.target.closest?.('.square');
    if (!squareEl || !chessBoard.contains(squareEl)) return;
    const squareName = squareEl.dataset.square;
    const pieceData = gameState.board[squareName];
    if (!pieceData || pieceData.color !== gameState.human_color) return;

    if (selectedSquare !== squareName) {
        selectPiece(squareName);
        // Without suppression the trailing click would toggle this fresh
        // selection straight back off.
        armClickSuppression();
    }

    dragState = {
        pointerId: event.pointerId,
        fromSquare: squareName,
        squareEl,
        pieceEl: squareEl.querySelector('.piece'),
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        ghostEl: null,
        hoverEl: null,
    };
    chessBoard.addEventListener('pointermove', handleBoardPointerMove);
    chessBoard.addEventListener('pointerup', handleBoardPointerUp);
    chessBoard.addEventListener('pointercancel', cancelBoardDrag);
    try {
        chessBoard.setPointerCapture(event.pointerId);
    } catch {
        // Pointer capture is an enhancement; dragging inside the board still works.
    }
}

function handleBoardPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (!dragState.dragging) {
        const distance = Math.hypot(
            event.clientX - dragState.startX,
            event.clientY - dragState.startY
        );
        if (distance < 6) return;
        startPieceDrag();
    }
    moveDragGhost(event);
}

function startPieceDrag() {
    const { squareEl, pieceEl } = dragState;
    if (!pieceEl) return;
    dragState.dragging = true;
    const rect = squareEl.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.innerHTML = pieceEl.outerHTML;
    document.body.appendChild(ghost);
    dragState.ghostEl = ghost;
    squareEl.classList.add('drag-source');
    chessBoard.classList.add('dragging-piece');
}

function moveDragGhost(event) {
    if (!dragState?.dragging || !dragState.ghostEl) return;
    dragState.ghostEl.style.left = `${event.clientX}px`;
    dragState.ghostEl.style.top = `${event.clientY}px`;

    const under = document.elementFromPoint(event.clientX, event.clientY);
    const overSquare = under?.closest?.('.square') || null;
    if (dragState.hoverEl !== overSquare) {
        dragState.hoverEl?.classList.remove('drag-over');
        dragState.hoverEl = overSquare;
        overSquare?.classList.add('drag-over');
    }
}

async function handleBoardPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const state = dragState;
    dragState = null;
    teardownDragListeners();

    // A press without movement stays a click; the click handler owns it.
    if (!state.dragging) return;

    armClickSuppression();
    cleanupDragVisuals(state);

    const dropSquare = state.hoverEl?.dataset.square;
    if (!dropSquare || dropSquare === state.fromSquare) return;

    // Selection fetches legal moves asynchronously; make sure a fast drop
    // still sees them before deciding the move is illegal.
    if (legalMovesPromise) {
        try {
            await legalMovesPromise;
        } catch {
            // fetchLegalMovesFromSquare already reported the failure.
        }
    }
    if (selectedSquare !== state.fromSquare) return;
    // An illegal drop keeps the piece selected so a follow-up click can move it.
    tryMoveTo(dropSquare);
}

function cancelBoardDrag(event) {
    if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
    const state = dragState;
    dragState = null;
    teardownDragListeners();
    if (state.dragging) {
        armClickSuppression();
        cleanupDragVisuals(state);
    }
}

function teardownDragListeners() {
    chessBoard.removeEventListener('pointermove', handleBoardPointerMove);
    chessBoard.removeEventListener('pointerup', handleBoardPointerUp);
    chessBoard.removeEventListener('pointercancel', cancelBoardDrag);
}

function cleanupDragVisuals(state) {
    state.ghostEl?.remove();
    state.hoverEl?.classList.remove('drag-over');
    state.squareEl?.classList.remove('drag-source');
    chessBoard.classList.remove('dragging-piece');
}

function fetchLegalMovesFromSquare(square) {
    legalMovesPromise = fetchLegalMovesFromSquareInner(square);
    return legalMovesPromise;
}

async function fetchLegalMovesFromSquareInner(square) {
    try {
        const response = await fetch(`/api/legal-moves-from/${square}`);
        const data = await response.json();
        legalMoves = data.destinations || [];
    } catch (error) {
        console.error('Error fetching legal moves:', error);
        legalMoves = [];
    }
}

function unlockGameAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!gameAudioContext) {
        gameAudioContext = new AudioContextClass();
    }

    if (gameAudioContext.state === 'suspended') {
        gameAudioContext.resume().catch(() => {
            // A later player interaction will give the browser another chance.
        });
    }
}

function playCaptureSound(attackerType = 'p') {
    unlockGameAudio();
    const context = gameAudioContext;
    if (!context || context.state !== 'running') return;

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.24, now + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    master.connect(context.destination);

    const weight = {
        p: 0.88,
        n: 1.08,
        b: 0.96,
        r: 1.18,
        q: 1.24,
        k: 1.3,
    }[attackerType] || 1;

    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(155 * weight, now);
    impact.frequency.exponentialRampToValueAtTime(58, now + 0.19);
    impactGain.gain.setValueAtTime(0.9, now);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    impact.connect(impactGain).connect(master);

    const metal = context.createOscillator();
    const metalGain = context.createGain();
    metal.type = 'square';
    metal.frequency.setValueAtTime(980 * weight, now);
    metal.frequency.exponentialRampToValueAtTime(310, now + 0.13);
    metalGain.gain.setValueAtTime(0.14, now);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    metal.connect(metalGain).connect(master);

    const noiseLength = Math.floor(context.sampleRate * 0.18);
    const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseLength; index += 1) {
        const decay = 1 - index / noiseLength;
        noiseData[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    const debris = context.createBufferSource();
    const debrisFilter = context.createBiquadFilter();
    const debrisGain = context.createGain();
    debris.buffer = noiseBuffer;
    debrisFilter.type = 'bandpass';
    debrisFilter.frequency.value = 1450 * weight;
    debrisFilter.Q.value = 0.7;
    debrisGain.gain.setValueAtTime(0.22, now);
    debrisGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    debris.connect(debrisFilter).connect(debrisGain).connect(master);

    impact.start(now);
    impact.stop(now + 0.23);
    metal.start(now);
    metal.stop(now + 0.17);
    debris.start(now);
    debris.stop(now + 0.19);
}

function playWoodDropSound(pieceType = 'p') {
    unlockGameAudio();
    const context = gameAudioContext;
    if (!context || context.state !== 'running') return;

    const type = pieceType.toLowerCase();
    const weight = {
        p: 0.82,
        n: 1,
        b: 0.94,
        r: 1.1,
        q: 1.18,
        k: 1.25,
    }[type] || 1;
    const now = context.currentTime;

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.14, now + 0.003);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    master.connect(context.destination);

    // A short low knock provides the weight of a wooden piece meeting the
    // board. Larger pieces land slightly lower without becoming louder.
    const knock = context.createOscillator();
    const knockGain = context.createGain();
    knock.type = 'triangle';
    knock.frequency.setValueAtTime(164 / weight, now);
    knock.frequency.exponentialRampToValueAtTime(74 / weight, now + 0.075);
    knockGain.gain.setValueAtTime(0.8, now);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    knock.connect(knockGain).connect(master);

    // A quieter resonant tap suggests the hollow wooden board beneath it.
    const resonance = context.createOscillator();
    const resonanceGain = context.createGain();
    resonance.type = 'sine';
    resonance.frequency.setValueAtTime(370 / weight, now);
    resonance.frequency.exponentialRampToValueAtTime(235 / weight, now + 0.12);
    resonanceGain.gain.setValueAtTime(0.19, now);
    resonanceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    resonance.connect(resonanceGain).connect(master);

    // A few milliseconds of filtered noise create the dry contact click.
    const clickLength = Math.floor(context.sampleRate * 0.035);
    const clickBuffer = context.createBuffer(1, clickLength, context.sampleRate);
    const clickData = clickBuffer.getChannelData(0);
    for (let index = 0; index < clickLength; index += 1) {
        const decay = 1 - index / clickLength;
        clickData[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    const click = context.createBufferSource();
    const clickFilter = context.createBiquadFilter();
    const clickGain = context.createGain();
    click.buffer = clickBuffer;
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 1850 / Math.sqrt(weight);
    clickFilter.Q.value = 0.85;
    clickGain.gain.setValueAtTime(0.32, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
    click.connect(clickFilter).connect(clickGain).connect(master);

    knock.start(now);
    knock.stop(now + 0.1);
    resonance.start(now);
    resonance.stop(now + 0.15);
    click.start(now);
    click.stop(now + 0.04);
}

function playMoveDropSound(moveUci, previousState, capture) {
    if (!moveUci) return;
    const fromSquare = moveUci.slice(0, 2);
    const movingPiece = (
        capture?.attacker
        || previousState?.board?.[fromSquare]?.piece
        || 'p'
    );
    playWoodDropSound(movingPiece);

    if (['e1g1', 'e1c1', 'e8g8', 'e8c8'].includes(moveUci.slice(0, 4))) {
        window.setTimeout(() => playWoodDropSound('r'), 72);
    }
}

async function animateCapture(moveUci, capture) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!capture || !moveUci) return;

    const attackerType = capture.attacker.toLowerCase();
    const defenderType = capture.piece.toLowerCase();
    const isPawnDuel = attackerType === 'p' && defenderType === 'p';
    if (!isPawnDuel || reduceMotion) {
        playCaptureSound(attackerType);
        return;
    }

    const fromSquare = moveUci.slice(0, 2);
    const toSquare = moveUci.slice(2, 4);
    if (
        selectedBoardMode === 'voxel'
        && voxelBoardAvailable
        && voxelBoard
    ) {
        const animated = await voxelBoard.animatePawnCapture({
            fromSquare,
            toSquare,
            captureSquare: capture.square,
            onImpact: () => playCaptureSound(attackerType),
        });
        if (!animated) playCaptureSound(attackerType);
        return;
    }

    const attackerSquareEl = chessBoard.querySelector(`[data-square="${fromSquare}"]`);
    const targetSquareEl = chessBoard.querySelector(`[data-square="${toSquare}"]`);
    const defenderSquareEl = chessBoard.querySelector(`[data-square="${capture.square}"]`);
    const attackerPieceEl = attackerSquareEl?.querySelector('.piece');
    const defenderPieceEl = defenderSquareEl?.querySelector('.piece');
    if (!attackerSquareEl || !targetSquareEl || !defenderSquareEl || !attackerPieceEl || !defenderPieceEl) return;

    const layer = document.createElement('div');
    layer.className = 'combat-layer';
    layer.setAttribute('aria-hidden', 'true');

    const attacker = attackerPieceEl.cloneNode(true);
    const defender = defenderPieceEl.cloneNode(true);
    attacker.classList.remove('piece-enter');
    defender.classList.remove('piece-enter');
    attacker.classList.add(
        'combat-piece',
        'combat-attacker',
        'pawn-armed',
        `combat-${attackerType}`,
    );
    defender.classList.add('combat-piece', 'combat-defender');
    const pawnRig = document.createElement('span');
    pawnRig.className = 'pawn-combat-rig';
    pawnRig.innerHTML = `
        <i class="pawn-arm pawn-arm-left"></i>
        <i class="pawn-arm pawn-arm-sword"></i>
        <i class="pawn-sword"></i>
    `;
    attacker.appendChild(pawnRig);

    positionCombatant(attacker, attackerPieceEl);
    positionCombatant(defender, defenderPieceEl);

    const impact = document.createElement('div');
    impact.className = 'capture-impact';
    const targetX = defenderSquareEl.offsetLeft + defenderSquareEl.offsetWidth / 2;
    const targetY = defenderSquareEl.offsetTop + defenderSquareEl.offsetHeight / 2;
    impact.style.left = `${targetX}px`;
    impact.style.top = `${targetY}px`;
    impact.innerHTML = `
        <span class="impact-core"></span>
        <span class="impact-ring"></span>
        ${Array.from({ length: 10 }, (_, index) => (
            `<i class="impact-spark" style="--spark-angle:${index * 36}deg"></i>`
        )).join('')}
    `;

    layer.append(attacker, defender, impact);
    chessBoard.appendChild(layer);
    attackerPieceEl.style.visibility = 'hidden';
    defenderPieceEl.style.visibility = 'hidden';
    chessBoard.classList.add('combat-active');

    const dx = targetSquareEl.offsetLeft - attackerSquareEl.offsetLeft;
    const dy = targetSquareEl.offsetTop - attackerSquareEl.offsetTop;
    const attackTilt = -6;
    const fallDirection = dx >= 0 ? 1 : -1;
    const duration = 900;

    const attackerAnimation = attacker.animate([
        { offset: 0, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
        { offset: 0.18, transform: `translate(${-dx * 0.06}px, ${-dy * 0.06}px) rotate(${-attackTilt * 0.35}deg) scale(1.04)` },
        { offset: 0.48, transform: `translate(${dx * 0.72}px, ${dy * 0.72}px) rotate(${attackTilt}deg) scale(1.13)` },
        { offset: 0.63, transform: `translate(${dx * 0.58}px, ${dy * 0.58}px) rotate(${-attackTilt * 0.24}deg) scale(1.04)` },
        { offset: 1, transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1)` },
    ], {
        duration,
        easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)',
        fill: 'forwards',
    });

    const defenderAnimation = defender.animate([
        { offset: 0, transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, filter: 'brightness(1)' },
        { offset: 0.42, transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, filter: 'brightness(1)' },
        { offset: 0.5, transform: `translate(${-3 * fallDirection}px, -2px) rotate(${-5 * fallDirection}deg) scale(1.06)`, opacity: 1, filter: 'brightness(1.7)' },
        { offset: 0.58, transform: `translate(${4 * fallDirection}px, 2px) rotate(${7 * fallDirection}deg) scale(0.98)`, opacity: 1, filter: 'brightness(1.2)' },
        { offset: 0.78, transform: `translate(${9 * fallDirection}px, 8px) rotate(${18 * fallDirection}deg) scale(0.72)`, opacity: 0.72, filter: 'brightness(0.75) saturate(0.7)' },
        { offset: 1, transform: `translate(${14 * fallDirection}px, 18px) rotate(${34 * fallDirection}deg) scale(0.16)`, opacity: 0, filter: 'brightness(0.3) saturate(0)' },
    ], {
        duration,
        easing: 'cubic-bezier(0.4, 0, 0.7, 1)',
        fill: 'forwards',
    });

    window.setTimeout(() => {
        playCaptureSound(attackerType);
        impact.classList.add('impact-live');
        defenderSquareEl.classList.add('capture-struck');
    }, 430);

    try {
        await Promise.all([attackerAnimation.finished, defenderAnimation.finished]);
    } catch {
        // Re-rendering or reduced-motion changes may cancel an in-flight effect.
    } finally {
        attackerPieceEl.style.visibility = '';
        defenderPieceEl.style.visibility = '';
        defenderSquareEl.classList.remove('capture-struck');
        chessBoard.classList.remove('combat-active');
        layer.remove();
    }
}

function positionCombatant(pieceEl, originalPieceEl) {
    const boardRect = chessBoard.getBoundingClientRect();
    const pieceRect = originalPieceEl.getBoundingClientRect();
    pieceEl.style.position = 'absolute';
    pieceEl.style.left = `${pieceRect.left - boardRect.left}px`;
    pieceEl.style.top = `${pieceRect.top - boardRect.top}px`;
    pieceEl.style.width = `${pieceRect.width}px`;
    pieceEl.style.height = `${pieceRect.height}px`;
}

async function makeHumanMove(moveUci) {
    const previousState = gameState;
    selectedSquare = null;
    legalMoves = [];
    isMoveAnimating = true;
    chessBoard.setAttribute('aria-busy', 'true');

    try {
        const response = await fetch('/api/human-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ move: moveUci })
        });

        const data = await response.json();
        if (data.success) {
            await animateCapture(data.move, data.capture);
            playMoveDropSound(data.move, previousState, data.capture);
            gameState = data.game_state;
            lastMove = data.move;
            renderBoard();
            updateUI();
            announceCommentary(buildMoveCommentary({
                moveUci: data.move,
                capture: data.capture,
                actor: 'human',
                previousState,
                nextState: gameState,
            }));
            isMoveAnimating = false;
            chessBoard.setAttribute('aria-busy', 'false');

            // If game is not over and it's AI's turn, get AI move
            if (!gameState.game_over && gameState.current_turn === gameState.ai_color) {
                await getAIMove();
            }
        } else {
            console.error('Move error:', data.error);
            gameStatus.textContent = 'Invalid move: ' + data.error;
        }
    } catch (error) {
        console.error('Error making move:', error);
    } finally {
        isMoveAnimating = false;
        if (!isWaitingForAI) chessBoard.setAttribute('aria-busy', 'false');
        updateVoxelInteractivity();
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
    const previousState = gameState;
    isWaitingForAI = true;
    updateVoxelInteractivity();
    aiThinkingEl.classList.remove('hidden');
    chessBoard.setAttribute('aria-busy', 'true');
    railAiStateEl.textContent = 'Calculating';
    setTurnIndicator("AI's turn", capitalize(gameState.ai_color), 'ai-turn');
    startTimer();

    try {
        const response = await fetch('/api/ai-move', { method: 'POST' });
        const data = await response.json();

        stopTimer();
        aiThinkingEl.classList.add('hidden');
        if (data.success) {
            setAIConnectionStatus(true);
            await animateCapture(data.move, data.capture);
            playMoveDropSound(data.move, previousState, data.capture);
            gameState = data.game_state;
            lastMove = data.move;
            renderBoard();
            updateUI();
            announceCommentary(buildMoveCommentary({
                moveUci: data.move,
                capture: data.capture,
                actor: 'ai',
                previousState,
                nextState: gameState,
            }));

            // Keep the most recent move visible on the board.
            highlightLastMove(data.move);
        } else {
            setAIConnectionStatus(false);
            console.error('AI move error:', data.error);
            gameStatus.textContent = 'AI Error: ' + data.error;
            railAiStateEl.textContent = 'Move failed';
        }
        chessBoard.setAttribute('aria-busy', 'false');
        isWaitingForAI = false;
        updateVoxelInteractivity();
    } catch (error) {
        setAIConnectionStatus(false);
        console.error('Error getting AI move:', error);
        stopTimer();
        aiThinkingEl.classList.add('hidden');
        chessBoard.setAttribute('aria-busy', 'false');
        isWaitingForAI = false;
        updateVoxelInteractivity();
        gameStatus.textContent = 'AI provider error - check console';
        railAiStateEl.textContent = 'Connection error';
    }
}

function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function resetCoachPanel() {
    coachPanel?.classList.add('hidden');
    if (coachModel) coachModel.textContent = 'GPT-5.6 Sol';
    if (coachContent) {
        coachContent.replaceChildren(createCoachLoading());
    }
}

function createCoachLoading() {
    const loading = document.createElement('div');
    loading.className = 'coach-loading';
    loading.setAttribute('role', 'status');

    const orbit = document.createElement('span');
    orbit.className = 'coach-orbit';
    orbit.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Reviewing every move';
    const detail = document.createElement('p');
    detail.textContent = 'Codex is finding your tactical fingerprint and the moments to improve.';
    copy.append(title, detail);
    loading.append(orbit, copy);
    return loading;
}

async function requestGameCoach(force = false) {
    if (!gameState?.game_over || !gameState.game_id || !coachPanel || !coachContent) return;
    if (!force && coachRequestGameId === gameState.game_id) return;

    const requestedGameId = gameState.game_id;
    coachRequestGameId = requestedGameId;
    coachPanel.classList.remove('hidden');
    coachContent.replaceChildren(createCoachLoading());

    try {
        const response = await fetch('/api/game-coach', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Codex Coach could not review this game.');
        }
        if (gameState?.game_id !== requestedGameId) return;
        renderCoachReport(data.coach, data.log_file, data.trained_ai);
        announceCommentary(`Codex Coach review. ${data.coach.one_line_insight}`);
    } catch (error) {
        if (gameState?.game_id !== requestedGameId) return;
        console.error('Coach analysis error:', error);
        coachRequestGameId = null;
        renderCoachError(error.message);
    }
}

function renderCoachReport(coach, logFile, trainedAi = null) {
    coachContent.replaceChildren();
    coachModel.textContent = coach.model || 'Codex';

    const opponent = document.createElement('p');
    opponent.className = 'coach-opponent';
    opponent.textContent = `Reviewed against ${coach.opponent_model || gameState.ai_display_name}`;

    const insight = document.createElement('blockquote');
    insight.className = 'coach-insight';
    insight.textContent = coach.one_line_insight;

    const tacticsHeading = document.createElement('div');
    tacticsHeading.className = 'coach-section-label';
    tacticsHeading.textContent = 'Your tactical fingerprint';

    const tacticList = document.createElement('ol');
    tacticList.className = 'coach-tactics';
    (coach.tactics || []).forEach((tactic, index) => {
        const item = document.createElement('li');
        item.className = tactic.used ? 'coach-tactic used' : 'coach-tactic';

        const number = document.createElement('span');
        number.className = 'coach-tactic-number';
        number.textContent = String(index + 1).padStart(2, '0');

        const copy = document.createElement('div');
        const heading = document.createElement('div');
        heading.className = 'coach-tactic-title';
        const name = document.createElement('strong');
        name.textContent = tactic.name;
        heading.appendChild(name);
        if (tactic.used) {
            const badge = document.createElement('span');
            badge.textContent = 'You used this';
            heading.appendChild(badge);
        }
        const description = document.createElement('p');
        description.textContent = tactic.description;
        const evidence = document.createElement('small');
        evidence.textContent = tactic.evidence;
        copy.append(heading, description, evidence);
        item.append(number, copy);
        tacticList.appendChild(item);
    });

    const mistakes = document.createElement('div');
    mistakes.className = 'coach-mistakes';
    const mistakesTitle = document.createElement('div');
    mistakesTitle.className = 'coach-section-label';
    mistakesTitle.textContent = 'What held you back';
    const mistakesList = document.createElement('ul');
    (coach.what_went_wrong || []).forEach(item => {
        const row = document.createElement('li');
        row.textContent = item;
        mistakesList.appendChild(row);
    });
    mistakes.append(mistakesTitle, mistakesList);

    const improvement = document.createElement('div');
    improvement.className = 'coach-improvement';
    const improvementLabel = document.createElement('span');
    improvementLabel.textContent = 'Next-game focus';
    const improvementCopy = document.createElement('strong');
    improvementCopy.textContent = coach.best_improvement;
    improvement.append(improvementLabel, improvementCopy);

    const record = document.createElement('p');
    record.className = 'coach-record';
    record.textContent = `Saved locally as ${logFile}`;

    let trainingRecord = null;
    if (trainedAi?.status === 'complete') {
        trainingRecord = document.createElement('p');
        trainingRecord.className = 'coach-record coach-training-record';
        const dataset = trainedAi.dataset || {};
        trainingRecord.textContent = dataset.positions_seen
            ? `Trained AI updated · ${dataset.positions_seen} labeled AI position${dataset.positions_seen === 1 ? '' : 's'} across ${dataset.games_processed} game${dataset.games_processed === 1 ? '' : 's'}`
            : `AI strategy classified as ${String(trainedAi.overall_strategy || '').replaceAll('_', ' ')}`;
    }

    coachContent.append(
        opponent,
        insight,
        tacticsHeading,
        tacticList,
        mistakes,
        improvement,
        record,
    );
    if (trainingRecord) coachContent.appendChild(trainingRecord);
}

function renderCoachError(message) {
    coachContent.replaceChildren();
    const error = document.createElement('div');
    error.className = 'coach-error';
    const title = document.createElement('strong');
    title.textContent = 'The review paused';
    const copy = document.createElement('p');
    copy.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry Codex Coach';
    retry.addEventListener('click', () => requestGameCoach(true));
    error.append(title, copy, retry);
    coachContent.appendChild(error);
}

function highlightLastMove(moveUci) {
    document.querySelectorAll('.square.last-move').forEach(square => {
        square.classList.remove('last-move', 'last-move-from', 'last-move-to');
    });
    if (!moveUci || moveUci.length < 4) {
        updateVoxelHighlights();
        return;
    }

    const from = moveUci.substring(0, 2);
    const to = moveUci.substring(2, 4);

    const fromEl = document.querySelector(`[data-square="${from}"]`);
    const toEl = document.querySelector(`[data-square="${to}"]`);

    if (fromEl) fromEl.classList.add('last-move', 'last-move-from');
    if (toEl) toEl.classList.add('last-move', 'last-move-to');
    updateVoxelHighlights();
}

function formatHistoryHintDate(value) {
    if (!value) return 'an earlier game';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'an earlier game';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function historyResultLabel(result) {
    const labels = {
        human: 'you won',
        ai: 'the AI won',
        draw: 'draw',
    };
    return labels[result] || 'completed game';
}

function hideHistoryHint() {
    historyHintPanel?.classList.add('hidden');
}

async function refreshHistoryHint() {
    if (
        !gameState
        || gameState.game_over
        || gameState.current_turn !== gameState.human_color
    ) {
        historyHintRequestId += 1;
        hideHistoryHint();
        return;
    }

    const hintKey = `${gameState.game_id}:${gameState.move_history.length}:${gameState.fen}`;
    if (hintKey === lastHistoryHintKey) return;
    lastHistoryHintKey = hintKey;
    const requestId = ++historyHintRequestId;

    try {
        const response = await fetch('/api/history-hint');
        const data = await response.json();
        if (requestId !== historyHintRequestId) return;
        if (!response.ok || !data.hint) {
            hideHistoryHint();
            return;
        }

        const hint = data.hint;
        const strategy = String(hint.strategy || 'a familiar plan').replaceAll('_', ' ');
        const move = hint.move || 'a similar continuation';
        const playedAt = formatHistoryHintDate(hint.played_at);
        const similarity = Math.round(Number(hint.similarity || 0) * 100);

        historyHintMatch.textContent = `${similarity}% match`;
        historyHintCopy.textContent = (
            `A position from ${playedAt} looks familiar. `
            + `You used ${strategy} and continued with ${move}.`
        );
        historyHintOpponent.textContent = (
            `${hint.opponent ? `vs ${hint.opponent}` : 'Earlier match'}`
            + ` · ${historyResultLabel(hint.result)}`
        );
        historyHintPanel.classList.remove('hidden');
    } catch (error) {
        if (requestId === historyHintRequestId) hideHistoryHint();
        console.debug('No historical position hint is available:', error);
    }
}

function decisionNode(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderTrainedDecision() {
    if (!trainedDecisionPopover || !gameState) return;

    const summary = gameState.trained_model_summary || {};
    const decision = gameState.trained_ai_last_decision || null;
    trainedDecisionPopover.replaceChildren();

    const header = decisionNode('div', 'decision-popover-header');
    const heading = decisionNode('div', '');
    heading.append(
        decisionNode('span', 'decision-eyebrow', 'Live model trace'),
        decisionNode('strong', '', 'How Trained AI decided')
    );
    const mode = decision?.match_type === 'exact'
        ? 'Memory'
        : decision?.match_type === 'linear'
            ? 'Learned'
            : decision?.match_type === 'fallback'
                ? 'Cold start'
                : 'Ready';
    header.append(heading, decisionNode('span', `decision-mode ${decision?.match_type || 'ready'}`, mode));

    const intro = decisionNode(
        'p',
        'decision-intro',
        decision
            ? `Selected ${decision.selected_move || 'a legal move'} after checking memory, learned outcomes, and the safety fallback in that order.`
            : 'Hover here after the first Trained AI move to inspect its live decision path.'
    );

    const forecast = gameState.trained_ai_win_prediction || {
        win_probability: 0.5,
        source: 'untrained_baseline',
        explanation: 'Forecast begins at an even position.',
    };
    const forecastProbability = Math.max(
        0,
        Math.min(100, Math.round(Number(forecast.win_probability ?? 0.5) * 100))
    );
    const forecastCard = decisionNode('section', 'decision-win-forecast');
    forecastCard.setAttribute('aria-label', `Trained AI estimated win chance: ${forecastProbability}%`);
    const forecastGauge = decisionNode('div', 'decision-win-gauge');
    forecastGauge.style.setProperty('--win-angle', `${forecastProbability * 3.6}deg`);
    const forecastGaugeCore = decisionNode('span', 'decision-win-gauge-core');
    forecastGaugeCore.append(
        decisionNode('strong', '', `${forecastProbability}%`),
        decisionNode('small', '', 'AI win')
    );
    forecastGauge.appendChild(forecastGaugeCore);

    const forecastCopy = decisionNode('div', 'decision-win-copy');
    const sourceLabels = {
        final_result: 'Final result',
        exact_position_value: 'Exact position memory',
        learned_value_model: 'Learned position value',
        untrained_baseline: 'Untrained baseline',
    };
    const forecastHeading = decisionNode('div', 'decision-win-heading');
    forecastHeading.append(
        decisionNode('strong', '', 'Position win forecast'),
        decisionNode('span', '', sourceLabels[forecast.source] || 'Local value model')
    );
    forecastCopy.append(
        forecastHeading,
        decisionNode('p', '', forecast.explanation || 'Updated after every move.')
    );
    const forecastFactors = (forecast.factors || []).slice(0, 2);
    if (forecastFactors.length) {
        forecastCopy.appendChild(
            decisionNode(
                'small',
                'decision-win-factors',
                forecastFactors
                    .map(factor => `${factor.effect} ${factor.label}`)
                    .join(' · ')
            )
        );
    }
    forecastCard.append(forecastGauge, forecastCopy);

    const forecastHistory = (gameState.trained_ai_prediction_history || []).slice(-14);
    if (forecastHistory.length > 1) {
        const historyFigure = decisionNode('figure', 'decision-forecast-history');
        historyFigure.setAttribute(
            'aria-label',
            `Win forecast by move: ${forecastHistory
                .map(item => `${Math.round(Number(item.win_probability || 0) * 100)} percent`)
                .join(', ')}`
        );
        const historyBars = decisionNode('div', 'decision-forecast-bars');
        forecastHistory.forEach((item, index) => {
            const value = Math.round(Number(item.win_probability || 0) * 100);
            const bar = decisionNode(
                'span',
                `decision-forecast-bar${index === forecastHistory.length - 1 ? ' current' : ''}`
            );
            bar.style.setProperty('--forecast-height', `${Math.max(5, value)}%`);
            bar.title = `Ply ${item.ply}: ${value}% AI win forecast`;
            historyBars.appendChild(bar);
        });
        const historyCaption = decisionNode('figcaption', '');
        historyCaption.append(
            decisionNode('span', '', 'Start'),
            decisionNode('strong', '', 'Forecast after every move'),
            decisionNode('span', '', `Ply ${forecast.ply ?? 0}`)
        );
        historyFigure.append(historyBars, historyCaption);
        forecastCard.appendChild(historyFigure);
    }

    const stats = decisionNode('div', 'decision-stats');
    [
        ['Games', decision?.games_processed ?? summary.games_processed ?? 0],
        ['AI decisions', decision?.positions_seen ?? summary.positions_seen ?? 0],
        ['Strategies', decision?.strategies_known ?? summary.strategies_known ?? 0],
    ].forEach(([label, value]) => {
        const stat = decisionNode('div', 'decision-stat');
        stat.append(
            decisionNode('strong', '', String(value)),
            decisionNode('span', '', label)
        );
        stats.appendChild(stat);
    });

    const tree = decisionNode('div', 'decision-tree');
    const path = decision?.decision_path || [
        {
            label: 'Training memory',
            status: summary.positions_seen ? 'ready' : 'waiting',
            detail: summary.positions_seen
                ? `${summary.positions_seen} outcome-weighted AI decisions are ready.`
                : 'Complete a game to create the first training samples.',
        },
    ];
    path.forEach((step, index) => {
        const branch = decisionNode('div', `decision-branch ${step.status || ''}`);
        const marker = decisionNode('span', 'decision-branch-marker', String(index + 1).padStart(2, '0'));
        const copy = decisionNode('div', 'decision-branch-copy');
        copy.append(
            decisionNode('strong', '', step.label),
            decisionNode('p', '', step.detail)
        );
        branch.append(marker, copy, decisionNode('span', 'decision-branch-status', step.status || 'ready'));
        tree.appendChild(branch);
    });

    trainedDecisionPopover.append(header, intro, forecastCard, stats, tree);

    const candidates = decision?.candidate_moves || [];
    if (candidates.length) {
        const candidateSection = decisionNode('div', 'decision-candidates');
        candidateSection.appendChild(decisionNode('span', 'decision-candidates-title', 'Top candidate branches'));
        candidates.forEach((candidate, index) => {
            const probability = Math.round(Number(candidate.probability || 0) * 100);
            const row = decisionNode('div', `decision-candidate${index === 0 ? ' selected' : ''}`);
            const candidateHeading = decisionNode('div', 'decision-candidate-heading');
            candidateHeading.append(
                decisionNode('strong', '', candidate.move || '—'),
                decisionNode('span', '', `${probability}%`)
            );
            const track = decisionNode('span', 'decision-probability-track');
            const fill = decisionNode('span', 'decision-probability-fill');
            fill.style.width = `${Math.max(2, probability)}%`;
            track.appendChild(fill);
            const factor = candidate.factors?.[0];
            const caption = factor
                ? `${String(candidate.strategy || '').replaceAll('_', ' ')} · ${factor.effect} ${factor.label}`
                : `${String(candidate.strategy || 'historical memory').replaceAll('_', ' ')}${candidate.samples ? ` · ${candidate.samples} sample${candidate.samples === 1 ? '' : 's'}` : ''}`;
            row.append(
                candidateHeading,
                track,
                decisionNode('small', '', caption)
            );
            candidateSection.appendChild(row);
        });
        trainedDecisionPopover.appendChild(candidateSection);
    }

    trainedDecisionPopover.appendChild(
        decisionNode(
            'p',
            'decision-privacy',
            'Local learning only · no SDK or API call during play'
        )
    );
}

function updateUI() {
    if (!gameState) return;

    // Update AI info
    aiDisplayNameEl.textContent = gameState.ai_display_name;
    railAiNameEl.textContent = gameState.ai_display_name;
    railAiColorEl.textContent = `${capitalize(gameState.ai_color)} · AI`;
    railHumanColorEl.textContent = `${capitalize(gameState.human_color)} · Human`;
    railHumanNameEl.textContent = gameState.player.username;
    railHumanRatingEl.textContent = `${gameState.player.elo} Elo`;
    renderCapturedPieces();
    let opponentDetail = `Playing the ${gameState.ai_color} pieces`;
    if (gameState.ai_provider === 'trained') {
        const trained = gameState.trained_model_summary || {};
        opponentDetail += trained.games_processed
            ? ` · ${trained.games_processed} games · ${trained.positions_seen} AI decisions`
            : ' · learning model awaiting its first completed game';
    }
    opponentColorCopyEl.textContent = opponentDetail;
    const isTrainedProvider = gameState.ai_provider === 'trained';
    aiPanelEl?.classList.toggle('trained-provider', isTrainedProvider);
    trainedDecisionTrigger?.classList.toggle('hidden', !isTrainedProvider);
    trainedDecisionPopover?.classList.toggle('hidden', !isTrainedProvider);
    if (!isTrainedProvider) {
        trainedDecisionPinned = false;
        aiPanelEl?.classList.remove('decision-pinned');
        trainedDecisionTrigger?.setAttribute('aria-expanded', 'false');
    } else {
        renderTrainedDecision();
    }
    railAiAvatarEl.textContent = gameState.ai_color === 'white' ? '\u2655' : '\u265B';
    railHumanAvatarEl.textContent = gameState.human_color === 'white' ? '\u2654' : '\u265A';
    railAiAvatarEl.classList.toggle('white-side', gameState.ai_color === 'white');
    railHumanAvatarEl.classList.toggle('black-side', gameState.human_color === 'black');
    const providerNames = {
        openai: 'OpenAI API',
        anthropic: 'Anthropic API',
        codex: 'Codex SDK',
        trained: 'Learning model'
    };
    aiProviderBadgeEl.textContent = providerNames[gameState.ai_provider] || 'AI';
    aiProviderBadgeEl.dataset.provider = gameState.ai_provider || '';
    aiLastTimeEl.textContent = gameState.ai_last_time + 's';
    aiTotalTimeEl.textContent = gameState.ai_total_time + 's';
    gameContainer.classList.toggle('game-over', gameState.game_over);

    if (gameState.ai_reasoning) {
        aiReasoningEl.textContent = gameState.ai_reasoning;
    }

    // Update turn indicator
    if (gameState.game_over) {
        railAiStateEl.textContent = 'Match complete';
        if (gameState.winner === 'human') {
            setTurnIndicator('You win', 'Checkmate', 'winner-human');
        } else if (gameState.winner === 'ai') {
            setTurnIndicator('AI wins', 'Checkmate', 'winner-ai');
        } else {
            setTurnIndicator('Draw', 'Game over', 'draw');
        }
        const rating = gameState.rating_update;
        const ratingCopy = rating?.status === 'complete'
            ? ` · ${rating.rating_delta >= 0 ? '+' : ''}${rating.rating_delta} Elo · ${rating.rating_after}`
            : '';
        gameStatus.textContent = `${gameState.game_result}${ratingCopy}`;
        requestGameCoach();
    } else if (gameState.current_turn === gameState.human_color) {
        railAiStateEl.textContent = 'Watching';
        setTurnIndicator('Your turn', capitalize(gameState.human_color), 'human-turn');
        if (gameState.is_check) {
            gameStatus.textContent = 'Your king is in check. Find the response.';
        } else {
            gameStatus.textContent = gameState.move_history.length
                ? 'Your move. Build the position or strike.'
                : 'Select a piece to begin your attack.';
        }
    } else {
        railAiStateEl.textContent = 'Calculating';
        setTurnIndicator("AI's turn", capitalize(gameState.ai_color), 'ai-turn');
        gameStatus.textContent = gameState.move_history.length
            ? 'Your opponent is calculating its reply.'
            : `The draw gave you ${capitalize(gameState.human_color)}. The AI opens as White.`;
    }

    // Update move history
    updateMoveHistory();
    refreshHistoryHint();
}

function setTurnIndicator(label, side, stateClass) {
    turnIndicator.className = `turn-indicator ${stateClass}`;
    turnIndicator.innerHTML = `
        <span class="turn-pulse" aria-hidden="true"></span>
        <span class="turn-copy">${label}</span>
        <span class="turn-side">${side}</span>
    `;
}

function updateMoveHistory() {
    if (!gameState || !gameState.move_history_san || gameState.move_history_san.length === 0) {
        moveCountEl.textContent = '0 ply';
        moveHistoryEl.innerHTML = `
            <div class="history-empty">
                <span aria-hidden="true">&#9816;</span>
                <p>Your match notation will appear here.</p>
            </div>
        `;
        return;
    }

    const moves = gameState.move_history_san;
    moveCountEl.textContent = `${moves.length} ply`;
    let html = '';

    for (let i = 0; i < moves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = moves[i];
        const blackMove = moves[i + 1] || '';

        const isLatest = i + 2 >= moves.length ? ' latest-row' : '';
        html += `<div class="move-row${isLatest}">
            <span class="move-num">${moveNum}.</span>
            <span class="white-move">${whiteMove}</span>
            <span class="black-move">${blackMove}</span>
        </div>`;
    }

    moveHistoryEl.innerHTML = html;
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

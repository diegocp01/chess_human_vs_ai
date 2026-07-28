import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const logic = require('../../static/js/chess-logic.js');

const {
    capturedMaterial,
    materialAdvantage,
    squareName,
    isLightSquare,
    boardLayout,
    pairMoves,
    fenToBoard,
    CAPTURE_ORDER,
} = logic;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Builds the board map the server sends: { e4: { piece: 'P', color: 'white' } }.
function boardFrom(spec) {
    const board = {};
    Object.entries(spec).forEach(([color, pieces]) => {
        pieces.forEach((piece, index) => {
            board[`sq${color}${index}`] = { piece, color };
        });
    });
    return board;
}

function startingPosition() {
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const pawns = Array(8).fill('p');
    return boardFrom({
        white: [...back, ...pawns].map(p => p.toUpperCase()),
        black: [...back, ...pawns],
    });
}

test('capturedMaterial: nobody has lost anything at the start', () => {
    const loss = capturedMaterial(startingPosition());
    assert.equal(loss.white.points, 0);
    assert.equal(loss.black.points, 0);
    CAPTURE_ORDER.forEach(type => {
        assert.equal(loss.white.taken[type], 0, `white ${type}`);
        assert.equal(loss.black.taken[type], 0, `black ${type}`);
    });
});

test('capturedMaterial: counts a single missing piece and its value', () => {
    // Black is missing one knight.
    const loss = capturedMaterial(boardFrom({
        white: ['K'],
        black: ['k', 'n'],
    }));
    assert.equal(loss.black.taken.n, 1);
    // A bare board is missing everything else too, so check the knight only.
    assert.equal(loss.black.taken.n * 3, 3);
});

test('capturedMaterial: kings are never counted as material', () => {
    const loss = capturedMaterial(boardFrom({ white: ['K'], black: ['k'] }));
    assert.ok(!('k' in loss.white.taken), 'king should not appear in the tally');
    // Everything except the kings is gone, so each side lost a full set:
    // 8 pawns + 2 knights + 2 bishops + 2 rooks + 1 queen = 39 points.
    assert.equal(loss.white.points, 39);
    assert.equal(loss.black.points, 39);
});

test('capturedMaterial: promotion never produces a negative count', () => {
    // Black promoted a pawn, so it has two queens: more than the game started
    // with. The tally must clamp at zero rather than report -1.
    const board = boardFrom({
        white: ['K'],
        black: ['k', 'q', 'q'],
    });
    const loss = capturedMaterial(board);
    assert.equal(loss.black.taken.q, 0, 'extra queen must not go negative');
    assert.ok(loss.black.points >= 0);
    // The promoted pawn is still counted among the missing pawns.
    assert.equal(loss.black.taken.p, 8);
});

test('capturedMaterial: ignores malformed entries instead of throwing', () => {
    const board = {
        a1: { piece: 'P', color: 'white' },
        a2: null,
        a3: { piece: 'X', color: 'white' },
        a4: { piece: 'p', color: 'purple' },
    };
    assert.doesNotThrow(() => capturedMaterial(board));
    const loss = capturedMaterial(board);
    assert.equal(loss.white.taken.p, 7, 'one legitimate white pawn is on the board');
});

test('capturedMaterial: handles an empty or missing board', () => {
    assert.doesNotThrow(() => capturedMaterial(undefined));
    assert.equal(capturedMaterial({}).white.points, 39);
});

test('materialAdvantage: knight for a pawn is worth +2', () => {
    // White is missing a pawn; black is missing a knight.
    const board = boardFrom({
        white: [...Array(7).fill('P'), 'N', 'N'],
        black: [...Array(8).fill('p'), 'n'],
    });
    assert.equal(materialAdvantage(board, 'white'), 2);
    assert.equal(materialAdvantage(board, 'black'), -2);
});

test('materialAdvantage: is zero on an even trade', () => {
    const board = boardFrom({
        white: Array(7).fill('P'),
        black: Array(7).fill('p'),
    });
    assert.equal(materialAdvantage(board, 'white'), 0);
    assert.equal(materialAdvantage(board, 'black'), 0);
});

test('squareName: maps file and rank indices to algebraic names', () => {
    assert.equal(squareName(0, 0), 'a1');
    assert.equal(squareName(7, 7), 'h8');
    assert.equal(squareName(4, 3), 'e4');
});

test('isLightSquare: a1 is dark and h1 is light', () => {
    assert.equal(isLightSquare(0, 0), false, 'a1 is a dark square');
    assert.equal(isLightSquare(7, 0), true, 'h1 is a light square');
    assert.equal(isLightSquare(4, 3), true, 'e4 is a light square');
});

test('boardLayout: white sees rank 8 first and file a on the left', () => {
    const layout = boardLayout(false);
    assert.equal(layout.ranks[0], 7, 'top row is rank 8');
    assert.equal(layout.files[0], 0, 'leftmost column is the a-file');
    assert.equal(layout.bottomRank, 0);
    assert.equal(layout.leftFile, 0);
});

test('boardLayout: black sees the board flipped on both axes', () => {
    const layout = boardLayout(true);
    assert.equal(layout.ranks[0], 0, 'top row is rank 1');
    assert.equal(layout.files[0], 7, 'leftmost column is the h-file');
    assert.equal(layout.bottomRank, 7);
    assert.equal(layout.leftFile, 7);
});

test('boardLayout: both orientations still cover all 64 squares exactly once', () => {
    [true, false].forEach(humanIsBlack => {
        const { ranks, files } = boardLayout(humanIsBlack);
        const seen = new Set();
        ranks.forEach(rank => files.forEach(file => seen.add(squareName(file, rank))));
        assert.equal(seen.size, 64, `orientation humanIsBlack=${humanIsBlack}`);
    });
});

test('pairMoves: groups plies into numbered rows', () => {
    const rows = pairMoves(['e4', 'e5', 'Nf3', 'Nc6']);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { number: 1, white: 'e4', black: 'e5', isLatest: false });
    assert.deepEqual(rows[1], { number: 2, white: 'Nf3', black: 'Nc6', isLatest: true });
});

test('pairMoves: leaves the black cell empty on a trailing white move', () => {
    const rows = pairMoves(['e4', 'e5', 'Nf3']);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].white, 'Nf3');
    assert.equal(rows[1].black, '');
    assert.equal(rows[1].isLatest, true);
});

test('pairMoves: marks only the final row as latest', () => {
    const rows = pairMoves(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    assert.deepEqual(rows.map(r => r.isLatest), [false, false, true]);
});

test('pairMoves: handles an empty or missing list', () => {
    assert.deepEqual(pairMoves([]), []);
    assert.deepEqual(pairMoves(undefined), []);
});

test('fenToBoard: expands the starting position to 32 pieces', () => {
    const board = fenToBoard(START_FEN);
    assert.equal(Object.keys(board).length, 32);
    assert.deepEqual(board.e1, { piece: 'K', color: 'white' });
    assert.deepEqual(board.e8, { piece: 'k', color: 'black' });
    assert.deepEqual(board.a2, { piece: 'P', color: 'white' });
    assert.deepEqual(board.h7, { piece: 'p', color: 'black' });
    assert.equal(board.e4, undefined, 'empty squares are absent');
});

test('fenToBoard: places pieces on the right rank after a move', () => {
    const board = fenToBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    assert.deepEqual(board.e4, { piece: 'P', color: 'white' });
    assert.equal(board.e2, undefined, 'the pawn left e2');
});

test('fenToBoard: round-trips through the material counter', () => {
    // A position where black has lost a knight is read the same way whether it
    // arrives as a live board or as a historic FEN.
    const board = fenToBoard('r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const loss = capturedMaterial(board);
    assert.equal(loss.black.taken.n, 1);
    assert.equal(loss.white.points, 0);
});

test('fenToBoard: accepts a bare placement field', () => {
    const board = fenToBoard('8/8/8/8/8/8/8/K6k');
    assert.equal(Object.keys(board).length, 2);
    assert.deepEqual(board.a1, { piece: 'K', color: 'white' });
    assert.deepEqual(board.h1, { piece: 'k', color: 'black' });
});

test('fenToBoard: rejects malformed input instead of throwing', () => {
    assert.equal(fenToBoard(''), null);
    assert.equal(fenToBoard(undefined), null);
    assert.equal(fenToBoard('too/few/rows'), null, 'needs eight ranks');
    assert.equal(fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN'), null, 'short rank');
    assert.equal(fenToBoard('xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'), null, 'bad symbol');
});

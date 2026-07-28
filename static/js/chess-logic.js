// Pure board logic shared by the browser and the Node test suite. Nothing here
// touches the DOM, fetches, or module-level game state, so every function can
// be exercised directly from tests.
//
// The browser loads this with a plain <script> tag before game.js and reads it
// off window.KingsideLogic. Node requires it as CommonJS.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.KingsideLogic = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const CAPTURE_GLYPHS = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    // Heaviest first, so a rail reads queen down to pawn.
    const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];
    const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };

    function emptyCounts() {
        return { p: 0, n: 0, b: 0, r: 0, q: 0 };
    }

    // Counts what each side has lost by comparing the live board against a full
    // piece set, rather than replaying the move list. Kings are ignored: they
    // are never captured and carry no material value.
    function capturedMaterial(board) {
        const remaining = { white: emptyCounts(), black: emptyCounts() };

        Object.values(board || {}).forEach(entry => {
            if (!entry || !entry.piece || !remaining[entry.color]) return;
            const type = entry.piece.toLowerCase();
            if (type in remaining[entry.color]) remaining[entry.color][type] += 1;
        });

        const lossFor = color => {
            const taken = {};
            let points = 0;
            CAPTURE_ORDER.forEach(type => {
                // Promotion can put more of a piece on the board than the game
                // started with, which would otherwise report a negative count.
                taken[type] = Math.max(0, STARTING_COUNTS[type] - remaining[color][type]);
                points += taken[type] * PIECE_VALUES[type];
            });
            return { taken, points };
        };

        return { white: lossFor('white'), black: lossFor('black') };
    }

    // Material swing from one side's point of view. Positive means that side is
    // ahead by that many points.
    function materialAdvantage(board, color) {
        const loss = capturedMaterial(board);
        const opponent = color === 'white' ? 'black' : 'white';
        return loss[opponent].points - loss[color].points;
    }

    function squareName(file, rank) {
        return String.fromCharCode(97 + file) + (rank + 1);
    }

    function isLightSquare(file, rank) {
        return (file + rank) % 2 === 1;
    }

    // Row and column order for drawing the board from one player's side, plus
    // the edges that carry the rank and file labels.
    function boardLayout(humanIsBlack) {
        return humanIsBlack
            ? {
                ranks: [0, 1, 2, 3, 4, 5, 6, 7],
                files: [7, 6, 5, 4, 3, 2, 1, 0],
                bottomRank: 7,
                leftFile: 7,
            }
            : {
                ranks: [7, 6, 5, 4, 3, 2, 1, 0],
                files: [0, 1, 2, 3, 4, 5, 6, 7],
                bottomRank: 0,
                leftFile: 0,
            };
    }

    // Groups a flat SAN list into numbered rows for the notation panel. A game
    // that ends on White's move leaves the black cell empty.
    function pairMoves(sanMoves) {
        const moves = sanMoves || [];
        const rows = [];
        for (let index = 0; index < moves.length; index += 2) {
            rows.push({
                number: Math.floor(index / 2) + 1,
                white: moves[index],
                black: moves[index + 1] || '',
                isLatest: index + 2 >= moves.length,
            });
        }
        return rows;
    }

    // Expands the placement field of a FEN into the same square map the server
    // sends for the live board, so a historic position can be drawn by the
    // ordinary board code. Returns null for anything unparseable.
    function fenToBoard(fen) {
        if (typeof fen !== 'string' || !fen.trim()) return null;
        const rows = fen.trim().split(/\s+/)[0].split('/');
        if (rows.length !== 8) return null;

        const board = {};
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            const rank = 7 - rowIndex; // A FEN starts at rank 8.
            let file = 0;
            for (const symbol of rows[rowIndex]) {
                if (symbol >= '1' && symbol <= '8') {
                    file += Number(symbol);
                } else if ('prnbqkPRNBQK'.includes(symbol)) {
                    if (file > 7) return null;
                    board[squareName(file, rank)] = {
                        piece: symbol,
                        color: symbol === symbol.toUpperCase() ? 'white' : 'black',
                    };
                    file += 1;
                } else {
                    return null;
                }
            }
            if (file !== 8) return null;
        }
        return board;
    }

    return {
        PIECE_VALUES,
        CAPTURE_GLYPHS,
        CAPTURE_ORDER,
        STARTING_COUNTS,
        capturedMaterial,
        materialAdvantage,
        squareName,
        isLightSquare,
        boardLayout,
        pairMoves,
        fenToBoard,
    };
}));

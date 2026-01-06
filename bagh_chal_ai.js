/**
 * Bagh Chal Super Hard Mode AI
 * Implements Minimax with Alpha-Beta Pruning, Iterative Deepening, 
 * Transposition Tables (Zobrist Hashing), and Killer Move Heuristic.
 */

// Constants for board and pieces
const EMPTY = 0;
const TIGER = 1;
const GOAT = 2;
const WIDTH = 5;
const HEIGHT = 5;
const BOARD_SIZE = 25;

// Game Phases
const PHASE_PLACEMENT = 0; // Placing goats
const PHASE_MOVEMENT = 1;  // Moving goats

// Scores
const WIN_SCORE = 100000;
const LOSS_SCORE = -100000;
const MAX_DEPTH_LIMIT = 20;

class BaghChalGame {
    constructor() {
        this.board = new Int8Array(BOARD_SIZE).fill(EMPTY);
        this.turn = GOAT; // Goats usually start by placing
        this.goatsPlaced = 0;
        this.goatsCaptured = 0;
        this.history = [];
        this.zobristTable = this.initZobrist();
        this.boardHash = 0n; // Current Zobrist hash

        // Initialize Tigers at corners
        this.placeTiger(0, 0);
        this.placeTiger(0, 4);
        this.placeTiger(4, 0);
        this.placeTiger(4, 4);

        // Update hash for initial state
        this.boardHash = this.computeHash();
    }

    placeTiger(r, c) {
        this.board[r * WIDTH + c] = TIGER;
    }

    // --- Zobrist Hashing Initialization ---
    initZobrist() {
        const table = []; // 25 positions * 3 piece types (Empty, Tiger, Goat)
        for (let i = 0; i < BOARD_SIZE; i++) {
            table[i] = [];
            for (let j = 0; j < 3; j++) {
                // Random 64-bit integer simulation
                table[i][j] = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
            }
        }
        return table;
    }

    computeHash() {
        let h = 0n;
        for (let i = 0; i < BOARD_SIZE; i++) {
            const piece = this.board[i];
            h ^= this.zobristTable[i][piece];
        }
        // XOR in extra state info (turn, goats placed) to distinguish states
        h ^= BigInt(this.turn);
        h ^= BigInt(this.goatsPlaced);
        return h;
    }

    // --- Move Generation ---

    // Check if connected graph wise (all adjacent including diagonals)
    // In Bagh Chal, lines are specific. 
    // All nodes connected orthogonal. Diagonals only on some nodes.
    // Standard board: All intersections connected orthogonally.
    // Diagonals exist in a specific pattern.
    // For simplicity in this implementation, we assume standard grid where:
    // (r+c) is even => has diagonals? No, the drawing is specific.
    // Standard diag map:
    // (0,0) (0,2) (0,4)
    // (1,1) (1,3)
    // (2,0) (2,2) (2,4)
    // (3,1) (3,3)
    // (4,0) (4,2) (4,4)
    // Let's implement an adjacency list for speed and correctness.
    getNeighbors(idx) {
        const neighbors = [];
        const r = Math.floor(idx / 5);
        const c = idx % 5;

        // Orthogonal
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let d of dirs) {
            const nr = r + d[0];
            const nc = c + d[1];
            if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
                neighbors.push(nr * 5 + nc);
            }
        }

        // Diagonals - Only valid for specific nodes
        // Pattern: Even sum of coordinates + some odd logic?
        // Easier: Precompute adjacency map for 5x5 Alquerque-like board.
        // Actually Bagh Chal board has diagonals on all squares?
        // Looking at boards: It's typically a grid with diagonals in every quad?
        // Wait, standard Bagh Chal board has diagonals connecting corners and mid points.
        // Let's refine the standard rule:
        // A node at (r,c) has diagonal inputs if (r+c)%2 == 0.
        if ((r + c) % 2 === 0) {
            const diags = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (let d of diags) {
                const nr = r + d[0];
                const nc = c + d[1];
                if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
                    neighbors.push(nr * 5 + nc);
                }
            }
        }
        return neighbors;
    }

    getLegalMoves(player) {
        const moves = [];

        if (player === GOAT) {
            // Phase 1: Placement
            if (this.goatsPlaced < 20) {
                for (let i = 0; i < BOARD_SIZE; i++) {
                    if (this.board[i] === EMPTY) {
                        moves.push({ type: 'place', to: i });
                    }
                }
            }
            // Phase 2: Movement
            else {
                for (let i = 0; i < BOARD_SIZE; i++) {
                    if (this.board[i] === GOAT) {
                        const neighbors = this.getNeighbors(i);
                        for (let n of neighbors) {
                            if (this.board[n] === EMPTY) {
                                moves.push({ type: 'move', from: i, to: n });
                            }
                        }
                    }
                }
            }
        } else { // TIGER
            for (let i = 0; i < BOARD_SIZE; i++) {
                if (this.board[i] === TIGER) {
                    const neighbors = this.getNeighbors(i);
                    for (let n of neighbors) {
                        // Move
                        if (this.board[n] === EMPTY) {
                            moves.push({ type: 'move', from: i, to: n });
                        }
                        // Capture (Jump)
                        else if (this.board[n] === GOAT) {
                            // Check jump landing
                            const r1 = Math.floor(i / 5), c1 = i % 5;
                            const r2 = Math.floor(n / 5), n_c2 = n % 5; // variable name collision fix
                            const dr = r2 - r1;
                            const dc = n_c2 - c1;

                            const r3 = r2 + dr;
                            const c3 = n_c2 + dc;

                            if (r3 >= 0 && r3 < 5 && c3 >= 0 && c3 < 5) {
                                const dest = r3 * 5 + c3;
                                if (this.board[dest] === EMPTY) {
                                    moves.push({ type: 'capture', from: i, to: dest, jumped: n });
                                }
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    makeMove(move) {
        // Save state for undo
        const state = {
            board: new Int8Array(this.board),
            turn: this.turn,
            goatsPlaced: this.goatsPlaced,
            goatsCaptured: this.goatsCaptured,
            hash: this.boardHash
        };
        this.history.push(state);

        // Execute
        if (move.type === 'place') {
            this.board[move.to] = GOAT;
            this.goatsPlaced++;
        } else if (move.type === 'move') {
            this.board[move.from] = EMPTY;
            this.board[move.to] = this.turn;
        } else if (move.type === 'capture') {
            this.board[move.from] = EMPTY;
            this.board[move.to] = TIGER;
            this.board[move.jumped] = EMPTY; // Remove goat
            this.goatsCaptured++;
        }

        // Update Hash (Simplified: Recomputing is safer for prototyping, 
        // incremental is better for speed. Utilizing recompute for correctness here)
        this.turn = (this.turn === TIGER) ? GOAT : TIGER;
        this.boardHash = this.computeHash();
    }

    undoMove() {
        const state = this.history.pop();
        this.board = state.board;
        this.turn = state.turn;
        this.goatsPlaced = state.goatsPlaced;
        this.goatsCaptured = state.goatsCaptured;
        this.boardHash = state.hash;
    }

    isGameOver() {
        if (this.goatsCaptured >= 5) return { over: true, winner: TIGER };

        // Goats win if tigers trapped
        // Check if current player (TIGER) has moves. 
        // If turn is TIGER and no moves => Goats win.
        if (this.turn === TIGER) {
            const moves = this.getLegalMoves(TIGER);
            if (moves.length === 0) return { over: true, winner: GOAT };
        }
        return { over: false, winner: null };
    }
}

class AI {
    constructor(game) {
        this.game = game;
        this.transpositionTable = new Map(); // Key: BigInt, Val: {depth, score, flag, bestMove}
        this.killerMoves = []; // [depth][move]
        this.nodesVisited = 0;
        this.startTime = 0;
        this.timeLimit = 2000; // ms
    }

    // --- Dynamic Search Depth ---
    getDynamicDepth() {
        if (this.game.goatsPlaced < 20) return 5; // Early game (Insertion phase is Branching heavy)
        if (this.game.goatsCaptured < 2) return 6; // Mid game
        return 8; // End game (less pieces or critical moments)
    }

    getBestMove(timeLimit = 2000) {
        this.timeLimit = timeLimit;
        this.startTime = Date.now();
        this.nodesVisited = 0;
        this.killerMoves = [];
        this.transpositionTable.clear(); // Optional: Keep for persistent learning

        let bestMove = null;
        let bestScore = -Infinity;

        // Iterative Deepening
        const maxDepth = this.getDynamicDepth();
        let currentDepth = 1;

        console.log(`Starting search. Phase: ${this.game.goatsPlaced < 20 ? 'Placement' : 'Movement'}. Target Depth: ${maxDepth}`);

        for (let d = 1; d <= maxDepth; d++) {
            currentDepth = d;
            try {
                const result = this.alphaBeta(d, -Infinity, Infinity, true);
                bestMove = result.move;
                bestScore = result.score;

                // Print info
                console.log(`Depth ${d}: Score ${bestScore}, Move ${JSON.stringify(bestMove)}, Nodes ${this.nodesVisited}`);

                // Time check
                if (Date.now() - this.startTime > this.timeLimit) break;

                // Winning move found?
                if (bestScore === WIN_SCORE) break;
            } catch (e) {
                if (e.message === 'timeout') break;
                throw e;
            }
        }

        return bestMove;
    }

    alphaBeta(depth, alpha, beta, isMaximizing) {
        // Time Check
        if ((this.nodesVisited & 2047) === 0) { // Check every ~2000 nodes
            if (Date.now() - this.startTime > this.timeLimit) throw new Error('timeout');
        }
        this.nodesVisited++;

        // Transposition Table Lookup
        const hash = this.game.boardHash;
        const ttEntry = this.transpositionTable.get(hash);
        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === 'exact') return { score: ttEntry.score, move: ttEntry.bestMove };
            if (ttEntry.flag === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score;
            if (ttEntry.flag === 'upper' && ttEntry.score < beta) beta = ttEntry.score;
            if (alpha >= beta) return { score: ttEntry.score, move: ttEntry.bestMove };
        }

        // Terminal or Leaf
        const gameState = this.game.isGameOver();
        if (gameState.over) {
            if (gameState.winner === this.game.turn) return { score: WIN_SCORE + depth }; // Prefer winning faster
            else return { score: LOSS_SCORE - depth };
        }
        if (depth === 0) {
            return { score: this.evaluate(), move: null };
        }

        const moves = this.game.getLegalMoves(this.game.turn);

        // Move Ordering
        this.orderMoves(moves, depth);

        let bestMove = null;
        let value = -Infinity; // We always view from perspective of current player for NegaMax style, 
        // but here we are doing explicit Minimax. 
        // Let's stick to standard Minimax with isMaximizing relative to AI role.

        // Actually, to keep it simple with generalized minimax:
        // We want to maximize the score for the 'AI Player' and minimize for 'Opponent'.
        // Let's assume this AI plays the current 'this.game.turn'.
        // So we want to maximize THIS turn's value.
        // Wait, standard Minimax usually has (depth, alpha, beta, isMaximizing).
        // If isMaximizing is true, we want max score.
        // But the evaluation function changes perspective or generates score for "Tiger"?
        // Let's define: Score is always relative to TIGER.
        // Tiger wants Max (+), Goat wants Min (-).

        const isTiger = this.game.turn === TIGER;

        if (isTiger) {
            value = -Infinity;
            for (const move of moves) {
                this.game.makeMove(move);
                let result;
                try {
                    // Next turn is Goat (minimizer)
                    result = this.alphaBeta(depth - 1, alpha, beta, false);
                } catch (e) {
                    this.game.undoMove();
                    throw e;
                }
                this.game.undoMove();

                if (result.score > value) {
                    value = result.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break; // Beta Cutoff (Tiger found a move too good, Goat won't allow it)
            }
        } else { // GOAT
            value = Infinity;
            for (const move of moves) {
                this.game.makeMove(move);
                let result;
                try {
                    // Next turn is Tiger (maximizer)
                    result = this.alphaBeta(depth - 1, alpha, beta, true);
                } catch (e) {
                    this.game.undoMove();
                    throw e;
                }
                this.game.undoMove();

                if (result.score < value) {
                    value = result.score;
                    bestMove = move;
                }
                beta = Math.min(beta, value);
                if (beta <= alpha) break; // Alpha Cutoff
            }
        }

        // Store in Transposition Table
        let flag = 'exact';
        if (value <= alpha) flag = 'upper';
        else if (value >= beta) flag = 'lower';

        this.transpositionTable.set(hash, {
            depth: depth,
            score: value,
            flag: flag,
            bestMove: bestMove
        });

        // Store Killer Move if it caused a cutoff
        if (bestMove) {
            if (!this.killerMoves[depth]) this.killerMoves[depth] = [];
            // Simple logic: store last killer move. Better: store 2.
            this.killerMoves[depth][0] = bestMove;
        }

        return { score: value, move: bestMove };
    }

    orderMoves(moves, depth) {
        // Sort moves to improve pruning
        // 1. Hash move (from TT)?
        // 2. Captures (for Tiger)
        // 3. Killer moves
        // 4. History heuristic (not impl here, simpler version)

        moves.sort((a, b) => {
            // Prioritize Captures
            const isCaptureA = a.type === 'capture' ? 1000 : 0;
            const isCaptureB = b.type === 'capture' ? 1000 : 0;
            if (isCaptureA !== isCaptureB) return isCaptureB - isCaptureA;

            // Prioritize Killer Moves
            const killer = this.killerMoves[depth] ? this.killerMoves[depth][0] : null;
            const isKillerA = (killer && this.movesEqual(a, killer)) ? 500 : 0;
            const isKillerB = (killer && this.movesEqual(b, killer)) ? 500 : 0;
            return isKillerB - isKillerA;
        });
    }

    movesEqual(m1, m2) {
        return m1.type === m2.type && m1.from === m2.from && m1.to === m2.to;
    }

    // --- Advanced Evaluation Function ---
    evaluate() {
        // Score always relative to TIGER.
        // Tiger wants Max, Goat wants Min.

        let score = 0;

        // 1. Material (Captured Goats)
        // High weight: Capturing goats is the win condition for Tiger.
        score += this.game.goatsCaptured * 2000;

        // 2. Mobility (Tiger moves available)
        // Critical for avoiding entrapment (Loss for Tiger).
        let tigerMoves = 0;
        let trappedTigers = 0;

        // Scan for tigers and their moves
        // We need to temporarily generate tiger moves even if it's Goat's turn
        // to assess the board state "danger".
        for (let i = 0; i < BOARD_SIZE; i++) {
            if (this.game.board[i] === TIGER) {
                const moves = [];
                const neighbors = this.game.getNeighbors(i);
                let canMove = false;
                for (let n of neighbors) {
                    if (this.game.board[n] === EMPTY) {
                        canMove = true;
                        tigerMoves++;
                    } else if (this.game.board[n] === GOAT) {
                        // Check jump
                        const r1 = Math.floor(i / 5), c1 = i % 5;
                        const r2 = Math.floor(n / 5), c2 = n % 5;
                        const r3 = r2 + (r2 - r1);
                        const c3 = c2 + (c2 - c1);
                        if (r3 >= 0 && r3 < 5 && c3 >= 0 && c3 < 5) {
                            if (this.game.board[r3 * 5 + c3] === EMPTY) {
                                canMove = true;
                                tigerMoves += 2; // Jump is valuable mobility
                            }
                        }
                    }
                }
                if (!canMove) trappedTigers++;
            }
        }

        // Mobility Weight
        score += tigerMoves * 20;

        // Trapped Penalty (Huge penalty for Tiger)
        // If 4 trapped, game over, handled by isGameOver usually, but heuristic helps avoid getting close.
        score -= trappedTigers * 500;

        // 3. Goat Structure (Goat's perspective: Minimize Score)
        // Goats want to form clumps/connected walls.
        // We can scan goats and see how many neighbors are other goats (Protection).
        let goatProtection = 0;
        let goatsCenter = 0;

        for (let i = 0; i < BOARD_SIZE; i++) {
            if (this.game.board[i] === GOAT) {
                const neighbors = this.game.getNeighbors(i);
                for (let n of neighbors) {
                    if (this.game.board[n] === GOAT) {
                        goatProtection++;
                    }
                }

                // Position bonus: Goats in center/intersections are stronger blockers?
                // Actually edge goats are safer from jumps, centralized ones control space.
                // Strategy: Phase 1 (corners/edges safe), Phase 2 (block tigers).
                // Let's reward goats for limiting Tiger mobility (already covered by tigerMoves metric somewhat).

                // "Goats ka structure (connected blocking)"
                // Higher goatProtection means clumps.
                // Clumps are good for Goats -> Negative score for Tiger.
            }
        }

        score -= goatProtection * 10;

        // 4. Future Capture Possibilities (Tiger aggression)
        // Already checked in tigerMoves (jumps count as mobility).
        // Maybe add bonus for "Threats" -> A goat is adjacent to a tiger with an empty space behind.

        return score;
    }
}

// --- Example Usage / Testing ---
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const game = new BaghChalGame();
    const ai = new AI(game);

    console.log("Initial Board:");
    printBoard(game.board);

    // Example: Find best move for Goat (starts first)
    console.log("\nFinding best move for Goat (Phase 1)...");
    const bestMove = ai.getBestMove(1000); // 1 sec limit
    console.log("Best Move found:", bestMove);

    game.makeMove(bestMove);
    printBoard(game.board);
}

function printBoard(board) {
    const symbols = ['.', 'T', 'G'];
    for (let r = 0; r < 5; r++) {
        let row = '';
        for (let c = 0; c < 5; c++) {
            row += symbols[board[r * 5 + c]] + ' ';
        }
        console.log(row);
    }
}

// Export for ES Modules (Browser) or Global
if (typeof window !== 'undefined') {
    window.BaghChalGame = BaghChalGame;
    window.AI = AI;
    window.EMPTY = EMPTY;
    window.TIGER = TIGER;
    window.GOAT = GOAT;
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = { BaghChalGame, AI, EMPTY, TIGER, GOAT };
} else {
    // Other environments (workers etc) just rely on scope
}

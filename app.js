// Imports removed for global scope compatibility on Android WebView (file://)
// Assumes bagh_chal_ai.js is loaded before this script


class GameController {
    constructor() {
        this.game = new BaghChalGame();
        this.ai = new AI(this.game);
        this.selectedCell = null; // For movement phase
        this.isAiThinking = false;

        // DOM Elements
        this.boardGridSect = document.getElementById('board-grid');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.goatsPlacedEl = document.getElementById('goats-placed');
        this.goatsCapturedEl = document.getElementById('goats-captured');
        this.gamePhaseEl = document.getElementById('game-phase');
        this.messageArea = document.getElementById('message-area');
        this.resetBtn = document.getElementById('reset-btn');
        this.aiMoveBtn = document.getElementById('ai-move-btn');
        this.modal = document.getElementById('game-over-modal');
        this.winnerText = document.getElementById('winner-text');
        this.modalRestart = document.getElementById('modal-restart');

        this.init();
    }

    init() {
        this.createBoard();
        this.updateUI();
        this.addEventListeners();
        // Initial render
        this.renderPieces();
    }

    createBoard() {
        this.boardGridSect.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.handleCellClick(i));
            this.boardGridSect.appendChild(cell);
        }
        // Don't render here, init calls it
    }

    addEventListeners() {
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.modalRestart.addEventListener('click', () => {
            this.modal.classList.add('hidden');
            this.resetGame();
        });
        this.aiMoveBtn.addEventListener('click', () => {
            if (!this.isAiThinking && !this.game.isGameOver().over) {
                this.performAiMove();
            }
        });

        // Keyboard shortcut for AI move
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isAiThinking && !this.game.isGameOver().over) {
                e.preventDefault(); // Prevent scrolling
                this.performAiMove();
            }
        });
    }

    resetGame() {
        this.game = new BaghChalGame();
        this.ai = new AI(this.game);
        this.selectedCell = null;
        this.isAiThinking = false;
        this.updateUI();
        this.renderPieces();
        this.messageArea.textContent = "New game started. Place a goat.";
        this.modal.classList.add('hidden');
    }

    handleCellClick(index) {
        if (this.isAiThinking) return;

        const gameState = this.game.isGameOver();
        if (gameState.over) return;

        // Human is GOAT. Tiger is AI.
        // Assuming user plays as GOAT for now (since AI is hardcoded to optimize for both, but usually we assign one).
        // The request said "Super Hard Mode AI", usually implies Player vs AI.
        // Let's assume Player = Goat (Start), AI = Tiger (Defend).
        // Or we can let player play both or swap. 
        // Standard: Player (Goat) goes first.

        if (this.game.turn !== GOAT) {
            this.messageArea.textContent = "It's Tiger's (AI) turn! Please wait.";
            return;
        }

        const legalMoves = this.game.getLegalMoves(GOAT);

        // Phase 1: Placement
        if (this.game.goatsPlaced < 20) {
            const move = legalMoves.find(m => m.type === 'place' && m.to === index);
            if (move) {
                this.executeMove(move);
                // Trigger AI after delay
                setTimeout(() => this.performAiMove(), 600);
            } else {
                this.messageArea.textContent = "Invalid placement. Choose an empty spot.";
                this.animateInvalid(index);
            }
        }
        // Phase 2: Movement
        else {
            const piece = this.game.board[index];

            // Selecting a Goat
            if (piece === GOAT) {
                this.selectedCell = index;
                this.renderPieces(); // Re-render to show selection highlight
                this.highlightLegalDestinations(index, legalMoves);
                this.messageArea.textContent = "Goat selected. Choose destination.";
            }
            // Moving to Empty Spot
            else if (piece === EMPTY && this.selectedCell !== null) {
                const move = legalMoves.find(m =>
                    m.type === 'move' &&
                    m.from === this.selectedCell &&
                    m.to === index
                );

                if (move) {
                    this.executeMove(move);
                    this.selectedCell = null;
                    setTimeout(() => this.performAiMove(), 600);
                } else {
                    this.messageArea.textContent = "Invalid move.";
                    this.animateInvalid(index);
                }
            }
        }
    }

    highlightLegalDestinations(fromIdx, legalMoves) {
        // Clear previous highlights logic handled in render/css? 
        // We'll add a class to valid cells
        const cells = this.boardGridSect.children;
        for (let m of legalMoves) {
            if (m.from === fromIdx) {
                cells[m.to].classList.add('valid-move');
            }
        }
    }

    async performAiMove() {
        if (this.game.isGameOver().over) return;
        if (this.game.turn !== TIGER) {
            // Debug: Allow forcing AI to play Goat if needed logic was added, but stick to Tiger for now
            // If user clicked Force AI and it's Goat turn, let AI play Goat
            this.messageArea.textContent = `AI is thinking for ${this.game.turn === GOAT ? 'Goat' : 'Tiger'}...`;
        } else {
            this.messageArea.textContent = "AI (Tiger) is hunting...";
        }

        this.isAiThinking = true;
        this.updateUI(); // Show thinking state

        // Yield to render
        await new Promise(r => setTimeout(r, 50));

        try {
            // Adaptive time limit: 1s usually, but maybe more for end game
            const bestMove = this.ai.getBestMove(1000);
            if (bestMove) {
                this.executeMove(bestMove);
            } else {
                // No moves? pass? Should be loss if no moves.
                console.error("AI found no moves!");
                // Check game over
            }
        } catch (e) {
            console.error("AI Error:", e);
        }

        this.isAiThinking = false;
        this.updateUI();
    }

    executeMove(move) {
        this.game.makeMove(move);
        this.renderPieces(move.to); // Pass the destination index
        this.updateUI();

        const gameOver = this.game.isGameOver();
        if (gameOver.over) {
            this.showGameOver(gameOver);
        }
    }

    renderPieces(lastMoveIndex = -1) {
        const cells = this.boardGridSect.children;

        // Clear all states first
        for (let i = 0; i < 25; i++) {
            cells[i].innerHTML = '';
            cells[i].classList.remove('valid-move');
        }

        for (let i = 0; i < 25; i++) {
            const piece = this.game.board[i];
            if (piece === TIGER) {
                const el = document.createElement('div');
                el.classList.add('piece', 'tiger');
                // Always animate tigers? Or only if moved?
                // Tigers are few, maybe okay. 
                // But better:
                if (i === lastMoveIndex) el.classList.add('animate-enter');

                el.innerText = '🐯';
                cells[i].appendChild(el);
            } else if (piece === GOAT) {
                const el = document.createElement('div');
                el.classList.add('piece', 'goat');

                if (i === lastMoveIndex) el.classList.add('animate-enter');

                // Add selected class
                if (i === this.selectedCell) {
                    el.classList.add('selected');
                }

                el.innerText = '🐐';
                cells[i].appendChild(el);
            }
        }
    }

    animateInvalid(index) {
        const cell = this.boardGridSect.children[index];
        cell.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(0)' }
        ], { duration: 200 });
    }

    updateUI() {
        const turn = this.game.turn === GOAT ? 'Goat' : 'Tiger';

        // Update Turn Indicator
        this.turnIndicator.className = `turn-badge ${turn === 'Goat' ? 'goat-turn' : 'tiger-turn'}`;
        this.turnIndicator.innerHTML = turn === 'Goat'
            ? '<span class="icon">🐐</span> Goat\'s Turn'
            : '<span class="icon">🐯</span> Tiger\'s Turn';

        // Stats
        this.goatsPlacedEl.textContent = `${this.game.goatsPlaced}/20`;
        const capEl = this.goatsCapturedEl;
        capEl.textContent = `${this.game.goatsCaptured}/5`;
        if (this.game.goatsCaptured >= 4) capEl.classList.add('danger'); // Warning

        this.gamePhaseEl.textContent = this.game.goatsPlaced < 20 ? "Placement" : "Movement";

        // Message
        if (!this.isAiThinking) {
            if (turn === 'Goat') {
                if (this.game.goatsPlaced < 20) this.messageArea.textContent = "Place a goat on an empty spot.";
                else this.messageArea.textContent = "Move a goat to an adjacent spot.";
            } else {
                this.messageArea.textContent = "Waiting for AI Tiger...";
            }
        }
    }

    showGameOver(result) {
        this.modal.classList.remove('hidden');
        if (result.winner === TIGER) {
            this.winnerText.innerText = "Tiger Wins!";
            this.winnerText.style.color = "#f97316";
        } else {
            this.winnerText.innerText = "Goats Win!";
            this.winnerText.style.color = "#94a3b8";
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.gameController = new GameController();
});

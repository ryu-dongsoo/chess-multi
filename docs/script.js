class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
            this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.moveHistory = [];
        this.gameMode = 'local';
        this.playerColor = 'white';
        this.aiDifficulty = 'medium';
        this.soundEnabled = true;
        this.audioContext = null;
        
        // 시간 제어 변수들
        this.timeControl = 'no-limit';
        this.whiteTime = 0;
        this.blackTime = 0;
        this.gameStartTime = null;
        this.timerInterval = null;
        
        // 게임 종료 상태 추적
        this.gameOver = false;
        this.winner = null;
        
        // 딥러닝 모델 초기화
        this.deepLearningModel = this.initializeDeepLearningModel();
        
        // Stockfish AI 엔진 초기화
        // this.stockfish = null;
        // this.stockfishReady = false;
        // this.initializeStockfish();
        
        // 성능 최적화를 위한 캐시
        this.moveCache = new Map();
        this.evaluationCache = new Map();
        this.validMovesCache = new Map();
        this.lastCacheClear = Date.now();
        
        // 렌더링 최적화
        this.lastRenderTime = 0;
        this.renderThrottle = 16; // 60fps
        
        this.initializeAudio();
        this.initializeBoard();
        this.setupEventListeners();
        this.updateGameStatus();
    }

    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.log('AudioContext not supported');
        }
    }

    // 강화된 AI 엔진 초기화 (사람이 절대 이길 수 없는 수준)
    // initializeStockfish() {
    //     console.log('Stockfish 엔진 초기화 시작...');
        
    //     try {
    //         // 로컬 파일 접근 제한으로 인해 API 방식으로 폴백
    //         console.log('로컬 Stockfish Web Worker 접근 제한으로 API 방식 사용');
    //         this.stockfish = null;
    //         this.stockfishReady = false;
            
    //         // API 방식으로 Stockfish 사용
    //         console.log('Stockfish API 방식으로 초기화 완료');
    //     } catch (error) {
    //         console.error('Stockfish 초기화 실패:', error);
    //         this.stockfishReady = false;
    //     }
    // }

    // Stockfish 메시지 처리
    handleStockfishMessage(message) {
        console.log('Stockfish 메시지:', message);
        
        if (message === 'readyok') {
            this.stockfishReady = true;
            console.log('Stockfish가 준비되었습니다! - 정말 이길 수 없을 정도로 강력함!');
        } else if (message.startsWith('bestmove')) {
            this.handleStockfishMove(message);
        } else if (message.startsWith('info')) {
            // Stockfish의 분석 정보 로깅
            if (message.includes('depth') || message.includes('score')) {
                console.log('Stockfish 분석:', message);
            }
        }
    }

    // Stockfish 이동 처리
    handleStockfishMove(message) {
        const parts = message.split(' ');
        if (parts.length >= 2) {
            const move = parts[1];
            console.log('Stockfish 이동:', move);
            
            // UCI 형식의 이동을 체스 좌표로 변환
            const chessMove = this.uciToChessMove(move);
            if (chessMove) {
                this.executeStockfishMove(chessMove);
            }
        }
    }

    // UCI 형식을 체스 좌표로 변환
    uciToChessMove(uciMove) {
        if (uciMove.length < 4) return null;
        
        const fromCol = uciMove.charCodeAt(0) - 97; // 'a' = 0
        const fromRow = 8 - parseInt(uciMove[1]);   // '1' = 7
        const toCol = uciMove.charCodeAt(2) - 97;   // 'a' = 0
        const toRow = 8 - parseInt(uciMove[3]);     // '1' = 7
        
        return {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol }
        };
    }

    // Stockfish 이동 실행
    executeStockfishMove(move) {
        const { from, to } = move;
        const piece = this.board[from.row][from.col];
        
        if (piece && this.isValidMove(from.row, from.col, to.row, to.col)) {
            console.log(`Stockfish 이동 실행: ${this.getSquareNotation(from)} → ${this.getSquareNotation(to)}`);
            this.makeMove(from.row, from.col, to.row, to.col);
        } else {
            console.error('Stockfish 이동이 유효하지 않습니다:', move);
        }
    }

    playPieceSound() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            // 나무 소리를 위한 노이즈 생성
            const bufferSize = this.audioContext.sampleRate * 0.15; // 0.15초 지속
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            // 나무 소리를 위한 노이즈 생성 (낮은 주파수 중심)
            for (let i = 0; i < bufferSize; i++) {
                // 낮은 주파수 노이즈 (나무 소리)
                const noise = (Math.random() - 0.5) * 2;
                const envelope = Math.exp(-i / (bufferSize * 0.3)); // 자연스러운 감쇠
                output[i] = noise * envelope * 0.6; // 볼륨 증가
            }
            
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 볼륨 설정 (더 크게)
            gainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
            
            source.start(this.audioContext.currentTime);
            source.stop(this.audioContext.currentTime + 0.15);
            
        } catch (error) {
            console.log('Sound play failed:', error);
        }
    }

    initializeBoard() {
        this.board = [
            ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
            ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
            ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
        ];
    }

    setupEventListeners() {
        const chessboard = document.getElementById('chessboard');
        if (!chessboard) return;

        // 체스판 클릭 이벤트 (이벤트 위임 사용)
        chessboard.addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (square) {
                this.handleSquareClick(square);
            }
        });

        // 게임 모드 버튼들 (이벤트 위임 사용)
        const controlsContainer = document.querySelector('.controls');
        if (controlsContainer) {
            controlsContainer.addEventListener('click', (e) => {
                const target = e.target;
                
                if (target.id === 'local-btn') {
                    console.log('로컬 2인 버튼 클릭됨');
                    this.setGameMode('local');
                } else if (target.id === 'ai-btn') {
                    console.log('AI 대전 버튼 클릭됨');
                    this.setGameMode('ai');
                } else if (target.id === 'online-btn') {
                    console.log('온라인 플레이 버튼 클릭됨');
                    this.setGameMode('online');
                } else if (target.id === 'puzzle-btn') {
                    console.log('퍼즐 버튼 클릭됨');
                    this.setGameMode('puzzle');
                    const puzzleTypes = ['checkmate', 'tactics', 'endgame'];
                    const randomType = puzzleTypes[Math.floor(Math.random() * puzzleTypes.length)];
                    this.startPuzzle(randomType);
                } else if (target.id === 'tactics-btn') {
                    console.log('전술 버튼 클릭됨');
                    this.setGameMode('tactics');
                }
            });
        }

        // 온라인 플레이 버튼들
        document.getElementById('create-room-btn')?.addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn')?.addEventListener('click', () => this.joinRoom());
        document.getElementById('random-match-btn')?.addEventListener('click', () => this.randomMatch());

        // AI 난이도 버튼들
        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setAIDifficulty(e.target.dataset.difficulty);
            });
        });

        // 게임 컨트롤 버튼들
        document.getElementById('reset-btn')?.addEventListener('click', () => this.resetGame());
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undoMove());

        // 시간 제어 버튼들
        document.querySelectorAll('[data-time]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTimeControl(e.target.dataset.time);
            });
        });

        // 전술 분석 버튼들
        document.querySelectorAll('[data-tactic]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.analyzeTactic(e.target.dataset.tactic);
            });
        });

        // 전술 연습 버튼
        document.getElementById('tactic-practice-btn')?.addEventListener('click', () => {
            this.startTacticPractice();
        });

        // AI 컨트롤 버튼들
        document.getElementById('train-ai-btn')?.addEventListener('click', () => {
            this.startDeepLearningTraining();
        });
        
        document.getElementById('ai-analysis-btn')?.addEventListener('click', () => {
            this.showAIAnalysis();
        });

        // 퍼즐 버튼들
        document.querySelectorAll('[data-puzzle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.startPuzzle(e.target.dataset.puzzle);
            });
        });

        // 전술 버튼들
        document.querySelectorAll('[data-tactic]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.analyzeTactic(e.target.dataset.tactic);
            });
        });

        // 설정 버튼
        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());

        // 설정 패널
        document.getElementById('settings-close-btn')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-panel')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-panel') {
                this.closeSettings();
            }
        });

        // 설정 탭들
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSettingsTab(e.target.dataset.tab);
            });
        });

        // 전술 컨트롤 버튼들
        document.getElementById('analyze-tactic-btn')?.addEventListener('click', () => this.analyzeCurrentPosition());
        document.getElementById('show-tactic-btn')?.addEventListener('click', () => this.showAvailableTactics());
        document.getElementById('practice-tactic-btn')?.addEventListener('click', () => this.startTacticPractice());

        // 퍼즐 컨트롤 버튼들
        document.getElementById('hint-btn')?.addEventListener('click', () => this.showHint());
        document.getElementById('solution-btn')?.addEventListener('click', () => this.showSolution());
        document.getElementById('ai-help-btn')?.addEventListener('click', () => this.getAIHelp());

        // 설정 변경 이벤트들
        this.setupSettingsListeners();
    }

    handleSquareClick(square) {
        // 게임이 종료되었으면 클릭 무시
        if (this.gameOver) {
            console.log('게임이 종료되었습니다 - 클릭 무시');
            return;
        }

        // 온라인 모드에서 자신의 턴이 아니면 클릭 무시
        if (this.gameMode === 'online-player' && this.currentPlayer !== this.playerColor) {
            console.log(`턴 불일치 - 현재 턴: ${this.currentPlayer}, 내 색상: ${this.playerColor}`);
            console.log('클릭 무시됨');
            return;
        }

        // AI 대전 모드에서 플레이어 턴(흰색)이 아니면 클릭 무시
        if (this.gameMode === 'ai' && this.currentPlayer !== 'white') return;

        // 퍼즐 모드에서 AI 턴일 때 클릭 무시
        if (this.puzzleMode && this.puzzleAITurn) {
            console.log('AI 턴 중 - 클릭 무시');
            return;
        }

        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const piece = this.board[row][col];

        console.log(`클릭: ${row},${col} - ${piece}`);

        // 퍼즐 모드에서 플레이어는 백(white)만 선택 가능 (하지만 검은 말을 잡는 것은 가능)
        if (this.puzzleMode && piece && this.getPieceColor(piece) === 'black' && !this.selectedPiece) {
            console.log('퍼즐 모드에서 흑 말은 선택할 수 없습니다');
            return;
        }

        // 이미 선택된 말이 있는 경우
        if (this.selectedPiece) {
            const selectedRow = this.selectedPiece.row;
            const selectedCol = this.selectedPiece.col;

            // 같은 말을 다시 클릭한 경우 선택 해제
            if (selectedRow === row && selectedCol === col) {
                this.clearSelection();
                return;
            }

            // 유효한 이동인지 확인
            if (this.isValidMove(selectedRow, selectedCol, row, col)) {
                this.makeMove(selectedRow, selectedCol, row, col);
            } else {
                // 다른 말을 선택 (현재 턴의 말만 선택 가능)
                if (this.isPieceOfCurrentPlayer(piece)) {
                this.selectPiece(row, col);
                } else {
                    this.clearSelection();
                }
            }
        } else {
            // 말 선택 (현재 턴의 말만 선택 가능)
            if (this.isPieceOfCurrentPlayer(piece)) {
                console.log(`말 선택: ${piece} (${row},${col})`);
                this.selectPiece(row, col);
            } else {
                console.log(`말 선택 불가: ${piece} (${row},${col}) - 현재 턴의 말이 아님`);
            }
        }
    }

    selectPiece(row, col) {
        this.clearSelection();
        
        this.selectedPiece = { row, col };
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        square?.classList.add('selected');

        // 유효한 이동 위치 하이라이트
            this.highlightValidMoves(row, col);
    }

    clearSelection() {
        this.selectedPiece = null;
        document.querySelectorAll('.square.selected, .square.valid-move').forEach(sq => {
            sq.classList.remove('selected', 'valid-move');
        });
    }

    isPieceOfCurrentPlayer(piece) {
        if (!piece) return false;
        
        const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
        const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
        
        // 온라인 모드에서는 자신의 색깔의 말만 움직일 수 있음
        if (this.gameMode === 'online-player') {
            if (this.playerColor === 'white') {
                const isWhitePiece = whitePieces.includes(piece);
                console.log(`흰색 플레이어 말 확인: ${piece} -> ${isWhitePiece}`);
                return isWhitePiece;
            } else if (this.playerColor === 'black') {
                const isBlackPiece = blackPieces.includes(piece);
                console.log(`검은색 플레이어 말 확인: ${piece} -> ${isBlackPiece}`);
                return isBlackPiece;
            }
        }
        
        // AI 모드에서는 플레이어가 항상 흰색 말을 움직일 수 있음
        if (this.gameMode === 'ai') {
            return whitePieces.includes(piece);
        }
        
        // 퍼즐 모드에서는 플레이어가 항상 흰색 말을 움직일 수 있음
        if (this.puzzleMode) {
            return whitePieces.includes(piece);
        }
        
        // 로컬 모드에서는 현재 턴의 플레이어만 말을 움직일 수 있음
        if (this.currentPlayer === 'white') {
            return whitePieces.includes(piece);
                    } else {
            return blackPieces.includes(piece);
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol, board = this.board) {
        // 안전성 검사 추가
        if (!board || fromRow < 0 || fromRow >= 8 || fromCol < 0 || fromCol >= 8 || 
            toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) {
            return false;
        }
        
        const piece = board[fromRow][fromCol];
        const targetPiece = board[toRow][toCol];
        
        if (!piece) return false;

        // 같은 색의 말을 잡을 수 없음
        if (targetPiece && this.isPieceOfColor(targetPiece, this.getPieceColor(piece))) {
            return false;
        }

        // 캐슬링 체크
        if (this.isCastlingMove(fromRow, fromCol, toRow, toCol)) {
            return this.isValidCastling(fromRow, fromCol, toRow, toCol);
        }
        
        // 각 말의 이동 규칙 확인
        switch (piece) {
            case '♙': return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, 'white');
            case '♟': return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, 'black');
            case '♖': case '♜': return this.isValidRookMove(fromRow, fromCol, toRow, toCol);
            case '♗': case '♝': return this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
            case '♕': case '♛': return this.isValidQueenMove(fromRow, fromCol, toRow, toCol);
            case '♔': case '♚': return this.isValidKingMove(fromRow, fromCol, toRow, toCol);
            case '♘': case '♞': return this.isValidKnightMove(fromRow, fromCol, toRow, toCol);
            default: return false;
        }
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        const targetPiece = this.board[toRow][toCol];

   // 전진 (세로 이동)
   if (colDiff === 0) {
    // 한 칸 전진
    if (rowDiff === direction && !targetPiece) {
        return true;
    }
    // 두 칸 전진 (시작 위치에서만)
    if (fromRow === startRow && rowDiff === 2 * direction && !targetPiece && !this.board[fromRow + direction][fromCol]) {
        return true;
    }
}
// 대각선 이동 (말 잡기)
if (colDiff === 1 && rowDiff === direction && targetPiece) {
    return true;
}
        
        return false;
    }

    isValidRookMove(fromRow, fromCol, toRow, toCol) {
        return (fromRow === toRow || fromCol === toCol) && this.isPathClear(fromRow, fromCol, toRow, toCol);
    }

    isValidBishopMove(fromRow, fromCol, toRow, toCol) {
        return Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol) && this.isPathClear(fromRow, fromCol, toRow, toCol);
    }

    isValidQueenMove(fromRow, fromCol, toRow, toCol) {
        return this.isValidRookMove(fromRow, fromCol, toRow, toCol) || this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
    }

    isValidKingMove(fromRow, fromCol, toRow, toCol) {
        return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1;
    }

    isValidKnightMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol] !== '') {
                return false;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }

        return true;
    }

    highlightValidMoves(row, col) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const square = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    square?.classList.add('valid-move');
                    
                    // 캐슬링 이동인 경우 특별한 표시
                    const piece = this.board[row][col];
                    if (this.isCastlingMove(row, col, r, c)) {
                        square?.classList.add('castling-move');
                        console.log('캐슬링 가능한 이동 발견:', r, c);
                    }
                }
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.square.valid-move').forEach(sq => {
            sq.classList.remove('valid-move');
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        this.clearCache(); // 캐시 정리
        
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // 폰 승진 확인 (킹을 잡지 않은 경우에만)
        if (this.isPawnPromotion(toRow, toCol, piece) && !this.isKingCaptured(this.currentPlayer === 'white' ? 'black' : 'white')) {
            // 폰 승진 시에는 executeMove를 호출하지 않고 승진 다이얼로그에서 완전히 처리
            this.promotePawn(toRow, toCol);
            return; // 여기서 함수 종료, 서버 전송은 승진 완료 후에 수행
        }
        
        // 특별한 이동 처리
        const specialType = this.getSpecialMoveType(fromRow, fromCol, toRow, toCol, piece);
        
        if (specialType === 'kingside-castling' || specialType === 'queenside-castling') {
            this.executeCastling(fromRow, fromCol, toRow, toCol);
            this.executeMove(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType);
        } else if (specialType === 'en-passant') {
            this.executeEnPassant(fromRow, fromCol, toRow, toCol);
            this.executeMove(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType);
        } else {
            this.executeMove(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType);
        }
        
        // 선택 해제 및 하이라이트 제거
        this.selectedPiece = null;
        this.clearHighlights();
        
        // 사운드 재생
        this.playPieceSound();
        
        // 게임 상태 업데이트
        this.updateGameStatus();
        this.updateMoveHistory();
        this.updateCapturedPieces();
        
        // 게임 종료 확인
        this.checkGameEnd();

        // 온라인 모드라면 내 수를 서버로 전송 (폰 승진이 아닌 경우에만)
        if (this.gameMode === 'online-player') {
            this.sendMoveToServer(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType);
        }
    }

    executeMove(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType = 'normal') {
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = '';
        
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: capturedPiece,
            special: specialType
        });
        
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // 선택 해제 및 하이라이트 제거
        this.selectedPiece = null;
        this.clearHighlights();
        
        this.renderBoard();
        this.updateGameStatus();
        this.updateMoveHistory();
        
        // 게임 종료 확인
        this.checkGameEnd();
        
        // AI 이동 (필요시)
        if (this.gameMode === 'ai' && this.currentPlayer === 'black' && !this.gameOver) {
            setTimeout(() => this.makeAIMove(), 100);
        }
    }

    loadGameState(gameState) {
        console.log('=== loadGameState 호출됨 ===');
        console.log('받은 gameState:', gameState);
        
        // 서버/상대방에서 받은 상태를 정확히 반영
        if (gameState.board) {
            console.log('보드 상태 업데이트 전:', this.board);
            console.log('서버에서 받은 보드:', gameState.board);
            
            // 깊은 복사로 보드 상태 업데이트
            this.board = [];
            for (let row = 0; row < 8; row++) {
                this.board[row] = [];
                for (let col = 0; col < 8; col++) {
                    this.board[row][col] = gameState.board[row][col];
                }
            }
            
            console.log('보드 상태 업데이트 후:', this.board);
            
            // 보드 상태 검증
            let isValid = true;
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if (this.board[row][col] !== gameState.board[row][col]) {
                        console.error(`보드 상태 불일치: [${row},${col}] - 예상: "${gameState.board[row][col]}", 실제: "${this.board[row][col]}"`);
                        isValid = false;
                    }
                }
            }
            console.log('보드 상태 검증 결과:', isValid ? '성공' : '실패');
        }
        if (gameState.currentPlayer) {
            console.log(`서버에서 턴 정보 로드: ${this.currentPlayer} -> ${gameState.currentPlayer}`);
            this.currentPlayer = gameState.currentPlayer;
        }
        if (gameState.moveHistory) {
            console.log('이동 기록 업데이트:', gameState.moveHistory);
            this.moveHistory = JSON.parse(JSON.stringify(gameState.moveHistory));
        }
        
        // 보드 상태 디버깅
        console.log('상태 로드 완료:');
        console.log('보드:', this.board);
        console.log('현재 플레이어:', this.currentPlayer);
        console.log('내 색상:', this.playerColor);
        console.log('이동 기록:', this.moveHistory);
        
        console.log('UI 업데이트 시작');
        // 강제 렌더링 사용
        this.forceRenderBoard();
        this.updateGameStatus();
        this.updateMoveHistory();
        if (this.updateCapturedPieces) this.updateCapturedPieces();
        console.log('UI 업데이트 완료');
    }

    setPlayerColor(color) {
        this.playerColor = color;
    }

    updateGameStatus() {
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            let statusText = '';
            
            // 게임이 끝났을 때 상태 표시
            if (this.gameOver) {
                if (this.winner === 'white') {
                    statusText = '흰색 승리!';
                } else if (this.winner === 'black') {
                    statusText = '검은색 승리!';
                } else {
                    statusText = '무승부!';
                }
                statusElement.textContent = statusText;
                return;
            }
            
            if (this.puzzleMode) {
                if (this.puzzleAITurn) {
                    statusText = 'AI가 생각 중...';
                } else {
                    statusText = '당신의 차례';
                }
            } else if (this.gameMode === 'online-player') {
                // 온라인 모드에서는 자신의 색깔과 턴을 명확히 표시
                const myColor = this.playerColor === 'white' ? '흰색' : '검은색';
                const currentColor = this.currentPlayer === 'white' ? '흰색' : '검은색';
                
                if (this.currentPlayer === this.playerColor) {
                    statusText = `당신의 차례 (${myColor})`;
                } else {
                    statusText = `상대방의 차례 (${currentColor})`;
                }
                
                // 체크 상태 표시
                if (this.isCheck(this.currentPlayer)) {
                    statusText += ' (체크!)';
                }
            } else {
                const playerName = this.currentPlayer === 'white' ? '흰색' : '검은색';
                statusText = `${playerName} 턴`;
                
                // 체크 상태 표시
                if (this.isCheck(this.currentPlayer)) {
                    statusText += ' (체크!)';
                }
            }
            
            statusElement.textContent = statusText;
        }
    }



    resetGame() {
        console.log('게임 리셋 시작');
        this.initializeBoard();
        
        // 보드 초기화 확인
        console.log('보드 초기화 후 상태:');
        for (let row = 0; row < 8; row++) {
            let rowStr = '';
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                rowStr += piece || '.';
            }
            console.log(`${row}: ${rowStr}`);
        }
        
        // AI 대전 모드면 항상 플레이어가 흰색, AI가 검은색
        if (this.gameMode === 'ai') {
            this.currentPlayer = 'white';
            this.playerColor = 'white';
            console.log('AI 모드 설정: 플레이어=white, AI=black');
        } else {
            this.currentPlayer = 'white';
        }
        this.selectedPiece = null;
        this.moveHistory = [];
        this.clearSelection();
        this.renderBoard();
        this.updateGameStatus();
        this.updateMoveHistory();
        
        // 게임 종료 상태 초기화
        this.gameOver = false;
        this.winner = null;
        console.log('게임 리셋 완료');
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;
        
        const lastMove = this.moveHistory.pop();
        this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
        this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured || '';
        
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.clearSelection();
        this.renderBoard();
        this.updateGameStatus();
        this.updateMoveHistory();
    }

    forceRenderBoard() {
        console.log('=== forceRenderBoard 호출됨 ===');
        console.log('현재 보드 상태:', this.board);
        
        const chessboard = document.getElementById('chessboard');
        if (!chessboard) {
            console.error('체스보드 요소를 찾을 수 없음');
            return;
        }

        console.log('강제 보드 렌더링 시작');
        let html = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                const isLight = (row + col) % 2 === 0;
                const squareClass = `square ${isLight ? 'white' : 'black'}`;
                const pieceClass = piece ? 'piece' : '';
                const selectedClass = this.selectedPiece && 
                    this.selectedPiece.row === row && 
                    this.selectedPiece.col === col ? 'selected' : '';
                
                html += `<div class="${squareClass} ${pieceClass} ${selectedClass}" data-row="${row}" data-col="${col}">${piece}</div>`;
            }
        }
        
        chessboard.innerHTML = html;
        console.log('강제 보드 렌더링 완료');
        console.log('생성된 HTML 길이:', html.length);
        
        // DOM 업데이트 확인 및 검증
        setTimeout(() => {
            const squares = document.querySelectorAll('.square');
            console.log('DOM 업데이트 확인 - 총 사각형 수:', squares.length);
            
            // 렌더링 결과 검증
            let renderSuccess = true;
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    const expectedPiece = this.board[row][col];
                    const actualPiece = square ? square.textContent : '';
                    
                    if (actualPiece !== expectedPiece) {
                        console.error(`렌더링 불일치: [${row},${col}] - 예상: "${expectedPiece}", 실제: "${actualPiece}"`);
                        renderSuccess = false;
                    }
                }
            }
            console.log('렌더링 검증 결과:', renderSuccess ? '성공' : '실패');
            
            if (!renderSuccess) {
                console.log('렌더링 재시도...');
                this.forceRenderBoard();
            }
        }, 100);
    }

    renderBoard() {
        console.log('=== renderBoard 호출됨 ===');
        console.log('현재 보드 상태:', this.board);
        
        const now = Date.now();
        if (now - this.lastRenderTime < this.renderThrottle) {
            console.log('렌더링 스로틀링으로 인해 건너뜀');
            return; // 렌더링 스로틀링
        }
        this.lastRenderTime = now;

        const chessboard = document.getElementById('chessboard');
        if (!chessboard) {
            console.error('체스보드 요소를 찾을 수 없음');
            return;
        }

        console.log('보드 렌더링 시작');
        let html = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                const isLight = (row + col) % 2 === 0;
                const squareClass = `square ${isLight ? 'white' : 'black'}`;
                const pieceClass = piece ? 'piece' : '';
                const selectedClass = this.selectedPiece && 
                    this.selectedPiece.row === row && 
                    this.selectedPiece.col === col ? 'selected' : '';
                
                html += `<div class="${squareClass} ${pieceClass} ${selectedClass}" data-row="${row}" data-col="${col}">${piece}</div>`;
            }
        }
        
        chessboard.innerHTML = html;
        console.log('보드 렌더링 완료');
        console.log('생성된 HTML 길이:', html.length);
    }

    updateMoveHistory() {
        const moveHistoryElement = document.getElementById('move-history');
        if (!moveHistoryElement) return;

        moveHistoryElement.innerHTML = '';
        
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveEntry = document.createElement('div');
            moveEntry.className = 'move-entry';
            
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1];
            
            let moveText = `${moveNumber}. ${this.getSquareNotation(whiteMove.from)}-${this.getSquareNotation(whiteMove.to)}`;
            
            // 특별한 이동 표시
            if (whiteMove.special) {
                moveText += this.getSpecialMoveSymbol(whiteMove.special);
            }
            
            if (blackMove) {
                moveText += ` ${this.getSquareNotation(blackMove.from)}-${this.getSquareNotation(blackMove.to)}`;
                if (blackMove.special) {
                    moveText += this.getSpecialMoveSymbol(blackMove.special);
                }
            }
            
            moveEntry.textContent = moveText;
            moveHistoryElement.appendChild(moveEntry);
        }
    }

    getSpecialMoveSymbol(specialType) {
        switch (specialType) {
            case 'kingside-castling': return ' O-O';
            case 'queenside-castling': return ' O-O-O';
            case 'promotion': return '=Q';
            case 'en-passant': return ' e.p.';
            default: return '';
        }
    }

    getSquareNotation(pos) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        return files[pos.col] + ranks[pos.row];
    }

    // 잡은 말 업데이트
    updateCapturedPieces() {
        const capturedWhite = document.getElementById('captured-white');
        const capturedBlack = document.getElementById('captured-black');
        
        if (!capturedWhite || !capturedBlack) return;
        
        // 잡힌 말 계산
        const capturedPieces = { white: [], black: [] };
        
        this.moveHistory.forEach(move => {
            if (move.captured) {
                const color = this.getPieceColor(move.captured);
                if (color === 'white') {
                    capturedPieces.black.push(move.captured);
                } else {
                    capturedPieces.white.push(move.captured);
                }
            }
        });
        
        // UI 업데이트
        capturedWhite.innerHTML = capturedPieces.white.map(piece => 
            `<span class="captured-piece">${piece}</span>`
        ).join('');
        
        capturedBlack.innerHTML = capturedPieces.black.map(piece => 
            `<span class="captured-piece">${piece}</span>`
        ).join('');
    }

    setGameMode(mode) {
        console.log(`게임 모드 변경: ${mode}`);
        this.gameMode = mode;
        
        // AI 대전 모드일 때 플레이어는 항상 흰색, AI는 검은색
        if (mode === 'ai') {
            this.playerColor = 'white';
            this.currentPlayer = 'white'; // 게임 리셋 시에도 반영
        }
        
        // 패널 표시/숨김
        const onlinePanel = document.getElementById('online-panel');
        const aiPanel = document.getElementById('ai-panel');
        const puzzlePanel = document.getElementById('puzzle-panel');
        const tacticsPanel = document.getElementById('tactics-panel');
        
        console.log('패널 요소들:', {
            onlinePanel: !!onlinePanel,
            aiPanel: !!aiPanel,
            puzzlePanel: !!puzzlePanel,
            tacticsPanel: !!tacticsPanel
        });
        
        if (onlinePanel) onlinePanel.style.display = mode === 'online' ? 'block' : 'none';
        if (aiPanel) aiPanel.style.display = mode === 'ai' ? 'block' : 'none';
        if (puzzlePanel) puzzlePanel.style.display = 'none'; // 퍼즐 패널은 항상 숨김
        if (tacticsPanel) tacticsPanel.style.display = mode === 'tactics' ? 'block' : 'none';
        
        // 버튼 활성화/비활성화
        document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`${mode}-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            console.log(`활성화된 버튼: ${mode}-btn`);
        } else {
            console.log(`버튼을 찾을 수 없음: ${mode}-btn`);
        }
        
        // 온라인 모드가 아닐 때만 게임 리셋
        if (mode !== 'puzzle' && mode !== 'online-player') {
            this.resetGame();
            // 퍼즐 정보 숨기기
            const puzzleInfoMain = document.getElementById('puzzle-info-main');
            if (puzzleInfoMain) {
                puzzleInfoMain.style.display = 'none';
            }
        }
        
        // 온라인 모드일 때 폴링 중지
        if (mode !== 'online-player' && this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        console.log(`게임 모드 변경 완료: ${mode}`);
    }

    setAIDifficulty(difficulty) {
        this.aiDifficulty = difficulty;
        console.log(`AI 난이도 설정: ${difficulty}`);
        
        // Stockfish 난이도 설정
        if (difficulty === 'stockfish' && this.stockfish && this.stockfishReady) {
            this.setStockfishDifficulty();
        }
        
        // 버튼 활성화 상태 업데이트
        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-difficulty="${difficulty}"]`)?.classList.add('active');
    }

    // Stockfish 난이도 설정 - 최고 강도
    setStockfishDifficulty() {
        if (!this.stockfish || !this.stockfishReady) {
            console.log('Stockfish가 준비되지 않았습니다.');
            return;
        }
        
        console.log('Stockfish 최고 난이도 설정 중...');
        
        // Stockfish 최고 강도 설정
        this.stockfish.postMessage('setoption name Skill Level value 20'); // 최고 난이도
        this.stockfish.postMessage('setoption name MultiPV value 1');
        this.stockfish.postMessage('setoption name Threads value 8'); // 최대 스레드 사용
        this.stockfish.postMessage('setoption name Hash value 2048'); // 더 큰 해시 테이블
        this.stockfish.postMessage('setoption name Contempt value 0'); // 중립적 평가
        this.stockfish.postMessage('setoption name Move Overhead value 0'); // 최소 오버헤드
        this.stockfish.postMessage('setoption name Minimum Thinking Time value 0'); // 최소 사고 시간
        this.stockfish.postMessage('setoption name Slow Mover value 100'); // 빠른 이동
        this.stockfish.postMessage('setoption name UCI_Chess960 value false'); // 표준 체스
        this.stockfish.postMessage('setoption name UCI_AnalyseMode value false'); // 분석 모드 비활성화
        
        console.log('Stockfish 최고 난이도 설정 완료 - 사람이 절대 이길 수 없는 수준!');
    }

    makeAIMove() {
        if (this.gameOver || this.currentPlayer !== 'black') return;
        
        this.showAIThinking(true);
        
        // 비동기 처리로 UI 블로킹 방지
        setTimeout(() => {
            let move = null;
            
            switch (this.aiDifficulty) {
                case 'easy':
                    const easyMoves = this.getAllValidMoves('black');
                    move = this.findEasyMove(easyMoves);
                    break;
                case 'medium':
                    const mediumMoves = this.getAllValidMoves('black');
                    move = this.findMediumMove(mediumMoves);
                    break;
                case 'hard':
                    const hardMoves = this.getAllValidMoves('black');
                    move = this.findHardMove(hardMoves);
                    break;
                case 'expert':
                    const expertMoves = this.getAllValidMoves('black');
                    move = this.findExpertMove(expertMoves);
                    break;
                case 'stockfish':
                    // Stockfish API 사용 (로컬 파일 접근 제한으로 인해)
                    console.log('Stockfish API를 사용하여 최고 강도의 이동을 계산합니다.');
                    
                    // API가 실패할 경우를 대비해 로컬 최고 강도 AI도 준비
                    try {
                        this.makeStockfishAPIMove();
                    } catch (error) {
                        console.log('Stockfish API 실패, 로컬 최고 강도 AI 사용');
                        const stockfishMoves = this.getAllValidMoves('black');
                        const stockfishMove = this.findStockfishLevelMove(stockfishMoves);
                        if (stockfishMove) {
                            setTimeout(() => {
                                this.makeMove(stockfishMove.from.row, stockfishMove.from.col, stockfishMove.to.row, stockfishMove.to.col);
                                this.showAIThinking(false);
                            }, 100);
                        } else {
                            this.showAIThinking(false);
                        }
                    }
                    return; // Stockfish는 비동기로 처리되므로 여기서 종료
                default:
                    const defaultMoves = this.getAllValidMoves('black');
                    move = this.findMediumMove(defaultMoves);
            }
            
            if (move) {
                setTimeout(() => {
                    this.makeMove(move.from.row, move.from.col, move.to.row, move.to.col);
                    this.showAIThinking(false);
                }, 50);
            } else {
                this.showAIThinking(false);
            }
        }, 10);
    }

    // 최적화된 극한 AI (성능 유지하면서 렉 감소)
    findExpertMove(validMoves) {
        console.log('극도로 강화된 AI 분석 시작 - 사람이 절대 이길 수 없는 수준...');
        
        // 딥러닝 모델이 학습된 데이터가 있는지 확인
        if (this.deepLearningModel && this.deepLearningModel.isTrained) {
            const dlMove = this.getDeepLearningMove(validMoves);
            if (dlMove) {
                console.log('딥러닝 모델이 선택한 이동:', dlMove);
                return dlMove;
            }
        }

        // 극도로 강화된 Alpha-Beta 가지치기 (깊이 4로 조정하여 성능 향상)
        let bestMove = validMoves[0];
        let bestScore = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        // 이동을 평가 함수로 정렬하여 가지치기 효율성 향상
        const sortedMoves = this.sortMovesByEvaluation(validMoves);

        // 배치 처리로 성능 향상
        const batchSize = 5;
        for (let i = 0; i < sortedMoves.length; i += batchSize) {
            const batch = sortedMoves.slice(i, i + batchSize);
            
            for (const move of batch) {
                const score = this.alphaBeta(move, 4, false, alpha, beta); // 깊이 4로 조정
                console.log(`이동 ${this.getSquareNotation(move.from)} → ${this.getSquareNotation(move.to)}: 점수 ${score}`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, score);
            }
            
            // UI 응답성을 위한 짧은 휴식
            if (i + batchSize < sortedMoves.length) {
                // 비동기 처리를 위한 짧은 지연
                break;
            }
        }

        // 고급 전술 기회가 있는지 확인 (더 적극적으로)
        const tacticalMove = this.findTacticalMove(validMoves);
        if (tacticalMove) {
            console.log('전술적 이동 선택:', tacticalMove);
            return tacticalMove;
        }

        console.log('최종 선택된 이동:', bestMove, '점수:', bestScore);
        return bestMove;
    }

    // 최적화된 Alpha-Beta 가지치기 알고리즘
    alphaBeta(move, depth, isMaximizing, alpha, beta) {
        if (depth === 0) {
            return this.evaluatePosition(move);
        }

        // 메모리 최적화된 임시 보드 생성
        const tempBoard = this.createTempBoard(move);
        
        const currentColor = isMaximizing ? 'black' : 'white';
        const validMoves = this.getAllValidMovesForBoard(tempBoard, currentColor);

        if (isMaximizing) {
            let maxScore = -Infinity;
            
            for (const nextMove of validMoves) {
                const score = this.alphaBeta(nextMove, depth - 1, false, alpha, beta);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                
                // Beta 가지치기
                if (beta <= alpha) {
                    break;
                }
            }
            
            return maxScore;
        } else {
            let minScore = Infinity;
            
            for (const nextMove of validMoves) {
                const score = this.alphaBeta(nextMove, depth - 1, true, alpha, beta);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                
                // Alpha 가지치기
                if (beta <= alpha) {
                    break;
                }
            }
            
            return minScore;
        }
    }

    // 메모리 최적화된 임시 보드 생성
    createTempBoard(move) {
        const tempBoard = [];
        for (let i = 0; i < 8; i++) {
            tempBoard[i] = this.board[i].slice();
        }
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        return tempBoard;
    }

    // 특정 보드에 대한 유효한 이동 계산
    getAllValidMovesForBoard(board, color) {
        const validMoves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && this.isPieceOfColor(piece, color)) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMoveForBoard(board, row, col, toRow, toCol)) {
                                validMoves.push({
                                    from: { row, col },
                                    to: { row: toRow, col: toCol },
                                    piece: piece
                                });
                            }
                        }
                    }
                }
            }
        }

        return validMoves;
    }

    // 특정 보드에 대한 이동 유효성 검사
    isValidMoveForBoard(board, fromRow, fromCol, toRow, toCol) {
        const piece = board[fromRow][fromCol];
        if (!piece) return false;

        const color = this.getPieceColor(piece);
        const targetPiece = board[toRow][toCol];
        
        // 같은 색의 말을 공격할 수 없음
        if (targetPiece && this.getPieceColor(targetPiece) === color) {
                return false;
            }
        
        // 기물별 이동 규칙 검사
        switch (piece) {
            case '♙': case '♟': // 폰
                return this.isValidPawnMoveForBoard(board, fromRow, fromCol, toRow, toCol, color);
            case '♖': case '♜': // 룩
                return this.isValidRookMove(fromRow, fromCol, toRow, toCol) && 
                       this.isPathClearForBoard(board, fromRow, fromCol, toRow, toCol);
            case '♗': case '♝': // 비숍
                return this.isValidBishopMove(fromRow, fromCol, toRow, toCol) && 
                       this.isPathClearForBoard(board, fromRow, fromCol, toRow, toCol);
            case '♕': case '♛': // 퀸
                return this.isValidQueenMove(fromRow, fromCol, toRow, toCol) && 
                       this.isPathClearForBoard(board, fromRow, fromCol, toRow, toCol);
            case '♔': case '♚': // 킹
                return this.isValidKingMove(fromRow, fromCol, toRow, toCol);
            case '♘': case '♞': // 나이트
                return this.isValidKnightMove(fromRow, fromCol, toRow, toCol);
        }
        
        return false;
    }

    // 특정 보드에 대한 폰 이동 검사
    isValidPawnMoveForBoard(board, fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        // 전진
        if (fromCol === toCol && toRow === fromRow + direction) {
            return !board[toRow][toCol];
        }
        
        // 첫 이동시 2칸 전진
        if (fromCol === toCol && fromRow === startRow && toRow === fromRow + 2 * direction) {
            return !board[fromRow + direction][fromCol] && !board[toRow][toCol];
        }
        
        // 대각선 공격
        if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
            return board[toRow][toCol] !== '';
        }
        
        return false;
    }

    // 특정 보드에 대한 경로 검사
    isPathClearForBoard(board, fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (board[currentRow][currentCol] !== '') {
                return false;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    // Stockfish AI 이동
    makeStockfishMove() {
        if (!this.stockfish || !this.stockfishReady) {
            console.log('Stockfish가 준비되지 않았습니다.');
            return;
        }

        // 현재 보드 상태를 FEN 형식으로 변환
        const fen = this.boardToFEN();
        console.log('Stockfish에게 보드 상태 전송:', fen);

        // Stockfish에게 현재 위치 분석 요청 - 더 오래 생각하게 함
        this.stockfish.postMessage(`position fen ${fen}`);
        this.stockfish.postMessage('go depth 20 movetime 3000'); // 3초 동안 깊이 20까지 분석
    }

    // Stockfish API를 사용한 이동
    async makeStockfishAPIMove() {
        try {
            console.log('Stockfish API를 사용하여 최고 강도의 이동을 계산합니다...');
            
            // 현재 보드 상태를 FEN 형식으로 변환
            const fen = this.boardToFEN();
            console.log('전송할 FEN:', fen);
            
            // Stockfish API 호출 - 다른 엔드포인트 사용
            const response = await fetch('https://stockfish.online/api/s/v2.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'fen': fen,
                    'level': '20',
                    'movetime': '1000',
                    'action': 'move'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Stockfish API 응답:', data);
            
            if (data.success && data.move) {
                console.log('Stockfish API 응답:', data);
                
                // UCI 형식의 이동을 체스 좌표로 변환
                const move = this.uciToChessMove(data.move);
                
                if (move) {
                    console.log('Stockfish가 선택한 이동:', move);
                    
                    // 이동 실행
                    setTimeout(() => {
                        this.makeMove(move.from.row, move.from.col, move.to.row, move.to.col);
                        this.showAIThinking(false);
                    }, 100);
                } else {
                    console.error('Stockfish 이동을 파싱할 수 없습니다:', data.move);
                    this.showAIThinking(false);
                }
            } else {
                console.error('Stockfish API 오류:', data);
                // API 실패 시 기본 AI로 폴백
                const fallbackMoves = this.getAllValidMoves('black');
                const fallbackMove = this.findExpertMove(fallbackMoves);
                if (fallbackMove) {
                    setTimeout(() => {
                        this.makeMove(fallbackMove.from.row, fallbackMove.from.col, fallbackMove.to.row, fallbackMove.to.col);
                        this.showAIThinking(false);
                    }, 50);
                } else {
                    this.showAIThinking(false);
                }
            }
        } catch (error) {
            console.error('Stockfish API 호출 중 오류:', error);
            // 오류 발생 시 기본 AI로 폴백
            const fallbackMoves = this.getAllValidMoves('black');
            const fallbackMove = this.findExpertMove(fallbackMoves);
            if (fallbackMove) {
                setTimeout(() => {
                    this.makeMove(fallbackMove.from.row, fallbackMove.from.col, fallbackMove.to.row, fallbackMove.to.col);
                    this.showAIThinking(false);
                }, 50);
            } else {
                this.showAIThinking(false);
            }
        }
    }

    // 보드를 FEN 형식으로 변환
    boardToFEN() {
        let fen = '';
        let emptyCount = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece === '') {
                    emptyCount++;
        } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    // 흰색 말은 대문자, 검은색 말은 소문자
                    const pieceMap = {
                        '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N', '♙': 'P',
                        '♚': 'k', '♛': 'q', '♜': 'r', '♝': 'b', '♞': 'n', '♟': 'p'
                    };
                    fen += pieceMap[piece] || piece;
                }
            }
            
            if (emptyCount > 0) {
                fen += emptyCount;
                emptyCount = 0;
            }
            
            if (row < 7) fen += '/';
        }

        // 턴 정보 추가
        fen += this.currentPlayer === 'white' ? ' w' : ' b';
        fen += ' KQkq - 0 1'; // 캐슬링 권한, 엔패선트, 반수, 전체 이동 수

        return fen;
    }

    showAIThinking(thinking) {
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            statusElement.textContent = thinking ? 'AI 생각 중...' : '흰색 턴';
        }
    }

    findBestMove() {
        const validMoves = this.getAllValidMoves('black');
        if (validMoves.length === 0) return null;
        
        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of validMoves) {
            const score = this.evaluateMove(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    findEasyMove(validMoves) {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
        
    findMediumMove(validMoves) {
        // 간단한 평가 함수 사용
        let bestMove = validMoves[0];
        let bestScore = -Infinity;

        for (const move of validMoves) {
            const score = this.evaluateMove(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    findHardMove(validMoves) {
        // 미니맥스 알고리즘 (깊이 2)
        let bestMove = validMoves[0];
        let bestScore = -Infinity;

        for (const move of validMoves) {
            const score = this.minimax(move, 2, false);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    findExpertMove(validMoves) {
        console.log('극도로 강화된 AI 분석 시작 - 사람이 절대 이길 수 없는 수준...');
        
        // 딥러닝 모델이 학습된 데이터가 있는지 확인
        if (this.deepLearningModel && this.deepLearningModel.isTrained) {
            const dlMove = this.getDeepLearningMove(validMoves);
            if (dlMove) {
                console.log('딥러닝 모델이 선택한 이동:', dlMove);
                return dlMove;
            }
        }

        // 극도로 강화된 Alpha-Beta 가지치기 (깊이 4로 조정하여 성능 향상)
        let bestMove = validMoves[0];
        let bestScore = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        // 이동을 평가 함수로 정렬하여 가지치기 효율성 향상
        const sortedMoves = this.sortMovesByEvaluation(validMoves);

        // 배치 처리로 성능 향상
        const batchSize = 5;
        for (let i = 0; i < sortedMoves.length; i += batchSize) {
            const batch = sortedMoves.slice(i, i + batchSize);
            
            for (const move of batch) {
                const score = this.alphaBeta(move, 4, false, alpha, beta); // 깊이 4로 조정
                console.log(`이동 ${this.getSquareNotation(move.from)} → ${this.getSquareNotation(move.to)}: 점수 ${score}`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, score);
            }
            
            // UI 응답성을 위한 짧은 휴식
            if (i + batchSize < sortedMoves.length) {
                // 비동기 처리를 위한 짧은 지연
                break;
            }
        }

        // 고급 전술 기회가 있는지 확인 (더 적극적으로)
        const tacticalMove = this.findTacticalMove(validMoves);
        if (tacticalMove) {
            console.log('전술적 이동 선택:', tacticalMove);
            return tacticalMove;
        }

        console.log('최종 선택된 이동:', bestMove, '점수:', bestScore);
        return bestMove;
    }

    // Stockfish 수준의 최고 강도 AI
    findStockfishLevelMove(validMoves) {
        console.log('Stockfish 수준의 최고 강도 AI 분석 시작...');
        
        // 더 깊은 분석 (깊이 6)
        let bestMove = validMoves[0];
        let bestScore = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        // 이동을 평가 함수로 정렬
        const sortedMoves = this.sortMovesByEvaluation(validMoves);

        for (const move of sortedMoves) {
            const score = this.alphaBeta(move, 6, false, alpha, beta); // 깊이 6으로 증가
            console.log(`Stockfish 수준 분석: ${this.getSquareNotation(move.from)} → ${this.getSquareNotation(move.to)}: 점수 ${score}`);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, score);
        }

        // 고급 전술 우선 확인
        const tacticalMove = this.findTacticalMove(validMoves);
        if (tacticalMove) {
            console.log('Stockfish 수준 전술적 이동 선택:', tacticalMove);
            return tacticalMove;
        }

        console.log('Stockfish 수준 최종 선택:', bestMove, '점수:', bestScore);
        return bestMove;
    }

    // 고급 전술 찾기
    findTacticalMove(validMoves) {
        // 포크 찾기
        const forkMove = this.findFork(validMoves);
        if (forkMove) return forkMove;

        // 핀 찾기
        const pinMove = this.findPin(validMoves);
        if (pinMove) return pinMove;

        // 스큐어 찾기
        const skewerMove = this.findSkewer(validMoves);
        if (skewerMove) return skewerMove;

        // 디스커버드 어택 찾기
        const discoveredAttackMove = this.findDiscoveredAttack(validMoves);
        if (discoveredAttackMove) return discoveredAttackMove;

        // 데스페라도 찾기
        const desperadoMove = this.findDesperado(validMoves);
        if (desperadoMove) return desperadoMove;

        // 기물 과부하 찾기
        const overloadMove = this.findOverloading(validMoves);
        if (overloadMove) return overloadMove;

        // X선 공격 찾기
        const xrayMove = this.findXrayAttack(validMoves);
        if (xrayMove) return xrayMove;

        // 간섭/방해 찾기
        const interferenceMove = this.findInterference(validMoves);
        if (interferenceMove) return interferenceMove;

        return null;
    }

    // 포크 찾기 (한 말로 두 개 이상의 말을 공격)
    findFork(validMoves) {
        for (const move of validMoves) {
            const attackingPiece = this.board[move.from.row][move.from.col];
            const targetSquare = { row: move.to.row, col: move.to.col };
            
            // 이동 후 공격할 수 있는 말들 찾기
            const attackedPieces = this.getAttackedPiecesAfterMove(move);
            
            if (attackedPieces.length >= 2) {
                // 고가치 말들을 우선적으로 공격하는지 확인
                const highValueTargets = attackedPieces.filter(piece => 
                    this.getPieceValue(piece) >= 3
                );
                
                if (highValueTargets.length >= 2) {
                    console.log('포크 발견:', move, '공격 대상:', attackedPieces);
                    return move;
                }
            }
        }
        return null;
    }

    // 핀 찾기 (말을 움직이면 킹이 공격받는 상황)
    findPin(validMoves) {
        for (const move of validMoves) {
            const piece = this.board[move.from.row][move.from.col];
            const color = this.getPieceColor(piece);
            
            // 이동 후 상대방 말이 핀되는지 확인
            if (this.wouldCreatePin(move, color)) {
                console.log('핀 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 스큐어 찾기 (고가치 말 뒤의 저가치 말을 공격)
    findSkewer(validMoves) {
        for (const move of validMoves) {
            const piece = this.board[move.from.row][move.from.col];
            if (piece === '♖' || piece === '♜' || piece === '♕' || piece === '♛' || 
                piece === '♗' || piece === '♝') {
                
                // 이동 후 스큐어가 가능한지 확인
                if (this.wouldCreateSkewer(move)) {
                    console.log('스큐어 발견:', move);
                    return move;
                }
            }
        }
        return null;
    }

    // 디스커버드 어택 찾기 (말을 움직여서 다른 말이 공격할 수 있게 함)
    findDiscoveredAttack(validMoves) {
        for (const move of validMoves) {
            // 이동 후 숨겨진 공격이 드러나는지 확인
            if (this.wouldCreateDiscoveredAttack(move)) {
                console.log('디스커버드 어택 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 데스페라도 찾기 (잡힐 것이 확실한 말로 최대한 이득을 취함)
    findDesperado(validMoves) {
        for (const move of validMoves) {
            const piece = this.board[move.from.row][move.from.col];
            const pieceValue = this.getPieceValue(piece);
            
            // 말이 잡힐 위험이 있는지 확인
            if (this.isPieceUnderThreat(move.from.row, move.from.col)) {
                // 잡기 기회가 있는지 확인
                if (move.captured && this.getPieceValue(move.captured) >= pieceValue) {
                    console.log('데스페라도 발견:', move);
                    return move;
                }
            }
        }
        return null;
    }

    // 기물 과부하 찾기 (한 말이 여러 역할을 수행해야 하는 상황)
    findOverloading(validMoves) {
        for (const move of validMoves) {
            // 상대방 말이 여러 역할을 수행해야 하는 상황을 만들 수 있는지 확인
            if (this.wouldCreateOverload(move)) {
                console.log('기물 과부하 발견:', move);
                return move;
            }
        }
        return null;
    }

    // X선 공격 찾기 (장애물을 통과해서 공격)
    findXrayAttack(validMoves) {
        for (const move of validMoves) {
            const piece = this.board[move.from.row][move.from.col];
            if (piece === '♕' || piece === '♛' || piece === '♖' || piece === '♜' || 
                piece === '♗' || piece === '♝') {
                
                // X선 공격이 가능한지 확인
                if (this.wouldCreateXrayAttack(move)) {
                    console.log('X선 공격 발견:', move);
                    return move;
                }
            }
        }
        return null;
    }

    // 간섭/방해 찾기 (상대방 말의 통신을 차단)
    findInterference(validMoves) {
        for (const move of validMoves) {
            // 상대방 말들 간의 통신이 차단되는지 확인
            if (this.wouldCreateInterference(move)) {
                console.log('간섭/방해 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 추크츠방 찾기 (상대방이 어떤 말을 움직여도 불리해지는 상황)
    findZugzwang(validMoves) {
        for (const move of validMoves) {
            // 이동 후 상대방의 모든 이동이 불리해지는지 확인
            if (this.wouldCreateZugzwang(move)) {
                console.log('추크츠방 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 사잇수 찾기 (예상되는 이동 사이에 예상치 못한 이동)
    findIntermezzo(validMoves) {
        for (const move of validMoves) {
            // 상대방이 예상하는 이동과 다른 이동을 하는 경우
            if (this.isIntermezzoMove(move)) {
                console.log('사잇수 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 오포지션 찾기 (킹과 킹 사이의 대립 상황)
    findOpposition(validMoves) {
        for (const move of validMoves) {
            const piece = this.board[move.from.row][move.from.col];
            if (piece === '♔' || piece === '♚') {
                // 킹 이동 후 상대방 킹과의 오포지션 형성
                if (this.wouldCreateOpposition(move)) {
                    console.log('오포지션 발견:', move);
                    return move;
                }
            }
        }
        return null;
    }

    // 정리 희생 찾기 (말을 희생하여 다른 말의 활동 공간 확보)
    findClearanceSacrifice(validMoves) {
        for (const move of validMoves) {
            // 말을 희생하여 다른 말의 활동 공간을 확보하는 경우
            if (this.isClearanceSacrificeMove(move)) {
                console.log('정리 희생 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 트래핑 찾기 (상대방 말을 함정에 빠뜨림)
    findTrapping(validMoves) {
        for (const move of validMoves) {
            // 상대방 말을 함정에 빠뜨리는 경우
            if (this.isTrappingMove(move)) {
                console.log('트래핑 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 속임수 찾기 (상대방을 속이는 전술적 기회)
    findSwindle(validMoves) {
        for (const move of validMoves) {
            // 상대방을 속이는 전술적 기회
            if (this.isSwindleMove(move)) {
                console.log('속임수 발견:', move);
                return move;
            }
        }
        return null;
    }

    // 이동 후 공격할 수 있는 말들 찾기
    getAttackedPiecesAfterMove(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        const attackedPieces = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = tempBoard[row][col];
                if (piece && this.getPieceColor(piece) === 'white') {
                    // 이 위치가 공격받는지 확인
                    if (this.isSquareUnderAttack(row, col, 'black', tempBoard)) {
                        attackedPieces.push(piece);
                    }
                }
            }
        }
        
        return attackedPieces;
    }

    // 핀을 만들 수 있는지 확인
    wouldCreatePin(move, attackingColor) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        // 상대방 킹을 찾기
        const opponentColor = attackingColor === 'white' ? 'black' : 'white';
        const kingPiece = opponentColor === 'white' ? '♔' : '♚';
        
        let kingRow, kingCol;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (tempBoard[row][col] === kingPiece) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
        }
        
        // 킹과 이동한 말 사이에 다른 말이 있는지 확인
        if (kingRow === move.to.row || kingCol === move.to.col) {
            const piecesBetween = this.getPiecesBetween(move.to, { row: kingRow, col: kingCol }, tempBoard);
            return piecesBetween.length === 1;
        }
        
        return false;
    }

    // 스큐어를 만들 수 있는지 확인
    wouldCreateSkewer(move) {
        const piece = this.board[move.from.row][move.from.col];
        const color = this.getPieceColor(piece);
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        // 이동 후 같은 선상에 있는 상대방 말들 확인
        const alignedPieces = this.getAlignedPieces(move.to, opponentColor);
        
        if (alignedPieces.length >= 2) {
            // 고가치 말 뒤에 저가치 말이 있는지 확인
            alignedPieces.sort((a, b) => this.getPieceValue(b.piece) - this.getPieceValue(a.piece));
            
            if (this.getPieceValue(alignedPieces[0].piece) > this.getPieceValue(alignedPieces[1].piece)) {
                return true;
            }
        }
        
        return false;
    }

    // 디스커버드 어택을 만들 수 있는지 확인
    wouldCreateDiscoveredAttack(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        // 이동 후 숨겨진 공격이 드러나는지 확인
        const color = this.getPieceColor(move.piece);
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = tempBoard[row][col];
                if (piece && this.getPieceColor(piece) === color) {
                    // 이 말이 상대방 말을 공격할 수 있는지 확인
                    for (let targetRow = 0; targetRow < 8; targetRow++) {
                        for (let targetCol = 0; targetCol < 8; targetCol++) {
                            const targetPiece = tempBoard[targetRow][targetCol];
                            if (targetPiece && this.getPieceColor(targetPiece) === opponentColor) {
                                if (this.isValidMove(row, col, targetRow, targetCol, tempBoard)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // 말이 위협받는지 확인
    isPieceUnderThreat(row, col) {
        const piece = this.board[row][col];
        if (!piece) return false;
        
        const color = this.getPieceColor(piece);
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        return this.isSquareUnderAttack(row, col, opponentColor);
    }

    // 과부하를 만들 수 있는지 확인
    wouldCreateOverload(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        // 상대방 말이 여러 역할을 수행해야 하는 상황을 만들 수 있는지 확인
        const opponentColor = this.getPieceColor(move.piece) === 'white' ? 'black' : 'white';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = tempBoard[row][col];
                if (piece && this.getPieceColor(piece) === opponentColor) {
                    // 이 말이 여러 중요한 역할을 수행해야 하는지 확인
                    const roles = this.getPieceRoles(row, col, tempBoard);
                    if (roles.length >= 2) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    // X선 공격을 만들 수 있는지 확인
    wouldCreateXrayAttack(move) {
        const piece = this.board[move.from.row][move.from.col];
        const color = this.getPieceColor(piece);
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        // 이동 후 장애물을 통과해서 공격할 수 있는지 확인
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const targetPiece = tempBoard[row][col];
                if (targetPiece && this.getPieceColor(targetPiece) === opponentColor) {
                    // 장애물을 통과해서 공격할 수 있는지 확인
                    if (this.canAttackThroughObstacles(move.to, { row, col }, tempBoard)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    // 간섭/방해를 만들 수 있는지 확인
    wouldCreateInterference(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        // 상대방 말들 간의 통신이 차단되는지 확인
        const opponentColor = this.getPieceColor(move.piece) === 'white' ? 'black' : 'white';
        
        for (let row1 = 0; row1 < 8; row1++) {
            for (let col1 = 0; col1 < 8; col1++) {
                const piece1 = tempBoard[row1][col1];
                if (piece1 && this.getPieceColor(piece1) === opponentColor) {
                    for (let row2 = 0; row2 < 8; row2++) {
                        for (let col2 = 0; col2 < 8; col2++) {
                            const piece2 = tempBoard[row2][col2];
                            if (piece2 && this.getPieceColor(piece2) === opponentColor && 
                                (row1 !== row2 || col1 !== col2)) {
                                // 두 말 간의 통신이 차단되는지 확인
                                if (this.isCommunicationBlocked({ row: row1, col: col1 }, 
                                                              { row: row2, col: col2 }, tempBoard)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // 두 위치 사이의 말들 찾기
    getPiecesBetween(pos1, pos2, board = this.board) {
        const pieces = [];
        
        if (pos1.row === pos2.row) {
            // 가로선
            const start = Math.min(pos1.col, pos2.col);
            const end = Math.max(pos1.col, pos2.col);
            for (let col = start + 1; col < end; col++) {
                if (board[pos1.row][col] !== '') {
                    pieces.push({ row: pos1.row, col, piece: board[pos1.row][col] });
                }
            }
        } else if (pos1.col === pos2.col) {
            // 세로선
            const start = Math.min(pos1.row, pos2.row);
            const end = Math.max(pos1.row, pos2.row);
            for (let row = start + 1; row < end; row++) {
                if (board[row][pos1.col] !== '') {
                    pieces.push({ row, col: pos1.col, piece: board[row][pos1.col] });
                }
            }
        } else if (Math.abs(pos1.row - pos2.row) === Math.abs(pos1.col - pos2.col)) {
            // 대각선
            const rowStep = pos1.row < pos2.row ? 1 : -1;
            const colStep = pos1.col < pos2.col ? 1 : -1;
            let row = pos1.row + rowStep;
            let col = pos1.col + colStep;
            
            while (row !== pos2.row && col !== pos2.col) {
                if (board[row][col] !== '') {
                    pieces.push({ row, col, piece: board[row][col] });
                }
                row += rowStep;
                col += colStep;
            }
        }
        
        return pieces;
    }

    // 정렬된 말들 찾기
    getAlignedPieces(pos, color) {
        const pieces = [];
        
        // 가로, 세로, 대각선 방향으로 정렬된 말들 찾기
        const directions = [
            { row: 0, col: 1 },   // 가로
            { row: 1, col: 0 },   // 세로
            { row: 1, col: 1 },   // 대각선
            { row: 1, col: -1 }   // 반대각선
        ];
        
        for (const dir of directions) {
            const aligned = [];
            
            // 양방향으로 확인
            for (let i = 1; i < 8; i++) {
                const row = pos.row + dir.row * i;
                const col = pos.col + dir.col * i;
                
                if (row < 0 || row >= 8 || col < 0 || col >= 8) break;
                
                const piece = this.board[row][col];
                if (piece) {
                    if (this.getPieceColor(piece) === color) {
                        aligned.push({ row, col, piece });
        } else {
                        break;
                    }
                }
            }
            
            if (aligned.length >= 2) {
                pieces.push(...aligned);
            }
        }
        
        return pieces;
    }

    // 말의 역할들 찾기
    getPieceRoles(row, col, board = this.board) {
        const roles = [];
        const piece = board[row][col];
        const color = this.getPieceColor(piece);
        
        // 방어 역할
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const targetPiece = board[r][c];
                if (targetPiece && this.getPieceColor(targetPiece) === color) {
                    if (this.isValidMove(row, col, r, c, board)) {
                        roles.push('defense');
                        break;
                    }
                }
            }
        }
        
        // 공격 역할
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const targetPiece = board[r][c];
                if (targetPiece && this.getPieceColor(targetPiece) !== color) {
                    if (this.isValidMove(row, col, r, c, board)) {
                        roles.push('attack');
                        break;
                    }
                }
            }
        }
        
        return roles;
    }

    // 장애물을 통과해서 공격할 수 있는지 확인
    canAttackThroughObstacles(from, to, board = this.board) {
        const piece = board[from.row][from.col];
        if (!piece) return false;
        
        // 룩, 비숍, 퀸만 장애물을 통과할 수 있음
        if (piece !== '♖' && piece !== '♜' && piece !== '♗' && piece !== '♝' && 
            piece !== '♕' && piece !== '♛') {
            return false;
        }
        
        // 경로에 장애물이 있는지 확인
        const piecesBetween = this.getPiecesBetween(from, to, board);
        return piecesBetween.length > 0;
    }

    // 통신이 차단되는지 확인
    isCommunicationBlocked(pos1, pos2, board = this.board) {
        const piece1 = board[pos1.row][pos1.col];
        const piece2 = board[pos2.row][pos2.col];
        
        if (!piece1 || !piece2) return false;
        
        // 두 말이 같은 색인지 확인
        if (this.getPieceColor(piece1) !== this.getPieceColor(piece2)) return false;
        
        // 두 말 사이에 장애물이 있는지 확인
        const piecesBetween = this.getPiecesBetween(pos1, pos2, board);
        return piecesBetween.length > 0;
    }



    getAllValidMoves(color) {
        const cacheKey = this.getCacheKey(this.board, color);
        
        if (this.validMovesCache.has(cacheKey)) {
            return this.validMovesCache.get(cacheKey);
        }

        const validMoves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.isPieceOfColor(piece, color)) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            // 같은 위치로의 이동은 제외
                            if (row === toRow && col === toCol) continue;
                            
                            // 목적지에 같은 색의 말이 있는지 확인
                            const targetPiece = this.board[toRow] ? this.board[toRow][toCol] : null;
                            if (targetPiece && this.isPieceOfColor(targetPiece, color)) {
                                continue; // 같은 색의 말은 잡을 수 없음
                            }
                            
                            if (this.isValidMove(row, col, toRow, toCol)) {
                                validMoves.push({
                                    from: { row, col },
                                    to: { row: toRow, col: toCol },
                                    piece: piece
                                });
                            }
                        }
                    }
                }
            }
        }

        this.validMovesCache.set(cacheKey, validMoves);
        return validMoves;
    }

    getPieceValue(piece) {
        const values = {
            '♙': 1, '♟': 1,   // 폰
            '♘': 3, '♞': 3,   // 나이트
            '♗': 3, '♝': 3,   // 비숍
            '♖': 5, '♜': 5,   // 룩
            '♕': 9, '♛': 9,   // 퀸
            '♔': 0, '♚': 0    // 킹
        };
        return values[piece] || 0;
    }

    findBestCapture(captureMoves) {
        let bestCapture = null;
        let bestValue = -Infinity;
        
        for (const move of captureMoves) {
            const capturedPiece = this.board[move.to.row][move.to.col];
            const value = this.getPieceValue(capturedPiece);
            
            if (value > bestValue) {
                bestValue = value;
                bestCapture = move;
            }
        }
        
        return bestCapture;
    }

    wouldBeCheck(move) {
        // 메모리 최적화된 임시 보드 생성
        const tempBoard = this.createTempBoard(move);
        
        // 킹이 공격받는지 확인
        return this.isKingInCheck(this.currentPlayer, tempBoard);
    }

    wouldBeCheckmate(move) {
        // 메모리 최적화된 임시 보드 생성
        const tempBoard = this.createTempBoard(move);
        
        // 체크메이트인지 확인
        return this.isCheckmate(tempBoard);
    }

    isKingInCheck(color, board = this.board) {
        console.log(`isKingInCheck 호출됨 - 색상: ${color}`);
        
        // 안전성 검사 추가
        if (!board) {
            console.log('보드가 없음');
            return false;
        }
        
        // 킹의 위치 찾기
        let kingRow, kingCol;
        const kingPiece = color === 'white' ? '♔' : '♚';
        
        console.log(`찾는 킹: ${kingPiece}`);
        
        // 현재 보드 상태 출력
        console.log('현재 보드 상태:');
        for (let row = 0; row < 8; row++) {
            let rowStr = '';
            for (let col = 0; col < 8; col++) {
                const piece = board[row] ? board[row][col] : '';
                rowStr += piece || '.';
            }
            console.log(`${row}: ${rowStr}`);
        }
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (board[row] && board[row][col] === kingPiece) {
                    kingRow = row;
                    kingCol = col;
                    console.log(`킹 발견: ${row}, ${col}`);
                    break;
                }
            }
            if (kingRow !== undefined) break;
        }
        
        // 킹을 찾지 못한 경우
        if (kingRow === undefined || kingCol === undefined) {
            console.log(`${color} 킹을 찾을 수 없음`);
            return false;
        }
        
        // 상대방 말들이 킹을 공격할 수 있는지 확인
        const opponentColor = color === 'white' ? 'black' : 'white';
        console.log(`상대방 색상: ${opponentColor}`);
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row] ? board[row][col] : '';
                if (piece && this.isPieceOfColor(piece, opponentColor)) {
                    if (this.isValidMove(row, col, kingRow, kingCol, board)) {
                        console.log(`${color} 킹이 ${row},${col}의 ${piece}에 의해 체크됨`);
                        return true;
                    }
                }
            }
        }
        
        console.log(`${color} 킹은 체크 상태가 아님`);
        return false;
    }

    findPositionImprovingMoves(validMoves) {
        const improvingMoves = [];
        
        for (const move of validMoves) {
            // 중앙으로 이동하는 말들
            const toRow = move.to.row;
            const toCol = move.to.col;
            
            if ((toRow >= 3 && toRow <= 4) && (toCol >= 3 && toCol <= 4)) {
                improvingMoves.push(move);
            }
        }
        
        return improvingMoves;
    }

    isSafePosition(row, col) {
        // 안전한 위치인지 확인
        return row >= 2 && row <= 5 && col >= 2 && col <= 5;
    }

    findBestPositionMove(validMoves) {
        const safeMoves = validMoves.filter(move => 
            this.isSafePosition(move.to.row, move.to.col)
        );
        
        return safeMoves.length > 0 ? safeMoves[0] : validMoves[0];
    }

    evaluateMove(move) {
        let score = 0;
        
        // 안전성 검사 추가
        if (!this.board || !move || !move.to || !move.from) {
            return score;
        }
        
        // 말 잡기
        const capturedPiece = this.board[move.to.row] ? this.board[move.to.row][move.to.col] : null;
        if (capturedPiece) {
            score += this.getPieceValue(capturedPiece) * 10;
        }
        
        // 체크
        if (this.wouldBeCheck(move)) {
            score += 50;
        }
        
        // 체크메이트
        if (this.wouldBeCheckmate(move)) {
            score += 1000;
        }
        
        // 위치 개선
            if (this.isSafePosition(move.to.row, move.to.col)) {
                score += 5;
            }
        
        return score;
    }

    minimax(move, depth, isMaximizing) {
        if (depth === 0) {
            return this.evaluateMove(move);
        }
        
        // 메모리 최적화된 임시 보드 생성
        const tempBoard = this.createTempBoard(move);
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            const validMoves = this.getAllValidMovesForBoard(tempBoard, 'black');
            
            for (const nextMove of validMoves) {
                const score = this.minimax(nextMove, depth - 1, false);
                maxScore = Math.max(maxScore, score);
            }
            
            return maxScore;
        } else {
            let minScore = Infinity;
            const validMoves = this.getAllValidMovesForBoard(tempBoard, 'white');
            
            for (const nextMove of validMoves) {
                const score = this.minimax(nextMove, depth - 1, true);
                minScore = Math.min(minScore, score);
            }
            
            return minScore;
        }
    }

    // Alpha-Beta 가지치기 알고리즘
    alphaBeta(move, depth, isMaximizing, alpha, beta) {
        if (depth === 0) {
            return this.evaluatePosition(move);
        }

        // 메모리 최적화된 임시 보드 생성
        const tempBoard = this.createTempBoard(move);
        
        const currentColor = isMaximizing ? 'black' : 'white';
        const validMoves = this.getAllValidMovesForBoard(tempBoard, currentColor);

        if (isMaximizing) {
            let maxScore = -Infinity;
            
            for (const nextMove of validMoves) {
                const score = this.alphaBeta(nextMove, depth - 1, false, alpha, beta);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                
                // Beta 가지치기
                if (beta <= alpha) {
                    break;
                }
            }
            
            return maxScore;
        } else {
            let minScore = Infinity;
            
            for (const nextMove of validMoves) {
                const score = this.alphaBeta(nextMove, depth - 1, true, alpha, beta);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                
                // Alpha 가지치기
                if (beta <= alpha) {
                    break;
                }
            }
            
            return minScore;
        }
    }

    // 위치 평가 함수 (개선된 버전)
    evaluatePosition(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        let score = 0;
        
        // 기물 가치 평가
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = tempBoard[row][col];
                if (piece) {
                    const value = this.getPieceValue(piece);
                    const color = this.getPieceColor(piece);
                    const multiplier = color === 'white' ? 1 : -1;
                    score += value * multiplier;
                }
            }
        }
        
        // 위치적 이점 평가
        score += this.evaluatePositionalAdvantage(tempBoard);
        
        // 체크메이트 기회 평가
        if (this.wouldBeCheckmate(move)) {
            score += 10000;
        }
        
        // 체크 기회 평가
        if (this.wouldBeCheck(move)) {
            score += 50;
        }
        
        return score;
    }

    // 위치적 이점 평가
    evaluatePositionalAdvantage(board) {
        let score = 0;
        
        // 중앙 통제
        const centerSquares = [
            {row: 3, col: 3}, {row: 3, col: 4}, {row: 4, col: 3}, {row: 4, col: 4}
        ];
        
        for (const square of centerSquares) {
            const piece = board[square.row][square.col];
            if (piece) {
                const color = this.getPieceColor(piece);
                const multiplier = color === 'white' ? 1 : -1;
                score += 10 * multiplier;
            }
        }
        
        // 기물 활동성 평가
        score += this.evaluatePieceActivity(board);
        
        return score;
    }

    // 기물 활동성 평가
    evaluatePieceActivity(board) {
        let score = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const color = this.getPieceColor(piece);
                    const multiplier = color === 'white' ? 1 : -1;
                    
                    // 각 기물별 활동성 점수
                    switch (piece) {
                        case '♙': case '♟': // 폰
                            score += this.evaluatePawnActivity(row, col, color) * multiplier;
                            break;
                        case '♘': case '♞': // 나이트
                            score += this.evaluateKnightActivity(row, col, color) * multiplier;
                            break;
                        case '♗': case '♝': // 비숍
                            score += this.evaluateBishopActivity(row, col, color) * multiplier;
                            break;
                        case '♖': case '♜': // 룩
                            score += this.evaluateRookActivity(row, col, color) * multiplier;
                            break;
                        case '♕': case '♛': // 퀸
                            score += this.evaluateQueenActivity(row, col, color) * multiplier;
                            break;
                        case '♔': case '♚': // 킹
                            score += this.evaluateKingActivity(row, col, color) * multiplier;
                            break;
                    }
                }
            }
        }
        
        return score;
    }

    // 폰 활동성 평가
    evaluatePawnActivity(row, col, color) {
        let score = 0;
        
        // 중앙 폰은 더 높은 가치
        if (col >= 2 && col <= 5) {
            score += 5;
        }
        
        // 전진한 폰은 더 높은 가치
        if (color === 'white') {
            score += (7 - row) * 2;
        } else {
            score += row * 2;
        }
        
        return score;
    }

    // 나이트 활동성 평가
    evaluateKnightActivity(row, col, color) {
        let score = 0;
        
        // 중앙에 가까울수록 높은 가치
        const centerDistance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
        score += (7 - centerDistance) * 3;
        
        return score;
    }

    // 비숍 활동성 평가
    evaluateBishopActivity(row, col, color) {
        let score = 0;
        
        // 대각선 길이에 따른 평가
        const diagonalLength = Math.min(row, col) + Math.min(7 - row, 7 - col);
        score += diagonalLength * 2;
        
        return score;
    }

    // 룩 활동성 평가
    evaluateRookActivity(row, col, color) {
        let score = 0;
        
        // 7번째/2번째 줄의 룩은 더 높은 가치
        if (row === 6 || row === 1) {
            score += 10;
        }
        
        return score;
    }

    // 퀸 활동성 평가
    evaluateQueenActivity(row, col, color) {
        let score = 0;
        
        // 너무 일찍 나오는 퀸은 페널티
        if (color === 'white' && row > 4) {
            score -= 20;
        } else if (color === 'black' && row < 3) {
            score -= 20;
        }
        
        return score;
    }

    // 킹 활동성 평가
    evaluateKingActivity(row, col, color) {
        let score = 0;
        
        // 게임 초반에는 킹이 안전해야 함
        if (color === 'white' && row < 6) {
            score += 10;
        } else if (color === 'black' && row > 1) {
            score += 10;
        }
        
        return score;
    }

    // 이동을 평가 함수로 정렬
    sortMovesByEvaluation(moves) {
        return moves.sort((a, b) => {
            const scoreA = this.evaluateMove(a);
            const scoreB = this.evaluateMove(b);
            return scoreB - scoreA; // 내림차순 정렬
        });
    }

    // 딥러닝 모델 초기화
    initializeDeepLearningModel() {
        return {
            isTrained: false,
            weights: {},
            trainingData: [],
            learningRate: 0.01,
            
            // 신경망 구조
            layers: [64, 128, 64, 32, 1], // 입력층(64개 기물 위치) -> 은닉층 -> 출력층(1개 점수)
            
            // 가중치 초기화
            initializeWeights() {
                this.weights = {};
                for (let i = 0; i < this.layers.length - 1; i++) {
                    const layerSize = this.layers[i];
                    const nextLayerSize = this.layers[i + 1];
                    this.weights[`layer${i}`] = [];
                    
                    for (let j = 0; j < nextLayerSize; j++) {
                        this.weights[`layer${i}`][j] = [];
                        for (let k = 0; k < layerSize; k++) {
                            this.weights[`layer${i}`][j][k] = Math.random() * 2 - 1; // -1 ~ 1
                        }
                    }
                }
            },
            
            // 순전파 (Forward Propagation)
            forwardPropagate(input) {
                let currentLayer = input;
                const activations = [currentLayer];
                
                for (let i = 0; i < this.layers.length - 1; i++) {
                    const nextLayer = new Array(this.layers[i + 1]).fill(0);
                    
                    for (let j = 0; j < this.layers[i + 1]; j++) {
                        for (let k = 0; k < this.layers[i]; k++) {
                            nextLayer[j] += currentLayer[k] * this.weights[`layer${i}`][j][k];
                        }
                        nextLayer[j] = this.activationFunction(nextLayer[j]);
                    }
                    
                    currentLayer = nextLayer;
                    activations.push(currentLayer);
                }
                
                return activations;
            },
            
            // 활성화 함수 (ReLU)
            activationFunction(x) {
                return Math.max(0, x);
            },
            
            // 활성화 함수의 도함수
            activationDerivative(x) {
                return x > 0 ? 1 : 0;
            },
            
            // 역전파 (Backpropagation)
            backpropagate(input, target, activations) {
                const errors = [];
                const gradients = {};
                
                // 출력층 오차 계산
                const outputError = target - activations[activations.length - 1][0];
                errors.push([outputError]);
                
                // 은닉층 오차 계산
                for (let i = activations.length - 2; i > 0; i--) {
                    const layerErrors = [];
                    for (let j = 0; j < activations[i].length; j++) {
                        let error = 0;
                        for (let k = 0; k < errors[0].length; k++) {
                            error += errors[0][k] * this.weights[`layer${i}`][k][j];
                        }
                        layerErrors.push(error * this.activationDerivative(activations[i][j]));
                    }
                    errors.unshift(layerErrors);
                }
                
                // 가중치 업데이트
                for (let i = 0; i < this.layers.length - 1; i++) {
                    gradients[`layer${i}`] = [];
                    for (let j = 0; j < this.layers[i + 1]; j++) {
                        gradients[`layer${i}`][j] = [];
                        for (let k = 0; k < this.layers[i]; k++) {
                            const gradient = errors[i][j] * activations[i][k];
                            gradients[`layer${i}`][j][k] = gradient;
                            this.weights[`layer${i}`][j][k] += this.learningRate * gradient;
                        }
                    }
                }
            },
            
            // 학습
            train(trainingData) {
                console.log('딥러닝 모델 학습 시작...');
                this.initializeWeights();
                
                // 에포크 수를 줄여서 성능 개선 (100 → 20)
                const epochs = 20;
                
                for (let epoch = 0; epoch < epochs; epoch++) {
                    let totalError = 0;
                    
                    // 학습 데이터의 일부만 사용하여 성능 개선
                    const batchSize = Math.min(50, trainingData.length);
                    const batch = trainingData.slice(0, batchSize);
                    
                    for (const data of batch) {
                        const activations = this.forwardPropagate(data.input);
                        const prediction = activations[activations.length - 1][0];
                        const error = data.target - prediction;
                        totalError += Math.abs(error);
                        
                        this.backpropagate(data.input, data.target, activations);
                    }
                    
                    // 진행 상황 표시 (5 에포크마다)
                    if (epoch % 5 === 0) {
                        console.log(`에포크 ${epoch}/${epochs}: 평균 오차 = ${(totalError / batch.length).toFixed(4)}`);
                    }
                }
                
                this.isTrained = true;
                console.log('딥러닝 모델 학습 완료!');
            },
            
            // 예측
            predict(input) {
                const activations = this.forwardPropagate(input);
                return activations[activations.length - 1][0];
            }
        };
    }

    // 체스판을 신경망 입력으로 변환
    boardToNeuralInput(board) {
        const input = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const value = this.getPieceValue(piece);
                    const color = this.getPieceColor(piece);
                    const normalizedValue = color === 'white' ? value : -value;
                    input.push(normalizedValue / 9); // 정규화 (-1 ~ 1)
            } else {
                    input.push(0);
                }
            }
        }
        
        return input;
    }

    // 딥러닝 모델로 이동 선택
    getDeepLearningMove(validMoves) {
        if (!this.deepLearningModel.isTrained) {
            return null;
        }
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of validMoves) {
            // 임시로 이동 실행
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            tempBoard[move.to.row][move.to.col] = move.piece;
            tempBoard[move.from.row][move.from.col] = '';
            
            // 신경망 입력으로 변환
            const input = this.boardToNeuralInput(tempBoard);
            
            // 예측
            const score = this.deepLearningModel.predict(input);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    // 딥러닝 모델 학습 데이터 생성
    generateTrainingData() {
        console.log('딥러닝 학습 데이터 생성 중...');
        
        const trainingData = [];
        
        // 학습 데이터 수를 줄여서 성능 개선 (1000 → 100)
        for (let i = 0; i < 100; i++) {
            const randomBoard = this.generateRandomPosition();
            const input = this.boardToNeuralInput(randomBoard);
            const target = this.evaluateBoardPosition(randomBoard);
            
            trainingData.push({ input, target });
            
            // 진행 상황 표시 (10개마다)
            if ((i + 1) % 10 === 0) {
                console.log(`학습 데이터 생성 진행률: ${i + 1}/100`);
            }
        }
        
        console.log(`${trainingData.length}개의 학습 데이터 생성 완료`);
        return trainingData;
    }

    // 랜덤 체스 위치 생성
    generateRandomPosition() {
        const board = Array(8).fill().map(() => Array(8).fill(''));
        const pieces = ['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟'];
        
        // 기본 기물 배치
        const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
        const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
        
        // 랜덤하게 기물 배치
        for (let i = 0; i < 10; i++) {
            const row = Math.floor(Math.random() * 8);
            const col = Math.floor(Math.random() * 8);
            const piece = pieces[Math.floor(Math.random() * pieces.length)];
            
            if (board[row][col] === '') {
                board[row][col] = piece;
            }
        }
        
        return board;
    }

    // 보드 위치 평가 (학습 데이터용)
    evaluateBoardPosition(board) {
        let score = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const value = this.getPieceValue(piece);
                    const color = this.getPieceColor(piece);
                    const multiplier = color === 'white' ? 1 : -1;
                    score += value * multiplier;
                }
            }
        }
        
        // 정규화 (-1 ~ 1)
        return Math.tanh(score / 100);
    }

    // 딥러닝 모델 학습 시작
    startDeepLearningTraining() {
        console.log('딥러닝 모델 학습을 시작합니다...');
        
        // 비동기 처리로 브라우저 블록 방지
        setTimeout(() => {
            try {
                const trainingData = this.generateTrainingData();
                console.log('딥러닝 모델 학습 중...');
                
                // 학습 과정을 비동기로 처리
                setTimeout(() => {
                    try {
                        this.deepLearningModel.train(trainingData);
                        console.log('딥러닝 모델 학습 완료!');
                        this.showNotification('딥러닝 모델 학습이 완료되었습니다!');
        } catch (error) {
                        console.error('딥러닝 모델 학습 중 오류:', error);
                        this.showNotification('딥러닝 모델 학습 중 오류가 발생했습니다.');
                    }
                }, 100);
                
            } catch (error) {
                console.error('학습 데이터 생성 중 오류:', error);
                this.showNotification('학습 데이터 생성 중 오류가 발생했습니다.');
            }
        }, 100);
    }

    // 추크츠방 생성 여부 확인
    wouldCreateZugzwang(move) {
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        const currentColor = this.getPieceColor(move.piece);
        const opponentColor = currentColor === 'white' ? 'black' : 'white';
        const opponentMoves = this.getAllValidMoves(opponentColor, tempBoard);
        
        // 상대방의 모든 이동이 불리한지 확인
        let allMovesBad = true;
        for (const opponentMove of opponentMoves) {
            const score = this.evaluateMove(opponentMove);
            if (score > -50) { // 어느 정도 이득이 있는 이동이 있다면
                allMovesBad = false;
                break;
            }
        }
        
        return allMovesBad && opponentMoves.length > 0;
    }

    // 오포지션 생성 여부 확인
    wouldCreateOpposition(move) {
        const piece = this.board[move.from.row][move.from.col];
        if (piece !== '♔' && piece !== '♚') return false;
        
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        // 킹들의 위치 확인
        let whiteKingPos = null;
        let blackKingPos = null;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (tempBoard[row][col] === '♔') {
                    whiteKingPos = { row, col };
                } else if (tempBoard[row][col] === '♚') {
                    blackKingPos = { row, col };
                }
            }
        }
        
        if (!whiteKingPos || !blackKingPos) return false;
        
        // 킹들이 같은 열이나 행에 있는지 확인
        const sameRow = whiteKingPos.row === blackKingPos.row;
        const sameCol = whiteKingPos.col === blackKingPos.col;
        
        if (sameRow || sameCol) {
            // 킹들 사이의 거리 확인
            const distance = Math.abs(whiteKingPos.row - blackKingPos.row) + 
                           Math.abs(whiteKingPos.col - blackKingPos.col);
            return distance <= 2; // 킹들이 가까이 있을 때
        }
        
        return false;
    }

    // 말을 함정에 빠뜨리는지 확인
    wouldTrapPiece(move) {
        const targetPiece = this.board[move.to.row][move.to.col];
        if (!targetPiece) return false;
        
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        tempBoard[move.to.row][move.to.col] = move.piece;
        tempBoard[move.from.row][move.from.col] = '';
        
        const targetColor = this.getPieceColor(targetPiece);
        const targetMoves = this.getAllValidMoves(targetColor, tempBoard);
        
        // 상대방 말의 이동 가능한 위치가 제한되는지 확인
        return targetMoves.length <= 2; // 이동 가능한 위치가 2개 이하일 때 함정으로 간주
    }

    // AI 분석 표시
    showAIAnalysis() {
        console.log('AI 분석 시작...');
        
        const currentColor = this.currentPlayer;
        const validMoves = this.getAllValidMoves(currentColor);
        
        if (validMoves.length === 0) {
            this.showNotification('분석할 수 있는 이동이 없습니다.');
            return;
        }

        // 각 이동에 대한 AI 분석
        const analysis = [];
        
        for (const move of validMoves) {
            const analysisItem = {
                move: move,
                notation: `${this.getSquareNotation(move.from)} → ${this.getSquareNotation(move.to)}`,
                score: 0,
                evaluation: '',
                tactics: []
            };
            
            // Alpha-Beta 가지치기로 점수 계산
            const alphaBetaScore = this.alphaBeta(move, 3, false, -Infinity, Infinity);
            analysisItem.score = alphaBetaScore;
            
            // 딥러닝 모델이 학습된 경우 딥러닝 점수도 계산
            if (this.deepLearningModel.isTrained) {
                const input = this.boardToNeuralInput(this.board);
                const dlScore = this.deepLearningModel.predict(input);
                analysisItem.dlScore = dlScore;
            }
            
            // 전술 분석
            const tactics = this.findTacticsForMove(move);
            analysisItem.tactics = tactics;
            
            // 평가 텍스트 생성
            if (analysisItem.score > 100) {
                analysisItem.evaluation = '매우 좋은 이동';
            } else if (analysisItem.score > 50) {
                analysisItem.evaluation = '좋은 이동';
            } else if (analysisItem.score > 0) {
                analysisItem.evaluation = '괜찮은 이동';
            } else if (analysisItem.score > -50) {
                analysisItem.evaluation = '평범한 이동';
            } else {
                analysisItem.evaluation = '나쁜 이동';
            }
            
            analysis.push(analysisItem);
        }
        
        // 점수순으로 정렬
        analysis.sort((a, b) => b.score - a.score);
        
        // 분석 결과 표시
        this.displayAIAnalysis(analysis);
    }

    // AI 분석 결과 표시
    displayAIAnalysis(analysis) {
        const statusElement = document.getElementById('game-status');
        if (!statusElement) return;
        
        let analysisText = 'AI 분석 결과:\n';
        
        for (let i = 0; i < Math.min(5, analysis.length); i++) {
            const item = analysis[i];
            analysisText += `${i + 1}. ${item.notation} (${item.evaluation}, 점수: ${item.score.toFixed(1)})`;
            
            if (item.tactics.length > 0) {
                analysisText += ` [${item.tactics.join(', ')}]`;
            }
            
            if (item.dlScore !== undefined) {
                analysisText += ` [DL: ${item.dlScore.toFixed(3)}]`;
            }
            
            analysisText += '\n';
        }
        
        statusElement.textContent = analysisText;
        
        // 상위 3개 이동 하이라이트
        this.highlightTopMoves(analysis.slice(0, 3));
        
        this.showNotification('AI 분석이 완료되었습니다!');
    }

    // 상위 이동들 하이라이트
    highlightTopMoves(topMoves) {
        // 기존 하이라이트 제거
        this.clearHighlights();
        
        // 상위 이동들 하이라이트
        topMoves.forEach((item, index) => {
            const fromSquare = document.querySelector(`[data-row="${item.move.from.row}"][data-col="${item.move.from.col}"]`);
            const toSquare = document.querySelector(`[data-row="${item.move.to.row}"][data-col="${item.move.to.col}"]`);
            
            if (fromSquare) {
                fromSquare.classList.add(`top-move-${index + 1}`);
            }
            if (toSquare) {
                toSquare.classList.add(`top-move-${index + 1}`);
            }
        });
        
        // 5초 후 하이라이트 제거
        setTimeout(() => {
            this.clearHighlights();
        }, 5000);
    }

    isPieceOfColor(piece, color) {
        const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
        const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
        
        if (color === 'white') {
            return whitePieces.includes(piece);
            } else {
            return blackPieces.includes(piece);
        }
    }

    getPieceColor(piece) {
        const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
        return whitePieces.includes(piece) ? 'white' : 'black';
    }

    // 폰 승진 체크
    isPawnPromotion(row, col, piece) {
        if (piece !== '♙' && piece !== '♟') return false;
        
        const color = this.getPieceColor(piece);
        if (color === 'white' && row === 0) return true;
        if (color === 'black' && row === 7) return true;
        
        return false;
    }

    // 폰 승진 실행
    promotePawn(row, col) {
        // 실제 말의 색상을 확인 (현재 플레이어가 아닌)
        const piece = this.board[row][col];
        const color = this.getPieceColor(piece);
        
        console.log(`폰 승진: ${color} 폰이 승진합니다`);
        
        // 승진 선택 UI 표시 - 원래 위치도 전달
        this.showPromotionDialog(row, col, color, this.selectedPiece ? this.selectedPiece.row : null, this.selectedPiece ? this.selectedPiece.col : null);
    }

    // 승진 선택 다이얼로그 표시
    showPromotionDialog(row, col, color, fromRow, fromCol) {
        const pieces = color === 'white' ? ['♕', '♖', '♗', '♘'] : ['♛', '♜', '♝', '♞'];
        const pieceNames = ['퀸', '룩', '비숍', '나이트'];
        
        // 기존 다이얼로그 제거
        const existingDialog = document.getElementById('promotion-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        // 다이얼로그 생성
        const dialog = document.createElement('div');
        dialog.id = 'promotion-dialog';
        dialog.className = 'promotion-dialog';
        dialog.innerHTML = `
            <div class="promotion-content">
                <h3>폰 승진</h3>
                <div class="promotion-pieces">
                    ${pieces.map((piece, index) => `
                        <button class="promotion-piece" data-piece="${piece}">
                            <span class="piece">${piece}</span>
                            <span class="piece-name">${pieceNames[index]}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
                        // 클릭 이벤트 추가
                dialog.querySelectorAll('.promotion-piece').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const selectedPiece = btn.dataset.piece;
                        
                        // 폰 이동과 승진을 완전히 처리
                        if (fromRow !== null && fromCol !== null) {
                            // 폰 이동
                            const piece = this.board[fromRow][fromCol];
                            this.board[row][col] = selectedPiece;
                            this.board[fromRow][fromCol] = '';
                            
                            // moveHistory에 이동과 승진 정보 추가
                            this.moveHistory.push({
                                from: { row: fromRow, col: fromCol },
                                to: { row: row, col: col },
                                piece: piece,
                                captured: '',
                                special: 'promotion',
                                promotedPiece: selectedPiece,
                                promotedColor: color
                            });
                            
                            // 턴 변경
                            this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                        } else {
                            // fromRow/fromCol이 없는 경우 (온라인 모드 등) 단순히 승진만 처리
                            const piece = this.board[row][col];
                            this.board[row][col] = selectedPiece;
                            
                            // moveHistory에 승진 정보 추가
                            this.moveHistory.push({
                                from: { row: row, col: col },
                                to: { row: row, col: col },
                                piece: piece,
                                captured: '',
                                special: 'promotion',
                                promotedPiece: selectedPiece,
                                promotedColor: color
                            });
                            
                            // 턴 변경
                            this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                        }
                        
                        dialog.remove();
                        this.renderBoard();
                        console.log(`${color} 폰이 ${pieceNames[pieces.indexOf(selectedPiece)]}로 승진했습니다!`);
                        
                        // 선택 해제 및 하이라이트 제거
                        this.selectedPiece = null;
                        this.clearHighlights();
                        
                        // 사운드 재생
                        this.playPieceSound();
                        
                        // 게임 상태 업데이트
                        this.updateGameStatus();
                        this.updateMoveHistory();
                        this.updateCapturedPieces();
                        
                        // 게임 종료 확인
                        this.checkGameEnd();
                        
                        // 온라인 모드라면 승진 완료 후 서버에 전송
                        if (this.gameMode === 'online-player') {
                            this.sendMoveToServer(fromRow, fromCol, row, col, piece, '', 'promotion');
                        }
                    });
                });
    }

    // 캐슬링 이동인지 체크
    isCastlingMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (piece !== '♔' && piece !== '♚') return false;
        
        // 킹이 2칸 이동하는지 체크
        const colDiff = Math.abs(toCol - fromCol);
        return fromRow === toRow && colDiff === 2;
    }

    // 캐슬링 실행
    executeCastling(fromRow, fromCol, toRow, toCol) {
        const color = this.currentPlayer;
        const isKingside = toCol > fromCol; // 킹사이드 캐슬링
        
        // 킹 이동
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = '';
        
        // 룩 이동
        if (isKingside) {
            // 킹사이드 캐슬링
            this.board[fromRow][5] = this.board[fromRow][7];
            this.board[fromRow][7] = '';
        } else {
            // 퀸사이드 캐슬링
            this.board[fromRow][3] = this.board[fromRow][0];
            this.board[fromRow][0] = '';
        }
    }

    // 캐슬링 가능한지 체크
    canCastle(color, side) {
        const row = color === 'white' ? 7 : 0;
        const king = color === 'white' ? '♔' : '♚';
        const rook = color === 'white' ? '♖' : '♜';
        
        // 킹과 룩이 원래 위치에 있는지 체크
        if (this.board[row][4] !== king) return false;
        
        if (side === 'kingside') {
            if (this.board[row][7] !== rook) return false;
            // 중간 칸들이 비어있는지 체크
            return this.board[row][5] === '' && this.board[row][6] === '';
        } else {
            if (this.board[row][0] !== rook) return false;
            // 중간 칸들이 비어있는지 체크
            return this.board[row][1] === '' && this.board[row][2] === '' && this.board[row][3] === '';
        }
    }

    // 특별 이동 타입 반환
    getSpecialMoveType(fromRow, fromCol, toRow, toCol, piece) {
        if (this.isCastlingMove(fromRow, fromCol, toRow, toCol)) {
            return toCol > fromCol ? 'kingside-castling' : 'queenside-castling';
        }
        if (this.isPawnPromotion(toRow, toCol, piece)) {
            return 'promotion';
        }
        if (this.isEnPassantMove(fromRow, fromCol, toRow, toCol)) {
            return 'en-passant';
        }
        return 'normal';
    }

    // 캐슬링 유효성 검사 (이동 규칙에 추가)
    isValidCastling(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (piece !== '♔' && piece !== '♚') return false;
        
        const color = this.getPieceColor(piece);
        const isKingside = toCol > fromCol;
        
        // 캐슬링 가능한지 체크
        if (!this.canCastle(color, isKingside ? 'kingside' : 'queenside')) {
            return false;
        }
        
        // 킹이 체크 상태가 아닌지 체크
        if (this.isKingInCheck(color)) {
            return false;
        }
        
        // 킹이 지나가는 칸이 공격받지 않는지 체크
        const kingPath = isKingside ? [5, 6] : [2, 3];
        for (const col of kingPath) {
            if (this.isSquareUnderAttack(fromRow, col, color === 'white' ? 'black' : 'white')) {
                return false;
            }
        }
        
        return true;
    }

    // 특정 칸이 공격받는지 체크
    isSquareUnderAttack(row, col, attackingColor, board = this.board) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && this.getPieceColor(piece) === attackingColor) {
                    if (this.isValidMove(r, c, row, col, board)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // 엔패선트 대상 찾기
    getEnPassantTarget() {
        if (this.moveHistory.length === 0) return null;
        
        const lastMove = this.moveHistory[this.moveHistory.length - 1];
        const piece = lastMove.piece;
        
        // 폰이 2칸 이동했는지 체크
        if ((piece === '♙' || piece === '♟') && 
            Math.abs(lastMove.from.row - lastMove.to.row) === 2) {
            return {
                row: (lastMove.from.row + lastMove.to.row) / 2,
                col: lastMove.to.col
            };
        }
        
        return null;
    }

    // 엔패선트 이동인지 체크
    isEnPassantMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (piece !== '♙' && piece !== '♟') return false;
        
        const enPassantTarget = this.getEnPassantTarget();
        if (!enPassantTarget) return false;
        
        // 대각선으로 이동하면서 엔패선트 대상 칸으로 이동하는지 체크
        const color = this.getPieceColor(piece);
        const direction = color === 'white' ? -1 : 1;
        
        return toRow === fromRow + direction && 
               Math.abs(toCol - fromCol) === 1 && 
               toRow === enPassantTarget.row && 
               toCol === enPassantTarget.col;
    }

    // 엔패선트 실행
    executeEnPassant(fromRow, fromCol, toRow, toCol) {
        const enPassantTarget = this.getEnPassantTarget();
        if (enPassantTarget) {
            // 엔패선트 대상 폰 제거
            this.board[enPassantTarget.row][enPassantTarget.col] = '';
        }
    }

    // 체크 상태 체크
    isCheck(color) {
        return this.isKingInCheck(color);
    }

    // 체크메이트 상태 체크
    isCheckmate(color) {
        console.log(`isCheckmate 호출됨 - 색상: ${color}`);
        
        if (!this.isCheck(color)) {
            console.log(`${color}는 체크 상태가 아님`);
            return false;
        }
        
        console.log(`${color}는 체크 상태임 - 체크메이트 확인 중...`);
        
        // 모든 말의 모든 가능한 이동을 시도해보기
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.getPieceColor(piece) === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(row, col, toRow, toCol)) {
                                // 임시로 이동 실행
                                const tempBoard = JSON.parse(JSON.stringify(this.board));
                                tempBoard[toRow][toCol] = piece;
                                tempBoard[row][col] = '';
                                
                                // 체크가 해제되는지 확인
                                if (!this.isKingInCheck(color, tempBoard)) {
                                    console.log(`${color}가 체크를 피할 수 있는 이동 발견: ${row},${col} -> ${toRow},${toCol}`);
                                    return false; // 체크를 피할 수 있는 이동이 있음
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`${color} 체크메이트 확인됨!`);
        return true; // 체크를 피할 수 있는 이동이 없음
    }

    // 킹이 잡혔는지 확인
    isKingCaptured(color) {
        // 해당 색상의 킹이 보드에 있는지 확인
        const kingPiece = color === 'white' ? '♔' : '♚';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.board[row][col] === kingPiece) {
                    return false; // 킹이 보드에 있음
                }
            }
        }
        
        console.log(`${color} 킹이 잡혔습니다!`);
        return true; // 킹이 보드에 없음 (잡힘)
    }

    // 스테일메이트 상태 체크
    isStalemate(color) {
        if (this.isCheck(color)) return false;
        
        // 모든 말의 모든 가능한 이동을 시도해보기
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.getPieceColor(piece) === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(row, col, toRow, toCol)) {
                                return false; // 유효한 이동이 있음
                            }
                        }
                    }
                }
            }
        }
        
        return true; // 유효한 이동이 없음
    }

    // 게임 종료 상태 체크
    checkGameEnd() {
        console.log('checkGameEnd 호출됨');
        const currentColor = this.currentPlayer;
        const opponentColor = currentColor === 'white' ? 'black' : 'white';
        
        console.log(`현재 플레이어: ${currentColor}, 상대방: ${opponentColor}`);
        
        // 킹이 잡혔는지 확인
        if (this.isKingCaptured(opponentColor)) {
            console.log('킹이 잡힘!');
            this.endGame('king-capture', currentColor);
            return true;
        }
        
        // 현재 플레이어가 상대방을 체크메이트했는지 확인
        if (this.isCheckmate(opponentColor)) {
            console.log('체크메이트 감지됨!');
            this.endGame('checkmate', currentColor);
            return true;
        }
        
        // 현재 플레이어가 스테일메이트를 당했는지 확인
        if (this.isStalemate(currentColor)) {
            console.log('스테일메이트 감지됨!');
            this.endGame('stalemate', null);
            return true;
        }
        
        console.log('게임 종료 조건 없음');
        return false;
    }

    // 게임 종료 처리
    endGame(type, winner, loser = null) {
        // 타이머 정지
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        let message = '';
        let isWin = false;
        let isLose = false;
        
        switch (type) {
            case 'checkmate':
                const winnerName = winner === 'white' ? '흰색' : '검은색';
                message = `체크메이트! ${winnerName} 플레이어가 승리했습니다!`;
                
                // 이긴 사람에게 WIN, 진 사람에게 LOSE 표시
                if (this.gameMode === 'ai') {
                    // AI 모드에서는 플레이어가 항상 흰색
                    isWin = winner === 'white'; // 이긴 사람(흰색)에게 WIN
                    isLose = winner === 'black'; // 진 사람(검은색)에게 LOSE
                } else if (this.gameMode === 'local') {
                    // 로컬 모드에서는 winner가 현재 플레이어인지 확인 (이긴 사람에게 WIN)
                    isWin = winner === this.currentPlayer;
                    isLose = winner !== this.currentPlayer;
                } else if (this.gameMode === 'puzzle') {
                    // 퍼즐 모드에서는 플레이어가 항상 흰색
                    isWin = winner === 'white'; // 이긴 사람(흰색)에게 WIN
                    isLose = winner === 'black'; // 진 사람(검은색)에게 LOSE
                } else if (this.gameMode === 'online-player') {
                    // 온라인 모드에서는 winner가 현재 플레이어의 색깔과 같은지 확인
                    isWin = winner === this.playerColor;
                    isLose = winner !== this.playerColor;
                }
                break;
            case 'king-capture':
                const captureWinnerName = winner === 'white' ? '흰색' : '검은색';
                message = `킹을 잡았습니다! ${captureWinnerName} 플레이어가 승리했습니다!`;
                
                // 이긴 사람에게 WIN, 진 사람에게 LOSE 표시
                if (this.gameMode === 'ai') {
                    // AI 모드에서는 플레이어가 항상 흰색
                    isWin = winner === 'white'; // 이긴 사람(흰색)에게 WIN
                    isLose = winner === 'black'; // 진 사람(검은색)에게 LOSE
                } else if (this.gameMode === 'local') {
                    // 로컬 모드에서는 winner가 현재 플레이어인지 확인 (이긴 사람에게 WIN)
                    isWin = winner === this.currentPlayer;
                    isLose = winner !== this.currentPlayer;
                } else if (this.gameMode === 'puzzle') {
                    // 퍼즐 모드에서는 플레이어가 항상 흰색
                    isWin = winner === 'white'; // 이긴 사람(흰색)에게 WIN
                    isLose = winner === 'black'; // 진 사람(검은색)에게 LOSE
                } else if (this.gameMode === 'online-player') {
                    // 온라인 모드에서는 winner가 현재 플레이어의 색깔과 같은지 확인
                    isWin = winner === this.playerColor;
                    isLose = winner !== this.playerColor;
                }
                break;
            case 'stalemate':
                message = '스테일메이트! 무승부입니다.';
                break;
            case 'timeout':
                const timeoutWinner = winner === 'white' ? '흰색' : '검은색';
                message = `시간 초과! ${timeoutWinner} 플레이어가 승리했습니다!`;
                
                if (this.gameMode === 'ai') {
                    isWin = winner === 'white';
                    isLose = winner === 'black';
                }
                break;
        }
        
        // 승패 메시지 표시
        if (isWin) {
            this.showGameResult('WIN!');
        } else if (isLose) {
            this.showGameResult('LOSE!');
        } else {
            alert(message);
        }
        
        // 게임 종료 상태 설정
        this.gameOver = true;
        this.winner = winner;
        
        // 게임 상태 업데이트
        this.updateGameStatus();
        
        console.log(`게임 종료: ${type} - ${message}`);
    }

    // 게임 결과 표시
    showGameResult(result) {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.game-result-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 중앙 팝업 알림 생성 (기존 방식)
        const notification = document.createElement('div');
        notification.className = `game-result-notification ${result.toLowerCase()}`;
        notification.textContent = result;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 72px;
            font-weight: bold;
            color: ${result === 'WIN!' ? '#4CAF50' : '#F44336'};
            background: rgba(0, 0, 0, 0.9);
            padding: 30px 60px;
            border-radius: 15px;
            z-index: 1000;
            animation: gameResultFadeIn 0.5s ease-in-out;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 3px solid ${result === 'WIN!' ? '#4CAF50' : '#F44336'};
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // 사이드 패널 결과 표시
        const resultText = document.getElementById('result-text');
        if (resultText) {
            if (result === 'WIN!') {
                resultText.textContent = 'WIN';
                resultText.classList.remove('lose');
                resultText.classList.add('win');
            } else if (result === 'LOSE!') {
                resultText.textContent = 'LOSE';
                resultText.classList.remove('win');
                resultText.classList.add('lose');
            } else {
                resultText.textContent = '';
                resultText.classList.remove('win', 'lose');
            }
        }
    }

    // WebSocket 기반 온라인 플레이 메서드들
    createRoom() {
        const playerName = document.getElementById('player-name')?.value || 'Player';
        const roomId = document.getElementById('room-id')?.value || `room_${Date.now()}`;
        this.connectToWebSocket(roomId, playerName);
    }

    joinRoom() {
        const playerName = document.getElementById('player-name')?.value || 'Player';
        const roomId = document.getElementById('room-id')?.value;
        if (!roomId) {
            alert('방 ID를 입력해주세요.');
            return;
        }
        this.connectToWebSocket(roomId, playerName);
    }

    randomMatch() {
        const playerName = document.getElementById('player-name')?.value || 'Player';
        this.findAvailableRoom(playerName);
    }

    connectToWebSocket(roomId, playerName) {
        console.log('=== connectToWebSocket 호출됨 ===');
        console.log('roomId:', roomId);
        console.log('playerName:', playerName);
        
        this.roomId = roomId;
        this.playerName = playerName;
        this.gameMode = 'online-player';
        
        // Railway 배포를 위한 동적 URL 설정
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const wsUrl = `${protocol}//${host}:${port}?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
        
        console.log('🌐 WebSocket 연결 시도:', wsUrl);
        console.log('프로토콜:', protocol);
        console.log('호스트:', host);
        console.log('포트:', port);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket 연결 성공');
            console.log('WebSocket 상태:', this.ws.readyState);
            this.updateConnectionStatus('연결됨', true);
        };
        
        this.ws.onmessage = (event) => {
            console.log('📨 WebSocket 메시지 수신:', event.data);
            try {
                const data = JSON.parse(event.data);
                console.log('📨 파싱된 메시지:', data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ WebSocket 메시지 파싱 오류:', error);
                console.error('원본 메시지:', event.data);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket 연결 종료');
            console.log('종료 코드:', event.code);
            console.log('종료 이유:', event.reason);
            this.updateConnectionStatus('연결 끊김', false);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket 오류:', error);
            this.updateConnectionStatus('연결 오류', false);
        };
    }

    handleWebSocketMessage(data) {
        console.log('WebSocket 메시지 수신:', data);
        
        switch (data.type) {
            case 'playerAssigned':
                this.playerColor = data.color;
                console.log(`플레이어 색상 할당: ${data.color}`);
                this.updateConnectionStatus(data.message, true);
                break;
                
            case 'gameStart':
                this.playerColor = data.playerColor;
                this.loadGameState(data.gameState);
                console.log(`게임 시작! 내 색상: ${data.playerColor}`);
                this.updateConnectionStatus('게임 시작!', true);
                break;
                
            case 'move':
                if (data.playerName !== this.playerName) {
                    console.log('상대방 이동 수신:', data);
                    this.handleOpponentMove(data);
                }
                break;
                
            case 'gameOver':
                console.log('게임 종료:', data);
                this.endGame(data.result, data.winner, data.loser);
                break;
                
            case 'error':
                console.error('서버 오류:', data.message);
                this.updateConnectionStatus(`오류: ${data.message}`, false);
                break;
                
            case 'moveUpdate':
                console.log('=== moveUpdate 메시지 수신 ===');
                console.log('받은 데이터:', data);
                console.log('현재 보드 상태:', this.board);
                
                // 이전 보드 상태 저장 (시각적 효과를 위해)
                const previousBoard = JSON.parse(JSON.stringify(this.board));
                console.log('이전 보드 상태:', previousBoard);
                
                // 서버 상태 로드
                this.loadGameState(data.gameState);
                
                // 보드 상태가 실제로 변경되었는지 확인
                console.log('서버에서 받은 보드 상태:', data.gameState.board);
                console.log('업데이트 후 보드 상태:', this.board);
                
                // 보드 상태가 다르면 강제로 다시 렌더링
                if (JSON.stringify(this.board) !== JSON.stringify(previousBoard)) {
                    console.log('보드 상태가 변경됨 - 강제 렌더링');
                    this.forceRenderBoard();
                    
                    // 렌더링 후 실제 DOM 상태 확인
                    setTimeout(() => {
                        const chessboard = document.getElementById('chessboard');
                        if (chessboard) {
                            console.log('렌더링 후 DOM 상태 확인:');
                            for (let row = 0; row < 8; row++) {
                                for (let col = 0; col < 8; col++) {
                                    const square = chessboard.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                                    const piece = square ? square.textContent : '';
                                    console.log(`[${row},${col}]: "${piece}" (보드: "${this.board[row][col]}")`);
                                }
                            }
                        }
                    }, 100);
                } else {
                    console.log('보드 상태가 변경되지 않음');
                }
                
                // lastMove 정보가 있으면 시각적 효과 추가
                if (data.lastMove) {
                    console.log('시각적 효과 추가:', data.lastMove);
                    this.addMoveVisualEffect(data.lastMove, previousBoard);
                }
                
                console.log('=== moveUpdate 처리 완료 ===');
                break;
                
            default:
                console.log('알 수 없는 메시지 타입:', data.type);
        }
    }

    handleOpponentMove(data) {
        const { fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType } = data;
        
        console.log('상대방 이동 처리:', data);
        
        // 상대방의 이동을 보드에 반영
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = '';
        
        // 특별한 이동 처리 (온라인 모드에서는 서버 상태를 신뢰하므로 건너뜀)
        if (this.gameMode !== 'online-player') {
            if (specialType === 'kingside-castling' || specialType === 'queenside-castling') {
                this.executeCastling(fromRow, fromCol, toRow, toCol);
            } else if (specialType === 'en-passant') {
                this.executeEnPassant(fromRow, fromCol, toRow, toCol);
            }
        }
        
        // 이동 기록에 추가
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: capturedPiece,
            special: specialType
        });
        
        // 턴 변경은 서버에서 관리하므로 여기서는 시각적 효과만 처리
        console.log('시각적 이동 효과 처리 완료');
        
        // UI 업데이트
        this.renderBoard();
        this.updateGameStatus();
        this.updateMoveHistory();
        this.updateCapturedPieces();
        this.clearSelection();
        
        // 게임 종료 확인
        this.checkGameEnd();
        
        console.log('상대방 이동 처리 완료');
    }

    startPolling() {
        // 1초마다 게임 상태 확인 (더 빠른 응답을 위해)
        this.pollInterval = setInterval(() => {
            this.checkGameUpdates();
        }, 1000);
    }

    checkGameUpdates() {
        if (!this.roomId) return;

        const gameKey = `chess_game_${this.roomId}`;
        const gameData = localStorage.getItem(gameKey);
        
        if (gameData) {
            const game = JSON.parse(gameData);
            
            // 플레이어 색상 할당 확인
            if (game.playerColors && !game.playerColors[this.playerName]) {
                // 두 번째 플레이어는 검은색으로 할당
                game.playerColors[this.playerName] = 'black';
                game.players.push({name: this.playerName, color: 'black', joinedAt: Date.now()});
                game.status = 'playing';
                localStorage.setItem(gameKey, JSON.stringify(game));
                this.playerColor = 'black';
                console.log(`참여자 팀 할당: ${this.playerName} -> 검은색`);
            }
            
            // 게임 상태가 변경되었는지 확인 (온라인 모드에서만)
            if (this.gameMode === 'online-player' && JSON.stringify(game.gameState) !== JSON.stringify(this.board)) {
                console.log('상대방의 이동을 감지했습니다. 게임 상태를 업데이트합니다.');
                
                // 완전한 게임 상태 로드 (깊은 복사)
                this.board = JSON.parse(JSON.stringify(game.gameState));
                this.currentPlayer = game.currentPlayer;
                this.moveHistory = JSON.parse(JSON.stringify(game.moveHistory || []));
                
                // 승진 정보가 있는지 확인하고 처리
                if (game.moveHistory && game.moveHistory.length > 0) {
                    const lastMove = game.moveHistory[game.moveHistory.length - 1];
                    if (lastMove && lastMove.special === 'promotion' && lastMove.promotedPiece) {
                        const promotionRow = lastMove.to.row;
                        const promotionCol = lastMove.to.col;
                        
                        // 해당 위치에 해당 색의 폰이 있는지 확인
                        const currentPiece = this.board[promotionRow][promotionCol];
                        const expectedPawn = lastMove.promotedColor === 'white' ? '♙' : '♟';
                        
                        // 해당 색의 폰이 있는 경우에만 승진 처리
                        if (currentPiece === expectedPawn) {
                            this.board[promotionRow][promotionCol] = lastMove.promotedPiece;
                            console.log(`${lastMove.promotedColor} 폰 승진: ${expectedPawn} → ${lastMove.promotedPiece}`);
                        } else if (currentPiece !== lastMove.promotedPiece) {
                            // 이미 승진된 말이 아닌 경우에만 처리 (안전장치)
                            console.log(`승진 위치에 예상한 폰이 없음: ${currentPiece} (예상: ${expectedPawn})`);
                        }
                    }
                }
                
                // UI 업데이트
                this.renderBoard();
                this.updateGameStatus();
                this.updateMoveHistory();
                this.updateCapturedPieces();
                this.clearSelection();
                
                // 게임 종료 조건 확인
                this.checkGameEnd();
                
                console.log('상대방 이동 반영 완료');
                console.log('현재 보드 상태:', this.board);
                console.log('현재 플레이어:', this.currentPlayer);
                console.log('이동 기록:', this.moveHistory);
            }
            
            // 상대방 정보 표시
            if (game.players.length === 2) {
                const opponent = game.players.find(p => p.name !== this.playerName);
                if (opponent) {
                    console.log(`상대방: ${opponent.name} (${opponent.color})`);
                }
            }
        }
    }

    addMoveVisualEffect(lastMove, previousBoard) {
        console.log('=== 시각적 효과 추가 ===');
        console.log('마지막 이동:', lastMove);
        console.log('이전 보드:', previousBoard);
        console.log('현재 보드:', this.board);
        
        const { fromRow, fromCol, toRow, toCol, piece, captured, special } = lastMove;
        
        // 강제 렌더링 사용
        console.log('보드 강제 업데이트 시작');
        this.forceRenderBoard();
        
        // DOM 요소가 업데이트될 때까지 잠시 대기
        setTimeout(() => {
            // 모든 사각형 요소 확인
            const allSquares = document.querySelectorAll('.square');
            console.log('총 사각형 수:', allSquares.length);
            
            // 이동된 말에 하이라이트 효과 추가
            const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
            const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
            
            console.log('DOM 요소 찾기:', {
                fromSquare: fromSquare,
                toSquare: toSquare,
                fromSelector: `[data-row="${fromRow}"][data-col="${fromCol}"]`,
                toSelector: `[data-row="${toRow}"][data-col="${toCol}"]`
            });
            
            // 대안 방법으로 DOM 요소 찾기
            if (!fromSquare || !toSquare) {
                console.log('대안 방법으로 DOM 요소 찾기 시도');
                const chessboard = document.getElementById('chessboard');
                if (chessboard) {
                    const squares = chessboard.children;
                    console.log('체스보드 자식 요소 수:', squares.length);
                    
                    for (let i = 0; i < squares.length; i++) {
                        const square = squares[i];
                        const row = square.getAttribute('data-row');
                        const col = square.getAttribute('data-col');
                        console.log(`사각형 ${i}: row=${row}, col=${col}`);
                    }
                }
            }
            
            if (fromSquare) {
                fromSquare.classList.add('move-from');
                console.log('출발점 하이라이트 추가');
                setTimeout(() => fromSquare.classList.remove('move-from'), 1000);
            } else {
                console.error('출발점 DOM 요소를 찾을 수 없음');
            }
            
            if (toSquare) {
                toSquare.classList.add('move-to');
                console.log('도착점 하이라이트 추가');
                setTimeout(() => toSquare.classList.remove('move-to'), 1000);
            } else {
                console.error('도착점 DOM 요소를 찾을 수 없음');
            }
            
            // 사운드 재생
            this.playPieceSound();
            
            console.log('시각적 효과 적용 완료');
        }, 200); // 대기 시간 증가
    }

    sendMoveToServer(fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType = 'normal') {
        console.log('=== sendMoveToServer 호출됨 ===');
        console.log('WebSocket 상태:', this.ws ? this.ws.readyState : 'null');
        console.log('WebSocket.OPEN:', WebSocket.OPEN);
        console.log('연결됨:', this.ws && this.ws.readyState === WebSocket.OPEN);
        
        if (!this.ws) {
            console.error('❌ WebSocket 객체가 없습니다.');
            return;
        }
        
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket이 연결되지 않았습니다. 상태:', this.ws.readyState);
            console.log('상태 설명:');
            console.log('0 = CONNECTING');
            console.log('1 = OPEN');
            console.log('2 = CLOSING');
            console.log('3 = CLOSED');
            return;
        }
        
        const moveData = {
            type: 'move',
            roomId: this.roomId,
            playerName: this.playerName,
            fromRow: fromRow,
            fromCol: fromCol,
            toRow: toRow,
            toCol: toCol,
            piece: piece,
            capturedPiece: capturedPiece,
            specialType: specialType
        };
        
        console.log('✅ 서버로 이동 전송:', moveData);
        console.log('JSON 문자열:', JSON.stringify(moveData));
        
        try {
            this.ws.send(JSON.stringify(moveData));
            console.log('✅ 메시지 전송 성공');
        } catch (error) {
            console.error('❌ 메시지 전송 실패:', error);
        }
    }

    findAvailableRoom(playerName) {
        // 사용 가능한 방 찾기
        const availableRooms = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chess_game_')) {
                const gameData = JSON.parse(localStorage.getItem(key));
                if (gameData.status === 'waiting' && gameData.players.length < 2) {
                    availableRooms.push({
                        roomId: gameData.roomId,
                        players: gameData.players
                    });
                }
            }
        }
        
        if (availableRooms.length > 0) {
            const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
            console.log('랜덤 매칭으로 방에 참여합니다:', randomRoom.roomId);
            this.connectToGitHubRoom(randomRoom.roomId, playerName);
        } else {
            // 사용 가능한 방이 없으면 새 방 생성
            const newRoomId = `room_${Date.now()}`;
            console.log('사용 가능한 방이 없어 새 방을 생성합니다.');
            this.connectToGitHubRoom(newRoomId, playerName);
        }
    }

    handleGitHubMessage(data) {
        switch (data.type) {
            case 'playerJoined':
                this.setPlayerColor(data.color);
                alert(`${data.playerName}님이 게임에 참가했습니다!`);
                break;
            case 'gameStart':
                this.setGameMode('online-player');
                this.loadGameState(data.gameState);
                alert(`게임이 시작되었습니다! 당신은 ${data.playerColor === 'white' ? '흰색' : '검은색'} 플레이어입니다.`);
                break;
            case 'moveUpdate':
                this.loadGameState(data.gameState);
                // UI 갱신은 loadGameState에서 처리
                break;
            case 'playerDisconnected':
                alert(data.message);
                break;
            case 'error':
                alert('오류: ' + data.message);
                break;
        }
    }

    updateConnectionStatus(status, connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = connected ? 'connection-status connected' : 'connection-status disconnected';
        }
    }

    // 퍼즐 메서드들
    startPuzzle(type) {
        console.log('퍼즐 시작:', type);
        this.currentPuzzleType = type;
        this.setGameMode('puzzle');
        this.loadPuzzle();
        // 퍼즐 모드에서 플레이어는 항상 백(white)으로 설정, AI는 흑(black)
        this.playerColor = 'white';
            this.currentPlayer = 'white';
        console.log('퍼즐 모드 설정 완료 - 플레이어: 백, AI: 흑');
    }

    loadPuzzle() {
        // 퍼즐 데이터 - 실제 체스 상황들
        const puzzles = {
            checkmate: [
                {
                    name: "체크메이트 퍼즐 #1 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '♟', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '♙', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 5], [5, 5]],
                    hint: "퀸으로 체크메이트를 만드세요",
                    type: "checkmate",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "체크메이트 퍼즐 #2 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '♟', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '♙', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[7, 3], [3, 7]],
                    hint: "룩으로 체크메이트를 만드세요",
                    type: "checkmate",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "체크메이트 퍼즐 #3 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 4], [4, 4]],
                    hint: "중앙을 장악하세요",
                    type: "checkmate",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                }
            ],
            tactics: [
                {
                    name: "포크 #1 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 4], [4, 4]],
                    hint: "중앙을 장악하세요",
                    type: "fork",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "포크 #2 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 3], [4, 3]],
                    hint: "퀸을 활용하세요",
                    type: "fork",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "핀 #1 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 5], [4, 5]],
                    hint: "비숍을 활용하세요",
                    type: "pin",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "스큐어 #1 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 6], [4, 6]],
                    hint: "나이트를 활용하세요",
                    type: "skewer",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "발견 공격 #1 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 1], [4, 1]],
                    hint: "나이트를 활용하세요",
                    type: "discovered",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "포크 #3 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 2], [4, 2]],
                    hint: "비숍을 활용하세요",
                    type: "fork",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "핀 #2 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 0], [4, 0]],
                    hint: "룩을 활용하세요",
                    type: "pin",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "스큐어 #2 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
                        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
                        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
                    ],
                    solution: [[6, 7], [4, 7]],
                    hint: "나이트를 활용하세요",
                    type: "skewer",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "발견 공격 #2 - 백의 차례",
                    board: [
                        ['♜', '', '', '', '♚', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♔', '', '', '', '', '', '', '']
                    ],
                    solution: [[7, 0], [0, 4]],
                    hint: "말을 움직여서 다른 말의 공격선을 열어보세요",
                    type: "discovered",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "포크 #4 - 백의 차례",
                    board: [
                        ['♜', '♞', '♝', '♛', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[7, 0], [0, 7]],
                    hint: "포크를 만들어서 두 개의 말을 동시에 공격하세요",
                    type: "fork",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                },
                {
                    name: "핀 #3 - 백의 차례",
                    board: [
                        ['♜', '', '', '♛', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[7, 0], [0, 7]],
                    hint: "핀을 만들어서 상대방 말을 고정시키세요",
                    type: "pin",
                    aiStrategy: "tactical",
                    playerColor: 'white'
                }
            ],
            endgame: [
                {
                    name: "킹과 폰 엔드게임 #1 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♙'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [7, 7]],
                    hint: "폰을 승급시켜서 승리하세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 폰 엔드게임 #2 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♙'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [7, 7]],
                    hint: "폰을 승급시켜서 승리하세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 룩 엔드게임 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♖'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "룩을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 퀸 엔드게임 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♕'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "퀸을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 비숍 엔드게임 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♗'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "비숍을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 나이트 엔드게임 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♘'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "나이트를 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 폰 엔드게임 #3 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♙'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [7, 7]],
                    hint: "폰을 승급시켜서 승리하세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 룩 엔드게임 #2 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♖'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "룩을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 퀸 엔드게임 #2 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♕'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "퀸을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 비숍 엔드게임 #2 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♗'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "비숍을 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                },
                {
                    name: "킹과 나이트 엔드게임 #2 - 백의 차례",
                    board: [
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', ''],
                        ['', '', '', '', '', '', '', '♘'],
                        ['♔', '', '', '', '', '', '', '♚']
                    ],
                    solution: [[6, 7], [0, 7]],
                    hint: "나이트를 활용해서 체크메이트를 만드세요",
                    type: "endgame",
                    aiStrategy: "endgame",
                    playerColor: 'white'
                }
            ]
        };

        // 현재 퍼즐 타입에 따라 퍼즐 선택
        const puzzleType = this.currentPuzzleType || 'checkmate';
        const puzzleList = puzzles[puzzleType];
        
        if (puzzleList && puzzleList.length > 0) {
            // 랜덤하게 퍼즐 선택
            const randomIndex = Math.floor(Math.random() * puzzleList.length);
            this.currentPuzzle = puzzleList[randomIndex];
            
            this.board = JSON.parse(JSON.stringify(this.currentPuzzle.board));
            this.currentPlayer = 'white';
            this.puzzleMode = true;
            this.puzzleSolved = false;
            this.puzzleAITurn = false; // AI 턴 플래그
            
            console.log('퍼즐 로드됨:', this.currentPuzzle.name);
            console.log('현재 보드:', this.board);
            
            // 퍼즐 정보 표시
            this.showPuzzleInfo();
        } else {
            // 기본 퍼즐
            this.board = [
                ['♜', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['♔', '', '', '', '', '', '', '♚']
            ];
            this.currentPlayer = 'white';
            this.puzzleMode = true;
            this.puzzleSolved = false;
            this.puzzleAITurn = false;
            
            console.log('기본 퍼즐 로드됨');
        }
        
        this.renderBoard();
        this.updateGameStatus();
    }

    showPuzzleInfo() {
        if (!this.currentPuzzle) return;
        
        const puzzleInfoMain = document.getElementById('puzzle-info-main');
        if (puzzleInfoMain) {
            const strategyText = {
                'defensive': '방어적 AI',
                'tactical': '전술적 AI', 
                'endgame': '엔드게임 AI'
            };
            
            puzzleInfoMain.innerHTML = `
                <div class="puzzle-header">
                    <h3>${this.currentPuzzle.name}</h3>
                    <p><strong>AI 전략:</strong> ${strategyText[this.currentPuzzle.aiStrategy] || '일반 AI'}</p>
                </div>
                <div class="puzzle-description">
                    <p>${this.currentPuzzle.hint}</p>
                    <p><em>AI와 대전하여 퍼즐을 해결하세요!</em></p>
                </div>
                <div class="puzzle-controls">
                    <button class="btn" onclick="chessGame.showHint()">힌트</button>
                    <button class="btn" onclick="chessGame.showSolution()">해답</button>
                    <button class="btn" onclick="chessGame.getAIHelp()">AI 도움</button>
                    <button class="btn" onclick="chessGame.nextPuzzle()">다음 퍼즐</button>
                </div>
            `;
            puzzleInfoMain.style.display = 'block';
        }
    }

    showHint() {
        if (!this.currentPuzzle) return;
        
        const hint = this.currentPuzzle.hint;
        this.showNotification(`힌트: ${hint}`);
    }

    showSolution() {
        if (!this.currentPuzzle) return;
        
        const solution = this.currentPuzzle.solution;
        if (solution && solution.length >= 2) {
            const [fromRow, fromCol] = solution[0];
            const [toRow, toCol] = solution[1];
            
            // 해답 실행
            this.makeMove(fromRow, fromCol, toRow, toCol);
            this.showNotification('해답을 실행했습니다!');
        }
    }

    getAIHelp() {
        if (!this.currentPuzzle) return;
        
        // AI가 현재 상황을 분석하고 최선의 수를 제안
        const validMoves = this.getAllValidMoves('white');
        if (validMoves.length > 0) {
            const bestMove = this.findBestMove(validMoves);
            if (bestMove) {
                const [fromRow, fromCol, toRow, toCol] = bestMove;
                const fromNotation = this.getSquareNotation([fromRow, fromCol]);
                const toNotation = this.getSquareNotation([toRow, toCol]);
                
                this.showNotification(`AI 제안: ${fromNotation} → ${toNotation}`);
                
                // AI 수를 하이라이트
                this.highlightAIMove(fromRow, fromCol, toRow, toCol);
            }
        }
    }

    highlightAIMove(fromRow, fromCol, toRow, toCol) {
        // 기존 하이라이트 제거
        this.clearHighlights();
        
        // AI 수 하이라이트
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        
        if (fromSquare) fromSquare.classList.add('ai-suggested');
        if (toSquare) toSquare.classList.add('ai-target');
    }

    nextPuzzle() {
        this.loadPuzzle();
    }

    checkPuzzleSolution() {
        if (!this.currentPuzzle || !this.puzzleMode) return;
        
        const puzzleType = this.currentPuzzle.type;
        let isSolved = false;
        
        // 퍼즐 타입별 종료 조건 확인
        switch (puzzleType) {
            case 'checkmate':
                // 체크메이트 퍼즐: 상대방이 체크메이트되었는지 확인
                isSolved = this.isCheckmate('black');
                if (isSolved) {
                    this.puzzleSolved = true;
                    this.showNotification('체크메이트! 퍼즐을 해결했습니다! 🎉');
                }
                break;
                
            case 'fork':
                // 포크 퍼즐: 두 개 이상의 말을 동시에 공격하는지 확인
                if (this.moveHistory.length > 0) {
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    const attackedPieces = this.getAttackedPiecesAfterMove(lastMove);
                    isSolved = attackedPieces.length >= 2;
                    if (isSolved) {
                        this.puzzleSolved = true;
                        this.showNotification('포크! 퍼즐을 해결했습니다! 🎉');
                    }
                }
                break;
                
            case 'pin':
                // 핀 퍼즐: 상대방 말이 핀되었는지 확인
                if (this.moveHistory.length > 0) {
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    isSolved = this.wouldCreatePin(lastMove, 'white');
                    if (isSolved) {
                        this.puzzleSolved = true;
                        this.showNotification('핀! 퍼즐을 해결했습니다! 🎉');
                    }
                }
                break;
                
            case 'skewer':
                // 스큐어 퍼즐: 스큐어가 발생했는지 확인
                if (this.moveHistory.length > 0) {
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    isSolved = this.wouldCreateSkewer(lastMove);
                    if (isSolved) {
                        this.puzzleSolved = true;
                        this.showNotification('스큐어! 퍼즐을 해결했습니다! 🎉');
                    }
                }
                break;
                
            case 'discovered':
                // 발견 공격 퍼즐: 발견 공격이 발생했는지 확인
                if (this.moveHistory.length > 0) {
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    isSolved = this.wouldCreateDiscoveredAttack(lastMove);
                    if (isSolved) {
                        this.puzzleSolved = true;
                        this.showNotification('발견 공격! 퍼즐을 해결했습니다! 🎉');
                    }
                }
                break;
                
            case 'endgame':
                // 엔드게임 퍼즐: 특정 조건 달성 (예: 폰 승진, 킹 중앙 장악 등)
                if (this.moveHistory.length > 0) {
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    const targetSquare = { row: lastMove.toRow, col: lastMove.toCol };
                    
                    // 중앙 장악 또는 폰 승진 확인
                    const centerDistance = Math.abs(targetSquare.row - 3.5) + Math.abs(targetSquare.col - 3.5);
                    const isPawnPromotion = this.isPawnPromotion(lastMove.toRow, lastMove.toCol, this.board[lastMove.toRow][lastMove.toCol]);
                    
                    isSolved = centerDistance < 2 || isPawnPromotion;
                    if (isSolved) {
                        this.puzzleSolved = true;
                        this.showNotification('엔드게임 목표 달성! 퍼즐을 해결했습니다! 🎉');
                    }
                }
                break;
                
            default:
                // 기본: 정확한 수 확인
                const solution = this.currentPuzzle.solution;
                if (solution && solution.length >= 2) {
                    const [expectedFromRow, expectedFromCol] = solution[0];
                    const [expectedToRow, expectedToCol] = solution[1];
                    
                    if (this.moveHistory.length > 0) {
                        const lastMove = this.moveHistory[this.moveHistory.length - 1];
                        if (lastMove.fromRow === expectedFromRow && 
                            lastMove.fromCol === expectedFromCol &&
                            lastMove.toRow === expectedToRow && 
                            lastMove.toCol === expectedToCol) {
                            
                            isSolved = true;
                            this.puzzleSolved = true;
                            this.showNotification('퍼즐을 해결했습니다! 🎉');
                        }
                    }
                }
                break;
        }
        
        // 퍼즐이 해결되면 3초 후 다음 퍼즐
        if (isSolved) {
            setTimeout(() => {
                this.nextPuzzle();
            }, 3000);
        }
    }

    makePuzzleAIMove() {
        if (!this.puzzleMode || !this.currentPuzzle) return;
        
        console.log('AI가 수를 계산 중...');
        
        // AI는 항상 black 플레이어의 수를 둠
        const validMoves = this.getAllValidMoves('black');
        console.log('AI 유효한 수들:', validMoves);
        
        if (validMoves.length === 0) {
            console.log('AI가 움직일 수 있는 말이 없습니다');
            this.puzzleAITurn = false;
            return;
        }
        
        const strategy = this.currentPuzzle.aiStrategy;
        let aiMove = null;
        
        switch (strategy) {
            case 'defensive':
                aiMove = this.findDefensiveMove();
                break;
            case 'tactical':
                aiMove = this.findTacticalMove();
                break;
            case 'endgame':
                aiMove = this.findEndgameMove();
                break;
            default:
                // 기본적으로 첫 번째 유효한 수를 선택
                aiMove = validMoves[0];
        }
        
        if (aiMove) {
            const fromRow = aiMove.from.row;
            const fromCol = aiMove.from.col;
            const toRow = aiMove.to.row;
            const toCol = aiMove.to.col;
            console.log(`AI 수: ${fromRow},${fromCol} → ${toRow},${toCol}`);
            setTimeout(() => {
                this.makeMove(fromRow, fromCol, toRow, toCol);
                this.puzzleAITurn = false;
                console.log('AI 수 완료');
            }, 1000);
        } else {
            console.log('AI가 유효한 수를 찾지 못했습니다');
            this.puzzleAITurn = false;
        }
    }

    findDefensiveMove() {
        // 방어적 AI - 체크메이트를 피하려고 함
        const validMoves = this.getAllValidMoves('black');
        if (validMoves.length === 0) return null;
        
        console.log('방어적 AI - 유효한 수들:', validMoves);
        
        // 체크를 피하는 수를 우선적으로 선택
        const safeMoves = validMoves.filter(move => {
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            tempBoard[move.to.row][move.to.col] = tempBoard[move.from.row][move.from.col];
            tempBoard[move.from.row][move.from.col] = '';
            
            // 이 수를 두면 체크가 되는지 확인
            return !this.isKingInCheck('black', tempBoard);
        });
        
        console.log('안전한 수들:', safeMoves);
        
        if (safeMoves.length > 0) {
            // 안전한 수 중에서도 좋은 수를 선택
            const goodMoves = safeMoves.filter(move => {
                const piece = this.board[move.from.row][move.from.col];
                const capturedPiece = this.board[move.to.row][move.to.col];
                
                // 캡처 기회가 있으면 우선 선택
                if (capturedPiece && this.getPieceValue(capturedPiece) > this.getPieceValue(piece)) {
                    return true;
                }
                
                // 중앙 제어를 위한 이동
                const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
                return centerDistance < 4;
            });
            
            if (goodMoves.length > 0) {
                console.log('좋은 수 선택:', goodMoves[0]);
                return goodMoves[0];
            }
            console.log('안전한 수 선택:', safeMoves[0]);
            return safeMoves[0];
        }
        
        console.log('랜덤 수 선택:', validMoves[0]);
        return validMoves[0];
    }

    findTacticalMove() {
        // 전술적 AI - 포크, 핀 등을 활용
        const validMoves = this.getAllValidMoves('black');
        if (validMoves.length === 0) return null;
        
        console.log('전술적 AI - 유효한 수들:', validMoves);
        
        // 캡처 기회가 있는 좋은 수
        const captureMoves = validMoves.filter(move => {
            const capturedPiece = this.board[move.to.row][move.to.col];
            return capturedPiece && this.getPieceValue(capturedPiece) > 0;
        });
        
        if (captureMoves.length > 0) {
            // 가장 가치 있는 캡처를 선택
            const bestCapture = captureMoves.reduce((best, move) => {
                const capturedPiece = this.board[move.to.row][move.to.col];
                const currentValue = this.getPieceValue(capturedPiece);
                const bestValue = best ? this.getPieceValue(this.board[best.to.row][best.to.col]) : 0;
                return currentValue > bestValue ? move : best;
            }, null);
            
            if (bestCapture) {
                console.log('최고 가치 캡처 선택:', bestCapture);
                return bestCapture;
            }
        }
        
        // 포크 기회 찾기
        const forkMoves = validMoves.filter(move => this.isForkMove(move));
        if (forkMoves.length > 0) {
            console.log('포크 기회 선택:', forkMoves[0]);
            return forkMoves[0];
        }
        
        // 핀 기회 찾기
        const pinMoves = validMoves.filter(move => this.isPinMove(move));
        if (pinMoves.length > 0) {
            console.log('핀 기회 선택:', pinMoves[0]);
            return pinMoves[0];
        }
        
        // 스큐어 기회 찾기
        const skewerMoves = validMoves.filter(move => this.isSkewerMove(move));
        if (skewerMoves.length > 0) {
            console.log('스큐어 기회 선택:', skewerMoves[0]);
            return skewerMoves[0];
        }
        
        // 발견 공격 기회 찾기
        const discoveredMoves = validMoves.filter(move => this.isDiscoveredAttackMove(move));
        if (discoveredMoves.length > 0) {
            console.log('발견 공격 기회 선택:', discoveredMoves[0]);
            return discoveredMoves[0];
        }
        
        // 일반적인 좋은 수
        console.log('일반적인 수 선택:', validMoves[0]);
        return validMoves[0];
    }

    findEndgameMove() {
        // 엔드게임 AI - 킹과 폰 엔드게임에 특화
        const validMoves = this.getAllValidMoves('black');
        if (validMoves.length === 0) return null;
        
        console.log('엔드게임 AI - 유효한 수들:', validMoves);
        
        // 킹을 중앙으로 이동
        const kingMoves = validMoves.filter(move => {
            const piece = this.board[move.from.row][move.from.col];
            return piece === '♚';
        });
        
        if (kingMoves.length > 0) {
            // 중앙에 가까운 킹 이동을 선택
            const centerMoves = kingMoves.filter(move => {
                const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
                return centerDistance < 4;
            });
            
            if (centerMoves.length > 0) {
                console.log('중앙 킹 이동 선택:', centerMoves[0]);
                return centerMoves[0];
            }
            console.log('킹 이동 선택:', kingMoves[0]);
            return kingMoves[0];
        }
        
        console.log('일반적인 엔드게임 수 선택:', validMoves[0]);
        return validMoves[0];
    }

    // 설정 메서드들
    openSettings() {
        document.getElementById('settings-panel').classList.add('active');
    }

    closeSettings() {
        document.getElementById('settings-panel').classList.remove('active');
    }

    switchSettingsTab(tabName) {
        // 모든 탭 비활성화
        document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(section => section.classList.remove('active'));
        
        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}-settings`)?.classList.add('active');
    }

    setupSettingsListeners() {
        // 언어 변경
        document.getElementById('language-select')?.addEventListener('change', (e) => {
            this.applyLanguage(e.target.value);
        });

        // 사운드 토글
        document.getElementById('sound-toggle')?.addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
        });

        // 자동 저장 토글
        document.getElementById('auto-save-toggle')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.saveGameState();
            }
        });

        // 테마 변경
        document.getElementById('theme-select')?.addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
        });

        // 애니메이션 토글
        document.getElementById('animation-toggle')?.addEventListener('change', (e) => {
            this.applyAnimation(e.target.checked);
        });

        // 보드 크기 변경
        document.getElementById('board-size')?.addEventListener('change', (e) => {
            this.applyBoardSize(e.target.value);
        });
    }

    applyLanguage(language) {
        // 언어 변경 로직
        console.log('언어 변경:', language);
    }

    applyTheme(theme) {
        document.body.className = `theme-${theme}`;
    }

    applyAnimation(enabled) {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            square.style.transition = enabled ? 'all 0.2s ease' : 'none';
        });
    }

    applyBoardSize(size) {
        const chessboard = document.getElementById('chessboard');
        const squares = document.querySelectorAll('.square');
        const coordinates = document.querySelectorAll('.coordinates span');
        
        const sizes = {
            small: { board: 30, font: 18 },
            normal: { board: 40, font: 24 },
            large: { board: 50, font: 30 }
        };
        
        const sizeConfig = sizes[size] || sizes.normal;
        
        chessboard.style.gridTemplateColumns = `repeat(8, ${sizeConfig.board}px)`;
        chessboard.style.gridTemplateRows = `repeat(8, ${sizeConfig.board}px)`;
        
        squares.forEach(square => {
            square.style.width = `${sizeConfig.board}px`;
            square.style.height = `${sizeConfig.board}px`;
            square.style.fontSize = `${sizeConfig.font}px`;
        });
        
        coordinates.forEach(coord => {
            coord.style.width = `${sizeConfig.board}px`;
            coord.style.height = `${sizeConfig.board}px`;
        });
    }

    saveGameState() {
        const gameState = {
            board: this.board,
            currentPlayer: this.currentPlayer,
            moveHistory: this.moveHistory,
            timestamp: Date.now()
        };
        localStorage.setItem('chess_game_state', JSON.stringify(gameState));
    }

    loadGameState() {
        const savedState = localStorage.getItem('chess_game_state');
        if (savedState) {
            const gameState = JSON.parse(savedState);
            this.loadGameState(gameState);
        }
    }

    // 시간 제어 메서드
    setTimeControl(mode) {
        console.log('시간 제어 설정:', mode);
        this.timeControl = mode;
        
        // 기존 타이머 정지
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // 시간 초기화
        switch (mode) {
            case 'blitz':
                this.whiteTime = 5 * 60; // 5분
                this.blackTime = 5 * 60;
                break;
            case 'rapid':
                this.whiteTime = 10 * 60; // 10분
                this.blackTime = 10 * 60;
                break;
            case 'classical':
                this.whiteTime = 15 * 60; // 15분
                this.blackTime = 15 * 60;
                break;
            case 'no-limit':
                this.whiteTime = 0;
                this.blackTime = 0;
                break;
        }
        
        this.updateTimer();
        
        // 게임 시작 시 타이머 시작
        if (mode !== 'no-limit') {
            this.startTimer();
        }
    }

    startTimer() {
        this.gameStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        const timerElement = document.getElementById('timer');
        if (!timerElement) return;
        
        if (this.timeControl === 'no-limit') {
            timerElement.textContent = '무제한';
            return;
        }
        
        const currentTime = this.currentPlayer === 'white' ? this.whiteTime : this.blackTime;
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePlayerTime() {
        if (this.timeControl === 'no-limit' || !this.gameStartTime) return;
        
        const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
        
        if (this.currentPlayer === 'white') {
            this.whiteTime = Math.max(0, this.whiteTime - elapsed);
        } else {
            this.blackTime = Math.max(0, this.blackTime - elapsed);
        }
        
        this.gameStartTime = Date.now();
        
        // 시간 초과 체크
        if (this.whiteTime <= 0 || this.blackTime <= 0) {
            this.endGame('timeout', this.whiteTime <= 0 ? 'black' : 'white');
        }
    }

    // 전술 분석 메서드들
    analyzeTactic(tacticType) {
        console.log(`${tacticType} 전술 분석 시작`);
        
        const currentColor = this.currentPlayer;
        const validMoves = this.getAllValidMoves(currentColor);
        let tacticMove = null;
        
        switch (tacticType) {
            case 'fork':
                tacticMove = this.findFork(validMoves);
                break;
            case 'pin':
                tacticMove = this.findPin(validMoves);
                break;
            case 'skewer':
                tacticMove = this.findSkewer(validMoves);
                break;
            case 'discovered':
                tacticMove = this.findDiscoveredAttack(validMoves);
                break;
            case 'desperado':
                tacticMove = this.findDesperado(validMoves);
                break;
            case 'overloading':
                tacticMove = this.findOverloading(validMoves);
                break;
            case 'xray':
                tacticMove = this.findXrayAttack(validMoves);
                break;
            case 'interference':
                tacticMove = this.findInterference(validMoves);
                break;
            case 'zugzwang':
                tacticMove = this.findZugzwang(validMoves);
                break;
            case 'intermezzo':
                tacticMove = this.findIntermezzo(validMoves);
                break;
            case 'opposition':
                tacticMove = this.findOpposition(validMoves);
                break;
            case 'clearance':
                tacticMove = this.findClearanceSacrifice(validMoves);
                break;
            case 'trapping':
                tacticMove = this.findTrapping(validMoves);
                break;
            case 'swindle':
                tacticMove = this.findSwindle(validMoves);
                break;
        }
        
        if (tacticMove) {
            this.highlightTacticMove(tacticMove, tacticType);
            this.showTacticInfo(tacticType, tacticMove);
        } else {
            this.showNoTacticFound(tacticType);
        }
    }

    highlightTacticMove(move, tacticType) {
        // 기존 하이라이트 제거
        this.clearHighlights();
        
        // 전술 이동 하이라이트
        const fromSquare = document.querySelector(`[data-row="${move.from.row}"][data-col="${move.from.col}"]`);
        const toSquare = document.querySelector(`[data-row="${move.to.row}"][data-col="${move.to.col}"]`);
        
        if (fromSquare) fromSquare.classList.add('tactic-from');
        if (toSquare) toSquare.classList.add('tactic-to');
        
        // 3초 후 하이라이트 제거
        setTimeout(() => {
            this.clearHighlights();
        }, 3000);
    }

    showTacticInfo(tacticType, move) {
        const tacticNames = {
            'fork': '포크',
            'pin': '핀',
            'skewer': '스큐어',
            'discovered': '발견 공격',
            'desperado': '데스페라도',
            'overloading': '과부하',
            'xray': 'X레이 공격',
            'interference': '간섭',
            'zugzwang': '추크츠방',
            'intermezzo': '사잇수',
            'opposition': '오포지션',
            'clearance': '정리 희생',
            'trapping': '트래핑',
            'swindle': '속임수'
        };
        
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            statusElement.textContent = `${tacticNames[tacticType]} 발견! ${this.getSquareNotation(move.from)} → ${this.getSquareNotation(move.to)}`;
        }
        
        // 알림 표시
        this.showNotification(`${tacticNames[tacticType]} 전술이 발견되었습니다!`);
    }

    showNoTacticFound(tacticType) {
        const tacticNames = {
            'fork': '포크',
            'pin': '핀',
            'skewer': '스큐어',
            'discovered': '발견 공격',
            'desperado': '데스페라도',
            'overloading': '과부하',
            'xray': 'X레이 공격',
            'interference': '간섭',
            'zugzwang': '추크츠방',
            'intermezzo': '사잇수',
            'opposition': '오포지션',
            'clearance': '정리 희생',
            'trapping': '트래핑',
            'swindle': '속임수'
        };
        
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            statusElement.textContent = `${tacticNames[tacticType]} 전술이 현재 위치에서 발견되지 않았습니다.`;
        }
        
        this.showNotification(`${tacticNames[tacticType]} 전술이 현재 위치에서 발견되지 않았습니다.`);
    }

    analyzeCurrentPosition() {
        console.log('현재 위치 전술 분석');
        
        const currentColor = this.currentPlayer;
        const validMoves = this.getAllValidMoves(currentColor);
        
        const tactics = [
            { type: 'fork', name: '포크', move: this.findFork(validMoves) },
            { type: 'pin', name: '핀', move: this.findPin(validMoves) },
            { type: 'skewer', name: '스큐어', move: this.findSkewer(validMoves) },
            { type: 'discovered', name: '발견 공격', move: this.findDiscoveredAttack(validMoves) },
            { type: 'desperado', name: '데스페라도', move: this.findDesperado(validMoves) },
            { type: 'overloading', name: '과부하', move: this.findOverloading(validMoves) },
            { type: 'xray', name: 'X레이 공격', move: this.findXrayAttack(validMoves) },
            { type: 'interference', name: '간섭', move: this.findInterference(validMoves) },
            { type: 'zugzwang', name: '추크츠방', move: this.findZugzwang(validMoves) },
            { type: 'intermezzo', name: '사잇수', move: this.findIntermezzo(validMoves) },
            { type: 'opposition', name: '오포지션', move: this.findOpposition(validMoves) },
            { type: 'clearance', name: '정리 희생', move: this.findClearanceSacrifice(validMoves) },
            { type: 'trapping', name: '트래핑', move: this.findTrapping(validMoves) },
            { type: 'swindle', name: '속임수', move: this.findSwindle(validMoves) }
        ];
        
        const availableTactics = tactics.filter(tactic => tactic.move !== null);
        
        if (availableTactics.length > 0) {
            this.showTacticsAnalysis(availableTactics);
        } else {
            this.showNotification('현재 위치에서 특별한 전술이 발견되지 않았습니다.');
        }
    }

    showTacticsAnalysis(tactics) {
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            const tacticList = tactics.map(t => t.name).join(', ');
            statusElement.textContent = `발견된 전술: ${tacticList}`;
        }
        
        // 첫 번째 전술 하이라이트
        if (tactics.length > 0) {
            this.highlightTacticMove(tactics[0].move, tactics[0].type);
        }
        
        this.showNotification(`${tactics.length}개의 전술이 발견되었습니다: ${tactics.map(t => t.name).join(', ')}`);
    }

    showAvailableTactics() {
        const currentColor = this.currentPlayer;
        const validMoves = this.getAllValidMoves(currentColor);
        
        // 모든 전술 찾기
        const allTactics = [];
        
        for (const move of validMoves) {
            const tactics = this.findTacticsForMove(move);
            if (tactics.length > 0) {
                allTactics.push({ move, tactics });
            }
        }
        
        if (allTactics.length > 0) {
            this.displayTacticsList(allTactics);
        } else {
            this.showNotification('사용 가능한 전술이 없습니다.');
        }
    }

    findTacticsForMove(move) {
        const tactics = [];
        
        if (this.isForkMove(move)) tactics.push('포크');
        if (this.isPinMove(move)) tactics.push('핀');
        if (this.isSkewerMove(move)) tactics.push('스큐어');
        if (this.isDiscoveredAttackMove(move)) tactics.push('발견 공격');
        if (this.isDesperadoMove(move)) tactics.push('데스페라도');
        if (this.isOverloadingMove(move)) tactics.push('과부하');
        if (this.isXrayAttackMove(move)) tactics.push('X레이 공격');
        if (this.isInterferenceMove(move)) tactics.push('간섭');
        if (this.isZugzwangMove(move)) tactics.push('추크츠방');
        if (this.isIntermezzoMove(move)) tactics.push('사잇수');
        if (this.isOppositionMove(move)) tactics.push('오포지션');
        if (this.isClearanceSacrificeMove(move)) tactics.push('정리 희생');
        if (this.isTrappingMove(move)) tactics.push('트래핑');
        if (this.isSwindleMove(move)) tactics.push('속임수');
        
        return tactics;
    }

    isForkMove(move) {
        const attackedPieces = this.getAttackedPiecesAfterMove(move);
        return attackedPieces.length >= 2;
    }

    isPinMove(move) {
        return this.wouldCreatePin(move, this.getPieceColor(this.board[move.from.row][move.from.col]));
    }

    isSkewerMove(move) {
        return this.wouldCreateSkewer(move);
    }

    isDiscoveredAttackMove(move) {
        return this.wouldCreateDiscoveredAttack(move);
    }

    isDesperadoMove(move) {
        const piece = this.board[move.from.row][move.from.col];
        const pieceValue = this.getPieceValue(piece);
        
        // 낮은 가치의 말로 높은 가치의 말을 공격하는 경우
        const targetPiece = this.board[move.to.row][move.to.col];
        if (targetPiece) {
            const targetValue = this.getPieceValue(targetPiece);
            return pieceValue < targetValue;
        }
        
        return false;
    }

    isOverloadingMove(move) {
        return this.wouldCreateOverload(move);
    }

    isXrayAttackMove(move) {
        return this.wouldCreateXrayAttack(move);
    }

    isInterferenceMove(move) {
        return this.wouldCreateInterference(move);
    }

    // 추크츠방 판별
    isZugzwangMove(move) {
        return this.wouldCreateZugzwang(move);
    }

    // 사잇수 판별
    isIntermezzoMove(move) {
        // 상대방이 예상하는 이동과 다른 이동을 하는 경우
        const piece = this.board[move.from.row][move.from.col];
        const pieceValue = this.getPieceValue(piece);
        
        // 상대방이 예상하는 고가치 말의 이동이 아닌 경우
        if (pieceValue < 3) {
            return true;
        }
        
        return false;
    }

    // 오포지션 판별
    isOppositionMove(move) {
        return this.wouldCreateOpposition(move);
    }

    // 정리 희생 판별
    isClearanceSacrificeMove(move) {
        const piece = this.board[move.from.row][move.from.col];
        const pieceValue = this.getPieceValue(piece);
        
        // 말을 희생하여 다른 말의 활동 공간을 확보하는 경우
        if (pieceValue > 0) {
            // 이동 후 다른 말의 활동성이 증가하는지 확인
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            tempBoard[move.to.row][move.to.col] = piece;
            tempBoard[move.from.row][move.from.col] = '';
            
            const currentColor = this.getPieceColor(piece);
            const otherPiecesActivity = this.evaluatePieceActivity(tempBoard);
            
            return otherPiecesActivity > 0;
        }
        
        return false;
    }

    // 트래핑 판별
    isTrappingMove(move) {
        // 상대방 말을 함정에 빠뜨리는 경우
        const targetPiece = this.board[move.to.row][move.to.col];
        if (targetPiece) {
            const targetColor = this.getPieceColor(targetPiece);
            const currentColor = this.getPieceColor(this.board[move.from.row][move.from.col]);
            
            if (targetColor !== currentColor) {
                // 이동 후 상대방 말이 탈출할 수 없는지 확인
                return this.wouldTrapPiece(move);
            }
        }
        
        return false;
    }

    // 속임수 판별
    isSwindleMove(move) {
        // 상대방을 속이는 전술적 기회
        const piece = this.board[move.from.row][move.from.col];
        const pieceValue = this.getPieceValue(piece);
        
        // 낮은 가치의 말로 상대방을 혼란시키는 경우
        if (pieceValue < 3) {
            const targetPiece = this.board[move.to.row][move.to.col];
            if (targetPiece) {
                const targetValue = this.getPieceValue(targetPiece);
                return targetValue > pieceValue;
            }
        }
        
        return false;
    }

    displayTacticsList(tacticsList) {
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            const tacticsText = tacticsList.map(item => 
                `${this.getSquareNotation(item.move.from)} → ${this.getSquareNotation(item.move.to)} (${item.tactics.join(', ')})`
            ).join('; ');
            statusElement.textContent = `사용 가능한 전술: ${tacticsText}`;
        }
    }

    startTacticPractice() {
        console.log('전술 연습 시작');
        
        // 전술 연습 모드 설정
        this.practiceMode = true;
        this.currentTactic = null;
        
        // 간단한 전술 연습 위치 설정
        this.setupTacticPractice();
        
        this.showNotification('전술 연습 모드가 시작되었습니다. 전술을 찾아보세요!');
    }

    setupTacticPractice() {
        // 포크 연습을 위한 간단한 위치 설정
        this.board = [
            ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
            ['♟', '♟', '♟', '♟', '', '♟', '♟', '♟'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '♟', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '♙', '', ''],
            ['♙', '♙', '♙', '♙', '♙', '', '♙', '♙'],
            ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
        ];
        
            this.currentPlayer = 'white';
        this.moveHistory = [];
        this.renderBoard();
        this.updateGameStatus();
        
        this.currentTactic = 'fork';
        this.showNotification('포크 전술을 찾아보세요! 기사가 두 개의 말을 동시에 공격할 수 있는 위치로 이동하세요.');
    }

    showNotification(message) {
        // 간단한 알림 표시
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        // 3초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // 캐시 정리 (메모리 누수 방지)
    clearCache() {
        const now = Date.now();
        if (now - this.lastCacheClear > 30000) { // 30초마다 정리
            this.moveCache.clear();
            this.evaluationCache.clear();
            this.validMovesCache.clear();
            this.lastCacheClear = now;
        }
    }

    // 캐시 키 생성
    getCacheKey(board, color) {
        return board.map(row => row.join('')).join('') + color;
    }

    // 성능 최적화된 렌더링
    renderBoard() {
        const now = Date.now();
        if (now - this.lastRenderTime < this.renderThrottle) {
            return; // 렌더링 스로틀링
        }
        this.lastRenderTime = now;

        const chessboard = document.getElementById('chessboard');
        if (!chessboard) return;

        let html = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                const isLight = (row + col) % 2 === 0;
                const squareClass = `square ${isLight ? 'white' : 'black'}`;
                const pieceClass = piece ? 'piece' : '';
                const selectedClass = this.selectedPiece && 
                    this.selectedPiece.row === row && 
                    this.selectedPiece.col === col ? 'selected' : '';
                
                html += `<div class="${squareClass} ${pieceClass} ${selectedClass}" data-row="${row}" data-col="${col}">${piece}</div>`;
            }
        }
        
        chessboard.innerHTML = html;
    }
}

// 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    const game = new ChessGame();
    window.game = game; // 전역 접근용
    window.chessGame = game; // HTML onclick 이벤트용
}); 
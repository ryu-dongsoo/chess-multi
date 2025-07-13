const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    let filePath = req.url;
    
    // 기본 페이지 설정
    if (filePath === '/' || filePath === '/index.html') {
        filePath = '/chess.html';
    }
    
    // 파일 확장자에 따른 MIME 타입 설정
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }
    
    // 파일 읽기
    const fullPath = path.join(__dirname, filePath);
    
    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일이 없으면 404
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - 파일을 찾을 수 없습니다</h1>');
            } else {
                // 서버 오류
                res.writeHead(500);
                res.end(`서버 오류: ${err.code}`);
            }
        } else {
            // 파일을 성공적으로 읽었으면 응답
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

// 게임 상태 저장
const rooms = new Map();
const players = new Map();

// 초기 체스 보드
const initialBoard = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
];

wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true);
    let roomId = parameters.query.roomId;
    const playerName = parameters.query.playerName || 'Player';
    
    console.log(`새로운 연결: ${playerName} in room ${roomId}`);
    
    // 매치메이킹 처리
    if (roomId === 'matchmaking') {
        // 대기 중인 매치메이킹 플레이어 찾기
        let foundMatch = false;
        for (const [existingRoomId, room] of rooms.entries()) {
            if (existingRoomId.startsWith('matchmaking_') && room.players.length === 1) {
                // 매치 발견! - 기존 방에 참여하므로 두 번째 플레이어
                roomId = existingRoomId;
                foundMatch = true;
                console.log(`매치 발견: ${playerName} -> ${roomId} (두 번째 플레이어)`);
                break;
            }
        }
        
        if (!foundMatch) {
            // 새로운 매치메이킹 방 생성 - 첫 번째 플레이어
            roomId = `matchmaking_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            console.log(`새 매치메이킹 방 생성: ${roomId} (첫 번째 플레이어)`);
        }
    }
    
    // 플레이어 정보 저장
    players.set(ws, {
        roomId: roomId,
        playerName: playerName,
        color: null
    });
    
    // 방이 없으면 생성
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            players: [],
            gameState: {
                board: JSON.parse(JSON.stringify(initialBoard)),
                currentPlayer: 'white',
                moveHistory: []
            }
        });
    }
    
    const room = rooms.get(roomId);
    room.players.push(ws);
    
    // 플레이어 색상 할당
    console.log(`방 ${roomId}에 플레이어 ${playerName} 연결됨. 현재 플레이어 수: ${room.players.length}`);
    
    if (room.players.length === 1) {
        // 첫 번째 플레이어 (방 생성자) - 흰색
        players.get(ws).color = 'white';
        console.log(`✅ 방 생성자 할당: ${players.get(ws).playerName} -> 흰색 (방 ID: ${roomId})`);
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: 'white',
            message: '흰색 플레이어로 할당되었습니다. 상대방을 기다리는 중...'
        }));
    } else if (room.players.length === 2) {
        // 두 번째 플레이어 (참여자) - 검은색
        players.get(ws).color = 'black';
        console.log(`✅ 참여자 할당: ${players.get(ws).playerName} -> 검은색 (방 ID: ${roomId})`);
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: 'black',
            message: '검은색 플레이어로 할당되었습니다. 게임을 시작합니다!'
        }));
        
        // 게임 시작 알림
        console.log(`🎮 게임 시작! 방 ID: ${roomId}`);
        room.players.forEach((player, index) => {
            const playerInfo = players.get(player);
            console.log(`  플레이어 ${index + 1}: ${playerInfo.playerName} -> ${playerInfo.color}`);
            player.send(JSON.stringify({
                type: 'gameStart',
                gameState: room.gameState,
                playerColor: playerInfo.color
            }));
        });
    } else {
        // 3명째 플레이어부터는 관전자로 처리
        console.log(`👁️ 관전자 입장: 방 ID: ${roomId}, 플레이어 수: ${room.players.length}`);
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: 'spectator',
            message: '관전자로 입장했습니다.'
        }));
    }
    
    // 메시지 처리
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const player = players.get(ws);
            const room = rooms.get(player.roomId);
            
            switch (data.type) {
                case 'move':
                    handleMove(ws, data, room);
                    break;
                case 'resign':
                    handleResign(ws, room);
                    break;
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
        }
    });
    
    // 연결 해제 처리
    ws.on('close', () => {
        const player = players.get(ws);
        if (player) {
            const room = rooms.get(player.roomId);
            if (room) {
                room.players = room.players.filter(p => p !== ws);
                
                // 상대방에게 알림
                room.players.forEach(p => {
                    p.send(JSON.stringify({
                        type: 'playerDisconnected',
                        message: '상대방이 연결을 끊었습니다.'
                    }));
                });
                
                // 방이 비면 삭제
                if (room.players.length === 0) {
                    rooms.delete(player.roomId);
                }
            }
            players.delete(ws);
        }
        console.log('연결 해제');
    });
});

// 이동 처리
function handleMove(ws, data, room) {
    const { fromRow, fromCol, toRow, toCol } = data;
    const player = players.get(ws);
    
    console.log(`이동 요청: ${player.playerName}(${player.color}) ${fromRow},${fromCol} -> ${toRow},${toCol}`);
    console.log('현재 턴:', room.gameState.currentPlayer);
    
    // 현재 플레이어 턴인지 확인
    if (room.gameState.currentPlayer !== player.color) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '당신의 턴이 아닙니다.'
        }));
        return;
    }
    
    // 이동 유효성 검사 (간단한 버전)
    if (isValidMove(room.gameState.board, fromRow, fromCol, toRow, toCol, player.color)) {
        // 이동 실행
        const piece = room.gameState.board[fromRow][fromCol];
        const capturedPiece = room.gameState.board[toRow][toCol];
        
        console.log(`이동 실행: ${piece} ${fromRow},${fromCol} -> ${toRow},${toCol}`);
        
        room.gameState.board[toRow][toCol] = piece;
        room.gameState.board[fromRow][fromCol] = '';
        
        // 플레이어 변경
        room.gameState.currentPlayer = room.gameState.currentPlayer === 'white' ? 'black' : 'white';
        
        // 이동 기록
        room.gameState.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: capturedPiece,
            player: player.color
        });
        
        console.log('이동 후 보드 상태:', room.gameState.board);
        console.log('새로운 턴:', room.gameState.currentPlayer);
        
        // 모든 플레이어에게 업데이트 전송
        room.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'moveUpdate',
                gameState: room.gameState,
                lastMove: { fromRow, fromCol, toRow, toCol }
            }));
        });
    } else {
        ws.send(JSON.stringify({
            type: 'error',
            message: '유효하지 않은 이동입니다.'
        }));
    }
}

// 항복 처리
function handleResign(ws, room) {
    const player = players.get(ws);
    const winner = player.color === 'white' ? 'black' : 'white';
    
    room.players.forEach(p => {
        p.send(JSON.stringify({
            type: 'gameEnd',
            message: `${player.playerName}이(가) 항복했습니다.`,
            winner: winner
        }));
    });
}

// 이동 유효성 검사 (실제 체스 규칙 구현)
function isValidMove(board, fromRow, fromCol, toRow, toCol, color) {
    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];
    
    // 말이 없는 경우
    if (!piece) return false;
    
    // 같은 색의 말을 잡을 수 없음
    if (targetPiece && isPieceOfColor(targetPiece, color)) {
        return false;
    }
    
    // 말의 색상 확인
    const isWhitePiece = isPieceOfColor(piece, 'white');
    const isBlackPiece = isPieceOfColor(piece, 'black');
    
    // 현재 플레이어의 말인지 확인
    if (color === 'white' && !isWhitePiece) return false;
    if (color === 'black' && !isBlackPiece) return false;
    
    // 각 말의 이동 규칙 확인
    switch (piece) {
        case '♙': // 흰색 폰
            return isValidPawnMove(board, fromRow, fromCol, toRow, toCol, 'white');
        case '♟': // 검은색 폰
            return isValidPawnMove(board, fromRow, fromCol, toRow, toCol, 'black');
        case '♖': // 흰색 룩
        case '♜': // 검은색 룩
            return isValidRookMove(board, fromRow, fromCol, toRow, toCol);
        case '♗': // 흰색 비숍
        case '♝': // 검은색 비숍
            return isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
        case '♕': // 흰색 퀸
        case '♛': // 검은색 퀸
            return isValidQueenMove(board, fromRow, fromCol, toRow, toCol);
        case '♔': // 흰색 킹
        case '♚': // 검은색 킹
            return isValidKingMove(board, fromRow, fromCol, toRow, toCol);
        case '♘': // 흰색 나이트
        case '♞': // 검은색 나이트
            return isValidKnightMove(board, fromRow, fromCol, toRow, toCol);
        default:
            return false;
    }
}

// 폰 이동 규칙
function isValidPawnMove(board, fromRow, fromCol, toRow, toCol, color) {
    const direction = color === 'white' ? -1 : 1; // 흰색은 위로, 검은색은 아래로
    const startRow = color === 'white' ? 6 : 1; // 시작 위치
    
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    const targetPiece = board[toRow][toCol];
    
    // 전진 (세로 이동)
    if (colDiff === 0) {
        // 한 칸 전진
        if (rowDiff === direction && !targetPiece) {
            return true;
        }
        // 두 칸 전진 (시작 위치에서만)
        if (fromRow === startRow && rowDiff === 2 * direction && !targetPiece && !board[fromRow + direction][fromCol]) {
            return true;
        }
    }
    // 대각선 이동 (말 잡기)
    else if (colDiff === 1 && rowDiff === direction && targetPiece) {
        return true;
    }
    
    return false;
}

// 룩 이동 규칙
function isValidRookMove(board, fromRow, fromCol, toRow, toCol) {
    // 룩은 가로나 세로로만 이동
    if (fromRow !== toRow && fromCol !== toCol) return false;
    
    // 경로에 다른 말이 있는지 확인
    if (fromRow === toRow) {
        // 가로 이동
        const start = Math.min(fromCol, toCol);
        const end = Math.max(fromCol, toCol);
        for (let col = start + 1; col < end; col++) {
            if (board[fromRow][col] !== '') return false;
        }
    } else {
        // 세로 이동
        const start = Math.min(fromRow, toRow);
        const end = Math.max(fromRow, toRow);
        for (let row = start + 1; row < end; row++) {
            if (board[row][fromCol] !== '') return false;
        }
    }
    
    return true;
}

// 비숍 이동 규칙
function isValidBishopMove(board, fromRow, fromCol, toRow, toCol) {
    // 비숍은 대각선으로만 이동
    if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) return false;
    
    // 경로에 다른 말이 있는지 확인
    const rowDir = fromRow < toRow ? 1 : -1;
    const colDir = fromCol < toCol ? 1 : -1;
    
    let row = fromRow + rowDir;
    let col = fromCol + colDir;
    
    while (row !== toRow && col !== toCol) {
        if (board[row][col] !== '') return false;
        row += rowDir;
        col += colDir;
    }
    
    return true;
}

// 퀸 이동 규칙 (룩 + 비숍)
function isValidQueenMove(board, fromRow, fromCol, toRow, toCol) {
    return isValidRookMove(board, fromRow, fromCol, toRow, toCol) ||
           isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
}

// 킹 이동 규칙
function isValidKingMove(board, fromRow, fromCol, toRow, toCol) {
    // 킹은 한 칸씩만 이동
    return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1;
}

// 나이트 이동 규칙
function isValidKnightMove(board, fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(fromRow - toRow);
    const colDiff = Math.abs(fromCol - toCol);
    
    // 나이트는 L자 모양으로 이동 (2칸 + 1칸)
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

// 말의 색상 확인
function isPieceOfColor(piece, color) {
    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
    
    if (color === 'white') {
        return whitePieces.includes(piece);
    } else {
        return blackPieces.includes(piece);
    }
}

const PORT = 3000;
const HOST = '0.0.0.0'; // 모든 IP에서 접속 허용

server.listen(PORT, HOST, () => {
    console.log(`체스! 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`로컬 접속: http://localhost:${PORT}/chess.html`);
    
    // 네트워크 정보 표시
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    console.log('\n📡 네트워크 접속 정보:');
    console.log('다른 기기에서 접속하려면 다음 주소 중 하나를 사용하세요:');
    
    Object.keys(networkInterfaces).forEach((interfaceName) => {
        const interfaces = networkInterfaces[interfaceName];
        interfaces.forEach((interface) => {
            // IPv4 주소만 표시 (로컬호스트 제외)
            if (interface.family === 'IPv4' && !interface.internal) {
                console.log(`  http://${interface.address}:${PORT}/chess.html`);
            }
        });
    });
    
    console.log('\n💡 팁:');
    console.log('- 같은 Wi-Fi 네트워크에 연결된 기기들이 서로 접속할 수 있습니다.');
    console.log('- 방화벽에서 포트 3000을 허용해야 할 수 있습니다.');
    console.log('- 공유기 설정에서 포트 포워딩이 필요할 수 있습니다.');
    console.log('\n🎮 체스! 게임을 즐겨보세요!');
}); 
const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 환경변수에서 포트 가져오기 (Render에서 자동 설정)
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 정적 파일 제공
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, '../frontend', filePath);
    
    // 파일 확장자에 따른 Content-Type 설정
    const ext = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon'
    }[ext] || 'text/plain';
    
    // API 엔드포인트 처리
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res);
        return;
    }
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일이 없으면 index.html 제공
                fs.readFile(path.join(__dirname, '../frontend/index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
    clientTracking: true
});

// 연결 상태 모니터링
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('비활성 연결 종료');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

// HTTP API 핸들러
function handleApiRequest(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url.startsWith('/api/connect')) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                handleHttpConnect(data, res);
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ type: 'error', message: 'API not found' }));
}

function handleHttpConnect(data, res) {
    const { roomId, playerName } = data;
    
    console.log('HTTP 연결 요청 수신:', data);
    console.log('방 ID:', roomId, '플레이어 이름:', playerName);
    
    // 방이 없으면 생성
    if (!rooms.has(roomId)) {
        console.log('새 방 생성:', roomId);
        rooms.set(roomId, {
            players: [],
            gameState: {
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
                currentPlayer: 'white',
                moveHistory: []
            }
        });
    }
    
    const room = rooms.get(roomId);
    
    // WebSocket 플레이어만 계산 (실제 게임 플레이어)
    const actualPlayers = room.players.filter(p => p.type === 'websocket');
    console.log('HTTP 연결 요청:', playerName, '실제 플레이어 수:', actualPlayers.length);
    
    // HTTP 응답만 처리 (실제 게임 플레이어 수에 따라)
    if (actualPlayers.length === 0) {
        // 아직 게임 플레이어가 없음
        console.log('아직 게임 플레이어 없음 - 대기 중');
        res.writeHead(200);
        res.end(JSON.stringify({
            type: 'playerAssigned',
            color: 'white',
            message: '흰색 플레이어로 할당되었습니다. 상대방을 기다리는 중...'
        }));
    } else if (actualPlayers.length === 1) {
        // 게임 플레이어 1명 있음
        console.log('게임 플레이어 1명 있음 - 게임 시작 가능');
        res.writeHead(200);
        res.end(JSON.stringify({
            type: 'gameStart',
            gameState: room.gameState,
            playerColor: 'black'
        }));
    } else {
        // 게임 플레이어 2명 이상 있음
        console.log('게임 플레이어 2명 이상 있음 - 관전자로 처리');
        res.writeHead(200);
        res.end(JSON.stringify({
            type: 'playerAssigned',
            color: 'spectator',
            message: '관전자로 입장했습니다.'
        }));
    }
}

// 게임 방 관리
const rooms = new Map();
const players = new Map();

// 연결 처리
wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true);
    let roomId = parameters.query.roomId;
    const playerName = parameters.query.playerName || 'Player';
    
    console.log(`새로운 연결: ${playerName} in room ${roomId}`);
    
    // 연결 상태 모니터링
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // 플레이어 정보 저장
    const playerId = Date.now().toString();
    players.set(playerId, {
        ws,
        roomId,
        playerName,
        type: 'websocket'
    });
    
    // 방이 없으면 생성
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            players: [],
            gameState: {
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
                currentPlayer: 'white',
                moveHistory: []
            }
        });
    }
    
    const room = rooms.get(roomId);
    room.players.push({
        id: playerId,
        name: playerName,
        type: 'websocket'
    });
    
    console.log(`플레이어 ${playerName}이(가) 방 ${roomId}에 입장했습니다.`);
    console.log(`현재 방 ${roomId}의 플레이어 수: ${room.players.length}`);
    
    // 게임 시작 조건 확인
    if (room.players.length === 2) {
        console.log(`방 ${roomId}에서 게임이 시작됩니다!`);
        
        // 모든 플레이어에게 게임 시작 알림
        room.players.forEach(player => {
            const playerWs = players.get(player.id)?.ws;
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                playerWs.send(JSON.stringify({
                    type: 'gameStart',
                    gameState: room.gameState,
                    playerColor: player === room.players[0] ? 'white' : 'black'
                }));
            }
        });
    }
    
    // 메시지 처리
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('메시지 수신:', data);
            
            switch (data.type) {
                case 'move':
                    handleMove(ws, data, room);
                    break;
                case 'resign':
                    handleResign(ws, room);
                    break;
                default:
                    console.log('알 수 없는 메시지 타입:', data.type);
            }
        } catch (error) {
            console.error('메시지 파싱 오류:', error);
        }
    });
    
    // 연결 종료 처리
    ws.on('close', () => {
        console.log(`플레이어 ${playerName}의 연결이 종료되었습니다.`);
        
        // 플레이어 제거
        room.players = room.players.filter(p => p.id !== playerId);
        players.delete(playerId);
        
        // 방이 비어있으면 방 삭제
        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`방 ${roomId}가 삭제되었습니다.`);
        } else {
            // 남은 플레이어들에게 상대방 퇴장 알림
            room.players.forEach(player => {
                const playerWs = players.get(player.id)?.ws;
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({
                        type: 'playerLeft',
                        message: '상대방이 게임을 떠났습니다.'
                    }));
                }
            });
        }
    });
});

function handleMove(ws, data, room) {
    const { fromRow, fromCol, toRow, toCol, playerColor } = data;
    
    console.log(`이동: ${playerColor} 플레이어가 (${fromRow},${fromCol})에서 (${toRow},${toCol})로 이동`);
    
    // 게임 상태 업데이트
    const piece = room.gameState.board[fromRow][fromCol];
    room.gameState.board[fromRow][fromCol] = '';
    room.gameState.board[toRow][toCol] = piece;
    
    // 턴 변경
    room.gameState.currentPlayer = room.gameState.currentPlayer === 'white' ? 'black' : 'white';
    
    // 이동 기록 추가
    room.gameState.moveHistory.push({
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        piece: piece,
        player: playerColor
    });
    
    // 모든 플레이어에게 이동 알림
    room.players.forEach(player => {
        const playerWs = players.get(player.id)?.ws;
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
            playerWs.send(JSON.stringify({
                type: 'move',
                fromRow,
                fromCol,
                toRow,
                toCol,
                piece,
                currentPlayer: room.gameState.currentPlayer
            }));
        }
    });
}

function handleResign(ws, room) {
    console.log('플레이어가 항복했습니다.');
    
    // 모든 플레이어에게 항복 알림
    room.players.forEach(player => {
        const playerWs = players.get(player.id)?.ws;
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
            playerWs.send(JSON.stringify({
                type: 'gameOver',
                reason: 'resign',
                winner: 'opponent'
            }));
        }
    });
}

function isValidMove(board, fromRow, fromCol, toRow, toCol, color) {
    // 간단한 이동 유효성 검사
    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];
    
    // 빈 칸에서 이동하려는 경우
    if (!piece) return false;
    
    // 상대방 말을 잡으려는 경우
    if (targetPiece && targetPiece !== '') {
        // 같은 색의 말을 잡으려는 경우
        if ((color === 'white' && targetPiece.charCodeAt(0) > 9819) ||
            (color === 'black' && targetPiece.charCodeAt(0) <= 9819)) {
            return false;
        }
    }
    
    return true;
}

// 서버 시작
server.listen(PORT, () => {
    console.log(`체스 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`서버 URL: http://localhost:${PORT}`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
    console.log('서버를 종료합니다...');
    clearInterval(interval);
    wss.close();
    server.close();
    process.exit(0);
}); 
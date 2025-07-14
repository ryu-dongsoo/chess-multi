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
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 정적 파일 제공
    let filePath = req.url === '/' ? '/docs/index.html' : req.url;
    
    // docs 폴더의 파일들을 우선적으로 제공
    if (req.url.startsWith('/style.css') || req.url.startsWith('/script.js')) {
        filePath = path.join(__dirname, 'docs', req.url.substring(1));
    } else {
        filePath = path.join(__dirname, filePath);
    }
    
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
                fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
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

// 연결 상태 모니터링 (더 자주 체크)
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('비활성 연결 종료');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 15000); // 15초마다 체크 (기존 30초에서 단축)

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
    
    // 매치메이킹 처리
    if (roomId === 'matchmaking') {
        console.log(`매치메이킹 시도: ${playerName}`);
        
        // 대기 중인 매치메이킹 플레이어 찾기
        let foundMatch = false;
        
        for (const [existingRoomId, room] of rooms.entries()) {
            if (existingRoomId.startsWith('matchmaking_') && room.players.filter(p => p.type === 'websocket').length === 1) {
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
        
        console.log(`매치메이킹 결과: ${playerName} -> ${roomId}`);
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
        console.log(`새 방 생성: ${roomId}`);
    }
    
    const room = rooms.get(roomId);
    
    // WebSocket 플레이어만 계산 (실제 게임 플레이어)
    const actualPlayers = room.players.filter(p => p.type === 'websocket');
    console.log(`방 ${roomId} 상태: 실제 게임 플레이어 ${actualPlayers.length}명`);
    
    // WebSocket 플레이어 추가
    const wsPlayer = { ws: ws, playerName: playerName, type: 'websocket' };
    room.players.push(wsPlayer);
    
    // 실제 게임 플레이어 수 다시 계산
    const newActualPlayers = room.players.filter(p => p.type === 'websocket');
    console.log(`방 ${roomId}에 플레이어 ${playerName} 연결됨. 실제 게임 플레이어 수: ${newActualPlayers.length}`);
    
    if (newActualPlayers.length === 1) {
        // 첫 번째 게임 플레이어 (방 생성자) - 흰색
        players.get(ws).color = 'white';
        console.log(`✅ 방 생성자 할당: ${players.get(ws).playerName} -> 흰색 (방 ID: ${roomId})`);
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: 'white',
            message: '흰색 플레이어로 할당되었습니다. 상대방을 기다리는 중...'
        }));
    } else if (newActualPlayers.length === 2) {
        // 두 번째 게임 플레이어 (참여자) - 검은색
        players.get(ws).color = 'black';
        console.log(`✅ 참여자 할당: ${players.get(ws).playerName} -> 검은색 (방 ID: ${roomId})`);
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: 'black',
            message: '검은색 플레이어로 할당되었습니다. 게임을 시작합니다!'
        }));
        
        // 게임 시작 알림 - 각 플레이어에게 자신의 색상과 함께 전송
        console.log(`🎮 게임 시작! 방 ID: ${roomId}`);
        room.players.forEach((player, index) => {
            if (player.type === 'websocket') {
                const playerInfo = players.get(player.ws);
                console.log(`  플레이어 ${index + 1}: ${playerInfo.playerName} -> ${playerInfo.color}`);
                player.ws.send(JSON.stringify({
                    type: 'gameStart',
                    gameState: room.gameState,
                    playerColor: playerInfo.color
                }));
            }
        });
    } else {
        // 3명째 게임 플레이어부터는 관전자로 처리
        console.log(`👁️ 관전자 입장: 방 ID: ${roomId}, 실제 게임 플레이어 수: ${newActualPlayers.length}`);
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
    ws.on('close', (code, reason) => {
        const player = players.get(ws);
        if (player) {
            const room = rooms.get(player.roomId);
            if (room) {
                // WebSocket 플레이어만 제거
                room.players = room.players.filter(p => p.ws !== ws);
                
                // 상대방에게 알림 (WebSocket 플레이어만)
                room.players.forEach(p => {
                    if (p.type === 'websocket') {
                        p.ws.send(JSON.stringify({
                            type: 'playerDisconnected',
                            message: '상대방이 연결을 끊었습니다.'
                        }));
                    }
                });
                
                // 방이 비면 삭제
                if (room.players.length === 0) {
                    rooms.delete(player.roomId);
                }
            }
            players.delete(ws);
        }
        console.log(`연결 해제: ${player ? player.playerName : 'Unknown'} (코드: ${code}, 이유: ${reason})`);
    });
    
    // 연결 오류 처리
    ws.on('error', (error) => {
        console.error('WebSocket 오류:', error);
    });
});

// 이동 처리
function handleMove(ws, data, room) {
    const { fromRow, fromCol, toRow, toCol, piece, capturedPiece, specialType } = data;
    const player = players.get(ws);
    
    console.log(`이동 요청: ${player.playerName}(${player.color}) ${fromRow},${fromCol} -> ${toRow},${toCol}`);
    console.log('현재 턴:', room.gameState.currentPlayer);
    console.log('받은 데이터:', data);
    
    // 현재 플레이어 턴인지 확인
    if (room.gameState.currentPlayer !== player.color) {
        console.log('턴 오류: 현재 턴은', room.gameState.currentPlayer, '플레이어 색상은', player.color);
        ws.send(JSON.stringify({
            type: 'error',
            message: '당신의 턴이 아닙니다.'
        }));
        return;
    }
    
    // 이동 유효성 검사 (간단한 버전)
    if (isValidMove(room.gameState.board, fromRow, fromCol, toRow, toCol, player.color)) {
        // 이동 실행
        const movedPiece = room.gameState.board[fromRow][fromCol];
        const capturedPiece = room.gameState.board[toRow][toCol];
        
        console.log(`이동 실행: ${movedPiece} ${fromRow},${fromCol} -> ${toRow},${toCol}`);
        
        room.gameState.board[toRow][toCol] = movedPiece;
        room.gameState.board[fromRow][fromCol] = '';
        
        // 이동 실행 후 보드 상태 로깅
        console.log('이동 실행 후 보드 상태:');
        room.gameState.board.forEach((row, i) => {
            console.log(i + ': ' + row.join(''));
        });
        
        // 플레이어 변경
        room.gameState.currentPlayer = room.gameState.currentPlayer === 'white' ? 'black' : 'white';
        
        // 이동 기록
        room.gameState.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: movedPiece,
            captured: capturedPiece,
            special: specialType || 'normal'
        });
        
        // 모든 플레이어에게 업데이트 전송
        const gameStateCopy = {
            board: room.gameState.board.map(row => [...row]),
            currentPlayer: room.gameState.currentPlayer,
            moveHistory: [...room.gameState.moveHistory]
        };
        
        console.log('moveUpdate 전송할 board:');
        gameStateCopy.board.forEach((row, i) => {
            console.log(i + ': ' + row.join(''));
        });
        
        room.players.forEach(player => {
            if (player.type === 'websocket') {
                player.ws.send(JSON.stringify({
                    type: 'moveUpdate',
                    gameState: gameStateCopy,
                    lastMove: { fromRow, fromCol, toRow, toCol, piece: movedPiece, captured: capturedPiece, special: specialType }
                }));
            }
        });
    } else {
        console.log('유효하지 않은 이동:', fromRow, fromCol, '->', toRow, toCol);
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
        if (p.type === 'websocket') {
            p.ws.send(JSON.stringify({
                type: 'gameEnd',
                winner: winner,
                reason: 'resign',
                message: `${player.playerName}이(가) 항복했습니다.`
            }));
        }
    });
}

// 간단한 이동 유효성 검사
function isValidMove(board, fromRow, fromCol, toRow, toCol, color) {
    const piece = board[fromRow][fromCol];
    if (!piece) {
        console.log('이동 실패: 시작 위치에 말이 없음');
        return false;
    }
    
    // 기본적인 검사만 수행
    const isValid = fromRow >= 0 && fromRow < 8 && fromCol >= 0 && fromCol < 8 &&
           toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8 &&
           (fromRow !== toRow || fromCol !== toCol);
    
    if (!isValid) {
        console.log('이동 실패: 기본 검사 통과하지 못함');
        return false;
    }
    
    console.log(`이동 유효성 검사 통과: ${piece} ${fromRow},${fromCol} -> ${toRow},${toCol}`);
    return true;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`체스 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`웹소켓 URL: ws://localhost:${PORT}`);
}); 
const { Octokit } = require('@octokit/rest');

// GitHub API 클라이언트 생성
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function makeMove(roomId, moveData) {
  try {
    const owner = process.env.GITHUB_REPOSITORY.split('/')[0];
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    
    // 체스 게임 이슈 찾기
    const issues = await octokit.issues.listForRepo({
      owner,
      repo,
      labels: ['chess-game'],
      state: 'open'
    });

    // 해당 방 ID의 게임 찾기
    const gameIssue = issues.data.find(issue => 
      issue.title.includes(`Chess Game: ${roomId}`)
    );

    if (!gameIssue) {
      console.error(`Game room ${roomId} not found`);
      return {
        success: false,
        error: 'Game room not found'
      };
    }

    // 게임 상태 파싱
    const issueBody = gameIssue.body;
    const gameStateMatch = issueBody.match(/```json\n([\s\S]*?)\n```/);
    
    if (!gameStateMatch) {
      console.error('Game state not found in issue body');
      return {
        success: false,
        error: 'Game state not found'
      };
    }

    const gameState = JSON.parse(gameStateMatch[1]);

    // 이동 데이터 파싱
    const move = JSON.parse(moveData);
    const { fromRow, fromCol, toRow, toCol, playerColor } = move;

    // 이동 유효성 검사
    if (!isValidMove(gameState.board, fromRow, fromCol, toRow, toCol, playerColor)) {
      console.error('Invalid move');
      return {
        success: false,
        error: 'Invalid move'
      };
    }

    // 보드 업데이트
    const piece = gameState.board[fromRow][fromCol];
    gameState.board[fromRow][fromCol] = '';
    gameState.board[toRow][toCol] = piece;

    // 턴 변경
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    // 이동 기록 추가
    gameState.moveHistory.push({
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece: piece,
      player: playerColor,
      timestamp: new Date().toISOString()
    });

    // 이슈 업데이트
    const updatedBody = `## Chess Game Room: ${roomId}

**Created by:** ${gameState.players[0].name}
**Joined by:** ${gameState.players[1].name}
**Status:** Playing
**Current Player:** ${gameState.currentPlayer}
**Created:** ${gameState.createdAt}
**Started:** ${gameState.players[1].joinedAt}

### Game State
\`\`\`json
${JSON.stringify(gameState, null, 2)}
\`\`\`

### Instructions
- This issue represents a chess game room
- Players can join by commenting on this issue
- Game moves are tracked in the comments
- The game state is updated in the issue body

### Players
1. **${gameState.players[0].name}** (White) - ${gameState.players[0].joinedAt}
2. **${gameState.players[1].name}** (Black) - ${gameState.players[1].joinedAt}

### Last Move
**${playerColor}** moved ${piece} from (${fromRow},${fromCol}) to (${toRow},${toCol})`;

    await octokit.issues.update({
      owner,
      repo,
      issue_number: gameIssue.number,
      body: updatedBody
    });

    // 이동 댓글 추가
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: gameIssue.number,
      body: `♟️ **${playerColor}** moved **${piece}** from (${fromRow},${fromCol}) to (${toRow},${toCol})

Next player: **${gameState.currentPlayer}**`
    });

    console.log(`Move made: ${playerColor} moved ${piece} from (${fromRow},${fromCol}) to (${toRow},${toCol})`);
    console.log(`Issue #${gameIssue.number} updated`);
    
    return {
      success: true,
      issueNumber: gameIssue.number,
      roomId: roomId,
      gameState: gameState,
      move: move
    };

  } catch (error) {
    console.error('Error making move:', error);
    return {
      success: false,
      error: error.message
    };
  }
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

// 명령행 인수 처리
const roomId = process.argv[2];
const moveData = process.argv[3];

if (!roomId || !moveData) {
  console.error('Usage: node make-move.js <roomId> <moveData>');
  process.exit(1);
}

// 말 이동 실행
makeMove(roomId, moveData)
  .then(result => {
    if (result.success) {
      console.log('✅ Move made successfully!');
      console.log(`📋 Issue #${result.issueNumber}`);
      console.log(`🎮 Room ID: ${result.roomId}`);
      console.log(`♟️ Move: ${result.move.playerColor} moved ${result.move.piece}`);
    } else {
      console.error('❌ Failed to make move:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }); 
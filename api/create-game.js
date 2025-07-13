const { Octokit } = require('@octokit/rest');

// GitHub API 클라이언트 생성
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function createGame(roomId, playerName) {
  try {
    const owner = process.env.GITHUB_REPOSITORY.split('/')[0];
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    
    // 초기 체스보드 상태
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

    // 게임 상태 데이터
    const gameState = {
      roomId: roomId,
      board: initialBoard,
      currentPlayer: 'white',
      players: [
        {
          name: playerName,
          color: 'white',
          joinedAt: new Date().toISOString()
        }
      ],
      moveHistory: [],
      status: 'waiting',
      createdAt: new Date().toISOString()
    };

    // GitHub Issue 생성
    const issue = await octokit.issues.create({
      owner,
      repo,
      title: `Chess Game: ${roomId}`,
      body: `## Chess Game Room: ${roomId}

**Created by:** ${playerName}
**Status:** Waiting for opponent
**Created:** ${new Date().toISOString()}

### Game State
\`\`\`json
${JSON.stringify(gameState, null, 2)}
\`\`\`

### Instructions
- This issue represents a chess game room
- Players can join by commenting on this issue
- Game moves are tracked in the comments
- The game state is updated in the issue body`,
      labels: ['chess-game', 'waiting'],
      assignees: [owner]
    });

    console.log(`Game created successfully! Issue #${issue.data.number}`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Created by: ${playerName}`);
    
    return {
      success: true,
      issueNumber: issue.data.number,
      roomId: roomId,
      gameState: gameState
    };

  } catch (error) {
    console.error('Error creating game:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 명령행 인수 처리
const roomId = process.argv[2];
const playerName = process.argv[3];

if (!roomId || !playerName) {
  console.error('Usage: node create-game.js <roomId> <playerName>');
  process.exit(1);
}

// 게임 생성 실행
createGame(roomId, playerName)
  .then(result => {
    if (result.success) {
      console.log('✅ Game created successfully!');
      console.log(`📋 Issue #${result.issueNumber}`);
      console.log(`🎮 Room ID: ${result.roomId}`);
    } else {
      console.error('❌ Failed to create game:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }); 
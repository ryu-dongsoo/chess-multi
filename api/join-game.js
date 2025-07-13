const { Octokit } = require('@octokit/rest');

// GitHub API 클라이언트 생성
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function joinGame(roomId, playerName) {
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

    // 이미 2명의 플레이어가 있는지 확인
    if (gameState.players.length >= 2) {
      console.error('Game is full');
      return {
        success: false,
        error: 'Game is full'
      };
    }

    // 두 번째 플레이어 추가
    gameState.players.push({
      name: playerName,
      color: 'black',
      joinedAt: new Date().toISOString()
    });

    // 게임 상태를 'playing'으로 변경
    gameState.status = 'playing';

    // 이슈 업데이트
    const updatedBody = `## Chess Game Room: ${roomId}

**Created by:** ${gameState.players[0].name}
**Joined by:** ${playerName}
**Status:** Playing
**Created:** ${gameState.createdAt}
**Started:** ${new Date().toISOString()}

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
2. **${playerName}** (Black) - ${gameState.players[1].joinedAt}`;

    await octokit.issues.update({
      owner,
      repo,
      issue_number: gameIssue.number,
      body: updatedBody,
      labels: ['chess-game', 'playing']
    });

    // 참가 댓글 추가
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: gameIssue.number,
      body: `🎮 **${playerName}** joined the game as **Black**!

Game is now ready to start! 🚀`
    });

    console.log(`Player ${playerName} joined game room ${roomId}`);
    console.log(`Issue #${gameIssue.number} updated`);
    
    return {
      success: true,
      issueNumber: gameIssue.number,
      roomId: roomId,
      gameState: gameState,
      playerColor: 'black'
    };

  } catch (error) {
    console.error('Error joining game:', error);
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
  console.error('Usage: node join-game.js <roomId> <playerName>');
  process.exit(1);
}

// 게임 참가 실행
joinGame(roomId, playerName)
  .then(result => {
    if (result.success) {
      console.log('✅ Joined game successfully!');
      console.log(`📋 Issue #${result.issueNumber}`);
      console.log(`🎮 Room ID: ${result.roomId}`);
      console.log(`🎨 Player Color: ${result.playerColor}`);
    } else {
      console.error('❌ Failed to join game:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }); 
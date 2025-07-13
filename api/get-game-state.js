const { Octokit } = require('@octokit/rest');

// GitHub API 클라이언트 생성
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getGameState(roomId) {
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

    // 댓글에서 최근 이동 기록 가져오기
    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: gameIssue.number
    });

    // 이동 관련 댓글만 필터링
    const moveComments = comments.data.filter(comment => 
      comment.body.includes('♟️') || comment.body.includes('moved')
    );

    console.log(`Game state retrieved for room ${roomId}`);
    console.log(`Issue #${gameIssue.number}`);
    console.log(`Status: ${gameState.status}`);
    console.log(`Current Player: ${gameState.currentPlayer}`);
    console.log(`Players: ${gameState.players.length}`);
    console.log(`Moves: ${gameState.moveHistory.length}`);
    console.log(`Comments: ${moveComments.length}`);
    
    return {
      success: true,
      issueNumber: gameIssue.number,
      roomId: roomId,
      gameState: gameState,
      comments: moveComments
    };

  } catch (error) {
    console.error('Error getting game state:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 명령행 인수 처리
const roomId = process.argv[2];

if (!roomId) {
  console.error('Usage: node get-game-state.js <roomId>');
  process.exit(1);
}

// 게임 상태 조회 실행
getGameState(roomId)
  .then(result => {
    if (result.success) {
      console.log('✅ Game state retrieved successfully!');
      console.log(`📋 Issue #${result.issueNumber}`);
      console.log(`🎮 Room ID: ${result.roomId}`);
      console.log(`📊 Status: ${result.gameState.status}`);
      console.log(`👥 Players: ${result.gameState.players.length}`);
      console.log(`♟️ Moves: ${result.gameState.moveHistory.length}`);
      
      // 게임 상태 출력
      console.log('\n📋 Game State:');
      console.log(JSON.stringify(result.gameState, null, 2));
    } else {
      console.error('❌ Failed to get game state:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }); 
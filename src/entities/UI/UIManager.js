import Component from "../../Component";

export default class UIManager extends Component {
  constructor() {
    super();
    this.name = "UIManager";
    this.score = 0; // THÊM: Track total score
    this.kills = 0; // THÊM: Track kill count
  }

  SetAmmo(mag, rest) {
    document.getElementById("current_ammo").innerText = mag;
    document.getElementById("max_ammo").innerText = rest;
  }

  SetHealth(health) {
    document.getElementById("health_progress").style.width = `${health}%`;
  }

  AddScore(points = 1) {
    this.score += points;
    document.getElementById("score").innerText = this.score;
  }

  ResetScore() {
    this.score = 0;
    document.getElementById("score").innerText = this.score;
  }

  GetScore() {
    return this.score;
  }

  ShowGameOver() {
    // Create game over UI
    const gameOver = document.createElement("div");
    gameOver.id = "game_over";
    gameOver.innerHTML = "<h2>GAME OVER</h2><p>Returning to menu...</p>";
    document.body.appendChild(gameOver);

    // Remove the game over message after returning to menu
    setTimeout(() => {
      if (gameOver && gameOver.parentNode) {
        gameOver.parentNode.removeChild(gameOver);
      }
    }, 3000);
  }
  Initialize() {
    document.getElementById("game_hud").style.visibility = "visible";

    // Register to listen for monster death events
    if (
      this.parent.entityManager &&
      this.parent.entityManager.RegisterGlobalEventHandler
    ) 
    {

      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        if (eventData.type === "monster_death") {
          this.AddScore(1);
          console.log("Monster killed! Score:", this.score);
        }
      });
    }

    // KIỂM TRA: Chỉ tạo score display 1 lần
    if (!document.getElementById("score_display")) {
      this.CreateScoreDisplay();
    }
    
    // THÊM: Register event handler for monster kills  
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        console.log("UIManager received global event:", eventData);
        if (eventData.type === 'monster_killed') {
          this.OnMonsterKilled(eventData);
        }
      });
    }
    
    this.Update();
    // THÊM: Register event handler for monster kills
    this.parent.RegisterEventHandler((eventData) => {
      if (eventData.type === 'monster_killed') {
        this.OnMonsterKilled(eventData);
      }
    }, 'monster_killed');
    
    // THÊM: Create score display
    this.CreateScoreDisplay();

  }

  // THÊM: Handle monster killed event
  OnMonsterKilled(eventData) {
    this.score += eventData.scoreEarned;
    this.kills += 1;
    
    console.log(`Monster killed! +${eventData.scoreEarned} points. Total score: ${this.score}`);
    
    // Show score popup
    this.ShowScorePopup(eventData.scoreEarned, eventData.playerHealthPercent);
    
    // Update score display
    this.UpdateScoreDisplay();
  }
  // THÊM: Create score display element
  CreateScoreDisplay() {
    // KIỂM TRA: Xóa cũ nếu có
    const existingDisplay = document.getElementById("score_display");
    if (existingDisplay) {
      existingDisplay.remove();
    }
    
    this.scoreDisplay = document.createElement("div");
    this.scoreDisplay.id = "score_display";
    this.scoreDisplay.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      color: white;
      font-size: 18px;
      font-weight: bold;
      background: rgba(0,0,0,0.7);
      padding: 10px 15px;
      border-radius: 8px;
      border: 2px solid #00ff00;
      z-index: 1000;
      font-family: Arial, sans-serif;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.UpdateScoreDisplay();
    document.body.appendChild(this.scoreDisplay);
  }
  // THÊM: Update score display
  UpdateScoreDisplay() {
    if (this.scoreDisplay) {
      this.scoreDisplay.innerHTML = `
        <div style="color: #00ff00;">SCORE: ${this.score}</div>
        <div style="color: #ffff00; font-size: 14px;">Kills: ${this.kills}</div>
      `;
    }
  }


  // THÊM: Show floating score text
  ShowScorePopup(points, healthPercent) {
    const popup = document.createElement("div");
    popup.innerHTML = `+${points} pts<br><small>${(healthPercent * 100).toFixed(1)}% HP</small>`;
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #00ff00;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      pointer-events: none;
      z-index: 1000;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      animation: scorePopup 2s ease-out forwards;
    `;
    
    // Add CSS animation
    if (!document.querySelector('#scorePopupStyle')) {
      const style = document.createElement('style');
      style.id = 'scorePopupStyle';
      style.textContent = `
        @keyframes scorePopup {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -60%) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -70%) scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(popup);
    
    // Remove after animation
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 2000);
  }
  // THÊM: Reset score for new game
  ResetScore() {
    this.score = 0;
    this.kills = 0;
    this.UpdateScoreDisplay();
  }

  Update() {
    // Always keep the score DOM in sync with the internal value
    const scoreElem = document.getElementById("score");
    if (scoreElem && scoreElem.innerText != this.score) {
      scoreElem.innerText = this.score;
    }
    // THÊM: Update score display
    if (this.scoreDisplay) {
      this.scoreDisplay.innerHTML = `
        Score: ${this.score}<br>
        Kills: ${this.kills}
      `;
    } else {
      // Tạo score display nếu chưa có
      this.scoreDisplay = document.createElement("div");
      this.scoreDisplay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        color: white;
        font-size: 16px;
        font-weight: bold;
        background: rgba(0,0,0,0.7);
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
      `;
      this.scoreDisplay.innerHTML = `
        Score: ${this.score}<br>
        Kills: ${this.kills}
      `;
      document.body.appendChild(this.scoreDisplay);
    }

  }
}

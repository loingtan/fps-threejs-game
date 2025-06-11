import Component from "../../Component";

export default class UIManager extends Component {
  constructor() {
    super();
    this.name = "UIManager";
    this.score = 0;
    this.kills = 0;
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

    // // Register to listen for monster death events
    // if (
    //   this.parent.entityManager &&
    //   this.parent.entityManager.RegisterGlobalEventHandler
    // ) {
    //   this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
    //     if (eventData.type === "monster_death") {
    //       this.AddScore(1);
    //       console.log("Monster killed! Score:", this.score);
    //     }
    //   });
    // }
    // THÊM: Tạo Score Display ngay lập tức
    this.CreateScoreDisplay();
    
    // THÊM: Register event handler for monster kills
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        console.log("UIManager received global event:", eventData);
        if (eventData.type === 'monster_killed') {
          this.OnMonsterKilled(eventData);
        }
      });
    }

  }
  CreateScoreDisplay() {
    // Xóa cũ nếu có
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
    
    this.Update();
    document.body.appendChild(this.scoreDisplay);
    console.log("Score display created and added to DOM");
  }

  // THÊM: Update Score Display
  Update() {
    if (this.scoreDisplay) {
      this.scoreDisplay.innerHTML = `
        <div style="color: #00ff00;">SCORE: ${this.score}</div>
        <div style="color: #ffff00; font-size: 14px;">Kills: ${this.kills}</div>
      `;
    }
  }
  
  // THÊM: Handle Monster Killed Event
  OnMonsterKilled(eventData) {
    this.score += eventData.scoreEarned;
    this.kills += 1;
    
    console.log(`Monster killed! +${eventData.scoreEarned} points. Total score: ${this.score}`);
    
    // Show score popup
    this.ShowScorePopup(eventData.scoreEarned, eventData.playerHealthPercent);
    
    // Update score display
    this.Update();
  }

  // THÊM: Show Score Popup
  ShowScorePopup(points, healthPercent) {
    const popup = document.createElement("div");
    popup.innerHTML = `
      <div style="font-size: 28px; color: #00ff00;">+${points}</div>
      <div style="font-size: 16px; color: #ffff00;">${(healthPercent * 100).toFixed(1)}% HP</div>
    `;
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      z-index: 1001;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.9);
      animation: scorePopup 2.5s ease-out forwards;
    `;
    
    // Add CSS animation
    if (!document.querySelector('#scorePopupStyle')) {
      const style = document.createElement('style');
      style.id = 'scorePopupStyle';
      style.textContent = `
        @keyframes scorePopup {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          20% { transform: translate(-50%, -60%) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%, -80%) scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 2500);
  }

  // Update() {
  //   // Always keep the score DOM in sync with the internal value
  //   const scoreElem = document.getElementById("score");
  //   if (scoreElem && scoreElem.innerText != this.score) {
  //     scoreElem.innerText = this.score;
  //   }
  // }
}

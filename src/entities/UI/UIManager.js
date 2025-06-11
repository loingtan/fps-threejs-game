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
    console.log("Score updated:", this.score);

    try {
      const scoreElement = document.getElementById("score");
      if (scoreElement) {
        scoreElement.innerText = this.score;
      } else {
        console.error("Score element not found in the DOM");
      }
    } catch (error) {
      console.error("Error updating score in the DOM:", error);
    }
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
    console.log("UIManager initialized, setting up event handlers");

    if (
      this.parent.entityManager &&
      this.parent.entityManager.RegisterGlobalEventHandler
    ) {
      console.log(
        "Registering global event handler for monster_death in UIManager"
      );
      const handler = (eventData) => {
        console.log("UIManager received event:", eventData);
        if (eventData.type === "monster_death") {
          this.AddScore(1);
          console.log("Monster killed! Score:", this.score);
        }
      };
      this.parent.entityManager.RegisterGlobalEventHandler(handler);
      console.log("Global event handler registered successfully");
    } else {
      console.error(
        "Cannot register event handler in UIManager, entityManager not available"
      );
      console.log("this.parent:", this.parent);
      console.log("this.parent.entityManager:", this.parent.entityManager);
    }
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

import Component from "../../Component";

export default class UIManager extends Component {
  constructor() {
    super();
    this.name = "UIManager";
    this.score = 0;
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
    ) {
      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        if (eventData.type === "monster_death") {
          this.AddScore(1);
          console.log("Monster killed! Score:", this.score);
        }
      });
    }
  }

  Update() {
    // Always keep the score DOM in sync with the internal value
    const scoreElem = document.getElementById("score");
    if (scoreElem && scoreElem.innerText != this.score) {
      scoreElem.innerText = this.score;
    }
  }
}

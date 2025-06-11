import Component from "../../Component";

export default class PlayerHealth extends Component {
  constructor() {
    super();
    this.name = "PlayerHealth"; // THÊM: Set component name
    this.health = 100;
    this.maxHealth = 100; // THÊM: Add maxHealth property
    this.isDead = false;
    this.gameOverDelay = 3000; // 3 seconds before returning to menu
  }

  TakeHit = (e) => {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - 10);
    this.uimanager.SetHealth(this.health);

    // Check if player died
    if (this.health <= 0 && !this.isDead) {
      this.isDead = true;
      this.handlePlayerDeath();
    }
  };

  // THÊM: Method để lấy health percent cho score calculation
  GetHealthPercent() {
    return this.health / this.maxHealth;
  }

  // THÊM: Method để heal player (nếu cần)
  Heal(amount) {
    if (this.isDead) return;
    
    this.health += amount;
    this.health = Math.min(this.maxHealth, this.health); // Không vượt quá max
    
    console.log(`Player healed ${amount}, health now: ${this.health}/${this.maxHealth}`);
    
    // Update UI
    if (this.uimanager) {
      this.uimanager.SetHealth(this.health);
    }
  }

  handlePlayerDeath() {
    // Disable player movement
    const controls = this.parent.GetComponent("PlayerControls");
    if (controls) {
      controls.enabled = false;
    }

    // Show game over message
    this.uimanager.ShowGameOver();

    // Return to main menu after delay
    setTimeout(() => {
      // Get the main game app instance through the window._APP
      if (window._APP) {
        document.getElementById("game_hud").style.visibility = "hidden";
        document.getElementById("menu").style.visibility = "visible";

        // Play menu music
        const menuMusic = document.getElementById("menu_music");
        if (menuMusic) {
          menuMusic.currentTime = 0;
          menuMusic.play();
        } // Reset player state for next game
        this.health = 100;
        this.isDead = false;

        // Reset score
        if (this.uimanager) {
          this.uimanager.ResetScore();
        }

        // Release pointer lock
        document.exitPointerLock();
      }
    }, this.gameOverDelay);
  }

  Initialize() {
    this.uimanager = this.FindEntity("UIManager").GetComponent("UIManager");
    this.parent.RegisterEventHandler(this.TakeHit, "hit");
    this.uimanager.SetHealth(this.health);
  }
}
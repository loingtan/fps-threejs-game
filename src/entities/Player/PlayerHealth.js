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
  AddHealth(amount) {
    // Đảm bảo amount là số dương
    if (amount <= 0) return;

    // Cập nhật máu của người chơi
    this.health = Math.min(this.health + amount, this.maxHealth);

    // Cập nhật hiển thị thanh máu
    if (this.uimanager) {
      this.uimanager.SetHealth(this.health);
    }

    // Log thông báo
    console.log(
      `Player health increased by ${amount}, new health: ${this.health}/${this.maxHealth}`
    );

    // Hiệu ứng flash màu xanh trên màn hình khi được hồi máu
    this.ShowHealEffect();

    return this.health;
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
  // Thêm phương thức mới trong PlayerHealth.js
  AddHealth(amount) {
    // Đảm bảo amount là số dương
    if (amount <= 0) return;

    // Cập nhật máu của người chơi
    this.health = Math.min(this.health + amount, this.maxHealth);

    // Cập nhật hiển thị thanh máu
    if (this.uimanager) {
      this.uimanager.SetHealth(this.health);

      // Log thông báo
      console.log(
        `Player health increased by ${amount.toFixed(1)}, new health: ${
          this.health
        }/${this.maxHealth}`
      );

      // Hiệu ứng flash màu xanh trên màn hình khi được hồi máu
      this.ShowHealEffect();

      return this.health;
    }
  }

  // Thêm phương thức hiệu ứng hồi máu
  ShowHealEffect() {
    // Tạo overlay flash xanh lá
    const overlay = document.createElement("div");
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 255, 0, 0.2);
    pointer-events: none;
    z-index: 999;
    animation: healFlash 0.5s ease-out forwards;
  `;

    // Thêm animation CSS
    if (!document.getElementById("heal-animations")) {
      const style = document.createElement("style");
      style.id = "heal-animations";
      style.textContent = `
      @keyframes healFlash {
        0% { opacity: 0; }
        20% { opacity: 0.3; }
        100% { opacity: 0; }
      }
    `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Xóa overlay sau khi animation kết thúc
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 500);
  }
  // THÊM: Method để lấy health percent cho score calculation
  GetHealthPercent() {
    return this.health / this.maxHealth;
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

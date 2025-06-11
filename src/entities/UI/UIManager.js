import Component from "../../Component";

export default class UIManager extends Component {
  constructor() {
    super();
    this.name = "UIManager";
    this.score = 0; // Track total score from killing monsters
    this.countedMonsterIds = new Set(); // HashSet to track which monsters have been counted for score
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
    this.countedMonsterIds.clear(); // Clear the HashSet of counted monster IDs
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
  ShowSuccessScreen() {
    console.log("ShowSuccessScreen called in UIManager");

    // Show the success screen
    const successScreen = document.getElementById("success_screen");
    if (successScreen) {
      console.log("Success screen element found, displaying it");

      // Show success screen with flex display style
      successScreen.style.display = "flex";

      // Make sure pointer is unlocked for menu interaction
      document.exitPointerLock();

      // Pause the game
      if (window._APP && typeof window._APP.PauseGame === "function") {
        console.log("Pausing game on victory screen");
        window._APP.PauseGame();
      } else {
        console.warn("Could not pause game - window._APP.PauseGame not found");

        // Fallback: try to access _APP directly from window
        if (window._APP) {
          console.log("Found window._APP, manually setting isGamePaused");
          window._APP.isGamePaused = true;
        }
      }

      // Add event listener to return to menu button
      const returnButton = document.getElementById("return_to_menu");
      if (returnButton) {
        console.log("Return button found, adding click handler");

        // Remove any existing event listeners to prevent duplicates
        returnButton.replaceWith(returnButton.cloneNode(true));
        const newReturnButton = document.getElementById("return_to_menu");
        newReturnButton.addEventListener("click", () => {
          console.log("Return button clicked");

          // Hide success screen
          successScreen.style.display = "none";

          // Reset score and clear monster tracking
          this.ResetScore();

          // Reset the MonsterSpawner if it exists
          const monsterSpawner =
            this.FindEntity("Level")?.GetComponent("MonsterSpawner");
          if (monsterSpawner && typeof monsterSpawner.Reset === "function") {
            monsterSpawner.Reset();
          }

          // Clear the score display
          if (this.scoreDisplay && this.scoreDisplay.parentNode) {
            this.scoreDisplay.parentNode.removeChild(this.scoreDisplay);
            this.scoreDisplay = null;
          }

          // Return to menu (similar to game over)
          document.getElementById("game_hud").style.visibility = "hidden";
          document.getElementById("menu").style.visibility = "visible"; // Resume the game (to ensure animation loop continues)
          if (window._APP && typeof window._APP.ResumeGame === "function") {
            window._APP.ResumeGame();
          } else if (window._APP) {
            // Fallback: directly set the game pause state
            window._APP.isGamePaused = false;
          }

          // Play menu music if available
          const menuMusic = document.getElementById("menu_music");
          if (menuMusic) {
            menuMusic
              .play()
              .catch((e) => console.log("Could not play menu music:", e));
          }
        });
      } else {
        console.error("Return button not found in success screen");
      }
    } else {
      console.error("Success screen element not found in the DOM");
    }
  }
  Initialize() {
    document.getElementById("game_hud").style.visibility = "visible";
    console.log("UIManager initialized, setting up event handlers");

    // Find MonsterSpawner for synchronization
    this.monsterSpawner = null;
    const levelEntity = this.FindEntity("Level");
    if (levelEntity) {
      this.monsterSpawner = levelEntity.GetComponent("MonsterSpawner");
      if (this.monsterSpawner) {
        console.log("Found MonsterSpawner for synchronization");
      }
    }

    if (
      this.parent.entityManager &&
      this.parent.entityManager.RegisterGlobalEventHandler
    ) {
      console.log(
        "Registering global event handler for monster_death in UIManager"
      );
      const handler = (eventData) => {
        console.log("UIManager received event:", eventData);
        if (eventData.type === "monster_death" && eventData.monster) {
          // Get the monster's unique ID with fallback options
          const monsterId =
            eventData.monster.id ||
            eventData.monster.name ||
            (eventData.monster.uuid
              ? `monster_${eventData.monster.uuid}`
              : null);

          // Additional validation to make sure we have a valid ID
          if (!monsterId) {
            console.error(
              "Monster without valid ID detected in death event:",
              eventData
            );
            return;
          }

          // Debug log the current state of our tracked monsters
          console.log(
            `Current tracked monsters count: ${this.countedMonsterIds.size}`
          );
          console.log(`Checking if monster ${monsterId} is already counted`);

          // Check if we've already counted this monster for score
          if (!this.countedMonsterIds.has(monsterId)) {
            // Add this monster to our HashSet so we don't count it again
            this.countedMonsterIds.add(monsterId);
            console.log(`Added monster ${monsterId} to tracked set`);

            this.AddScore(1);
            console.log(
              `Monster ${monsterId} killed! Score increment +1. New Score:`,
              this.score
            );

            // Synchronize with MonsterSpawner as a cross-check
            setTimeout(() => this.SynchronizeWithMonsterSpawner(), 100);
          } else {
            console.log(
              `Score already added for monster ${monsterId}. Not incrementing score.`
            );
          }
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
  SynchronizeWithMonsterSpawner() {
    if (!this.monsterSpawner) {
      // Try to find it again if we don't have it yet
      const levelEntity = this.FindEntity("Level");
      if (levelEntity) {
        this.monsterSpawner = levelEntity.GetComponent("MonsterSpawner");
      }

      if (!this.monsterSpawner) {
        console.warn("Cannot synchronize with MonsterSpawner - not found");
        return false;
      }
    }

    console.log("Synchronizing score with monster spawner data");
    // Compare our score with what the monster spawner thinks should be killed
    const monstersKilled =
      this.monsterSpawner.totalMonstersSpawned -
      this.monsterSpawner.monstersAlive;

    if (this.score !== monstersKilled) {
      console.warn(
        `Score mismatch detected! UI Score: ${this.score}, Actual monsters killed: ${monstersKilled}`
      );

      // Use monster spawner's count as the source of truth
      this.score = monstersKilled;

      // Update the UI display
      const scoreElem = document.getElementById("score");
      if (scoreElem) {
        scoreElem.innerText = this.score;
      }

      console.log(`Score synchronized to: ${this.score}`);
      return true; // Return true if we had to synchronize
    }

    return false; // Return false if already synchronized
  }
  Update() {
    // Always keep the score DOM in sync with the internal value
    const scoreElem = document.getElementById("score");
    if (scoreElem && scoreElem.innerText != this.score) {
      scoreElem.innerText = this.score;
    }

    // Periodically synchronize score with monster spawner data
    if (this.monsterSpawner && Math.random() < 0.05) {
      // ~5% chance each frame
      this.SynchronizeWithMonsterSpawner();
    }

    // THÊM: Update score display
    if (this.scoreDisplay) {
      this.scoreDisplay.innerHTML = `
        Score: ${this.score}
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
        Score: ${this.score}
      `;
      document.body.appendChild(this.scoreDisplay);
    }
  }
}

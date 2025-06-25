import * as THREE from "three";
import Component from "../../Component";
import Entity from "../../Entity";
import NpcCharacterController from "../NPC/CharacterController";
import AttackTrigger from "../NPC/AttackTrigger";
import CharacterCollision from "../NPC/CharacterCollision";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils";

export default class MonsterSpawner extends Component {
  constructor(mutantModel, mutantAnims, scene, physicsWorld, navmesh) {
    super();
    this.name = "MonsterSpawner";
    this.mutantModel = mutantModel;
    this.mutantAnims = mutantAnims;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.navmesh = navmesh;
    this.spawnTimer = 0;
    this.spawnInterval = 2000; // Set to 2 seconds (was 0)    this.maxMonsters = 5; // Maximum monsters at once
    this.monstersAlive = 0;
    this.monsterCounter = 0;
    this.totalMonstersToSpawn = 3; // Total monsters to spawn before victory (changed from 3 to 2)
    this.totalMonstersSpawned = 0;
    this.spawnComplete = false;

    // EXACT spawn position - all monsters will spawn at exactly these coordinates
    this.MONSTER_SPAWN_X = 20;
    this.MONSTER_SPAWN_Y = 0;
    this.MONSTER_SPAWN_Z = 20;

    // Fixed spawn point that will never change
    this.fixedSpawnPoint = new THREE.Vector3(
      this.MONSTER_SPAWN_X,
      this.MONSTER_SPAWN_Y,
      this.MONSTER_SPAWN_Z
    );

    // We don't actually need this array anymore since we're using a hard-coded position
    // But we'll keep it for backward compatibility
    this.spawnPoints = Array(10).fill(this.fixedSpawnPoint);
  }
  Initialize() {
    this.uiManager = this.FindEntity("UIManager").GetComponent("UIManager");
    console.log("MonsterSpawner initialized, UIManager:", this.uiManager);

    // Create a monster counter display
    this.createMonsterCounterDisplay();

    // Register for monster death events
    if (this.parent && this.parent.entityManager) {
      console.log("Registering global event handler for monster deaths");
      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        if (eventData.type === "monster_death") {
          // Log before decrementing to check initial value
          console.log(
            `BEFORE: Monster death event received. Current monsters alive: ${this.monstersAlive}`
          );
          this.monstersAlive--;
          console.log(
            `AFTER: Monster killed! Monsters alive: ${this.monstersAlive}/${this.totalMonstersToSpawn}`
          ); // Update monster counter display
          this.updateMonsterCounterDisplay(); // Score is handled by UIManager
          // Check victory condition - need to kill 2 monsters to win
          const monstersKilled = Math.max(
            0,
            this.totalMonstersSpawned - this.monstersAlive
          );

          if (monstersKilled >= this.totalMonstersToSpawn) {
            console.log(
              `Victory condition triggered: ${monstersKilled} monsters killed!`
            );
            this.CheckVictoryCondition();
          }
        }
      });
    } else {
      console.error(
        "Cannot register event handler in MonsterSpawner, entityManager not available"
      );
    }
  }

  createMonsterCounterDisplay() {
    // Create a display to show monster count
    this.monsterCounterDisplay = document.createElement("div");
    this.monsterCounterDisplay.style.cssText = `
      position: fixed;
      bottom: 15%;
      left: 5%;
      color: white;
      font-size: 16px;
      font-weight: bold;
      background: rgba(0,0,0,0.7);
      padding: 10px;
      border-radius: 5px;
      z-index: 1000;
    `;
    this.updateMonsterCounterDisplay();
    document.body.appendChild(this.monsterCounterDisplay);
  }
  updateMonsterCounterDisplay() {
    if (this.monsterCounterDisplay) {
      // Calculate monsters still to spawn
      const monstersToSpawn = Math.max(
        0,
        this.totalMonstersToSpawn - this.totalMonstersSpawned
      );
      // Calculate total remaining (not yet spawned + currently alive)
      const totalRemaining = monstersToSpawn + this.monstersAlive;

      // Make the message clearer about what's happening
      if (
        this.totalMonstersSpawned >= this.totalMonstersToSpawn &&
        this.monstersAlive === 0
      ) {
        this.monsterCounterDisplay.innerHTML = `
          <span style="color: #00ff00; font-size: 20px;">VICTORY!</span>
        `;
        this.monsterCounterDisplay.style.backgroundColor =
          "rgba(0, 100, 0, 0.8)";
      } else {
        this.monsterCounterDisplay.innerHTML = `
          <span style="font-size: 18px;">Progress: ${Math.max(
            0,
            this.totalMonstersSpawned - this.monstersAlive
          )}/${this.totalMonstersToSpawn}</span><br>
          <span style="font-size: 12px;">Kill ${
            this.totalMonstersToSpawn
          } monsters to win!</span>
        `;
      }

      // Make it red when close to victory
      if (totalRemaining <= 2 && totalRemaining > 0) {
        this.monsterCounterDisplay.style.color = "#ff5555";
      } else if (totalRemaining > 2) {
        this.monsterCounterDisplay.style.color = "white";
      }
    }
  }
  CheckVictoryCondition() {
    console.log("Checking victory condition...");
    console.log(
      "Monsters spawned:",
      this.totalMonstersSpawned,
      "out of",
      this.totalMonstersToSpawn
    );
    console.log("Monsters alive:", this.monstersAlive);

    // Victory condition is met when we have killed at least the required number of monsters
    const monstersKilled = Math.max(
      0,
      this.totalMonstersSpawned - this.monstersAlive
    );

    // Simplified victory check - just need to kill the required number of monsters
    if (monstersKilled >= this.totalMonstersToSpawn) {
      console.log("VICTORY CONDITION MET! Showing success screen..."); // Let the UIManager handle the success screen
      const uiManager = this.FindEntity("UIManager").GetComponent("UIManager");
      if (uiManager && uiManager.ShowSuccessScreen) {
        console.log("UIManager found, calling ShowSuccessScreen method");
        uiManager.ShowSuccessScreen();
      } else {
        console.error("Could not find UIManager or ShowSuccessScreen method");

        // Fallback only if UIManager is not available
        const successScreen = document.getElementById("success_screen");
        if (successScreen) {
          console.log("Fallback: Directly showing success screen element");
          successScreen.style.display = "flex";
        } else {
          console.error("Success screen element not found in DOM");
        }
      }
    }
  }
  SpawnMonster(forceSpawn = false) {
    // Log attempt to spawn monster with detailed info
    console.log(
      `SPAWN ATTEMPT - Total: ${this.totalMonstersSpawned}/${this.totalMonstersToSpawn}, Alive: ${this.monstersAlive}, Force: ${forceSpawn}`
    );

    // Check if we've reached the total number of monsters to spawn
    if (this.totalMonstersSpawned >= this.totalMonstersToSpawn && !forceSpawn) {
      this.spawnComplete = true;
      console.log("Spawn complete - reached total monsters to spawn");
      return false;
    }

    // Only respect the max monsters limit if we're not force spawning
    if (this.monstersAlive >= this.maxMonsters && !forceSpawn) {
      console.log(
        `Cannot spawn monster - already at max (${this.monstersAlive}/${this.maxMonsters})`
      );
      return false;
    } // Always use exactly the same position for all monsters - no calculations
    const exactPosition = new THREE.Vector3(20, 0, 20);

    // Skip any other position calculations entirely
    console.log(
      `Forcing all monsters to spawn at exact position: (${exactPosition.x}, ${exactPosition.y}, ${exactPosition.z})`
    );

    const mutantEntity = new Entity();
    mutantEntity.SetPosition(exactPosition);

    // Generate truly unique identifier combining timestamp and counter
    const uniqueId = `SpawnedMutant_${Date.now()}_${this.monsterCounter++}`;
    mutantEntity.SetName(uniqueId);

    // Also set an explicit ID property for more consistent identification
    mutantEntity.id = uniqueId;

    mutantEntity.AddComponent(
      new NpcCharacterController(
        SkeletonUtils.clone(this.mutantModel),
        this.mutantAnims,
        this.scene,
        this.physicsWorld
      )
    );
    mutantEntity.AddComponent(new AttackTrigger(this.physicsWorld));
    mutantEntity.AddComponent(new CharacterCollision(this.physicsWorld)); // Add to entity manager through the parent's entity manager
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.Add(mutantEntity);
      this.monstersAlive++;
      this.totalMonstersSpawned++;
      console.log(
        `Monster added to game. Total alive now: ${this.monstersAlive}`
      ); // Update console log to include monster count
      console.log(
        `Spawned monster ${this.totalMonstersSpawned}/${this.totalMonstersToSpawn} at position: ${exactPosition.x}, ${exactPosition.y}, ${exactPosition.z}`
      );

      // Update the monster counter display
      this.updateMonsterCounterDisplay();
      // Check if we've spawned the last monster
      if (this.totalMonstersSpawned >= this.totalMonstersToSpawn) {
        this.spawnComplete = true;
        console.log("All monsters spawned. Kill them all to win!");
      }

      // Return true to indicate successful spawn
      return true;
    }

    // Return false if we couldn't add the entity
    return false;
  }
  GetSafeSpawnPosition(basePosition) {
    // Always return the fixed spawn point without any randomization or navmesh influence
    // Ignore the basePosition parameter completely
    console.log(
      `Using exact fixed spawn position: ${this.fixedSpawnPoint.x.toFixed(
        2
      )}, ${this.fixedSpawnPoint.y.toFixed(
        2
      )}, ${this.fixedSpawnPoint.z.toFixed(2)}`
    );
    // Return a new vector with hard-coded values to ensure they're always the same
    return new THREE.Vector3(20, 0, 20);
  }
  Update(deltaTime) {
    this.spawnTimer += deltaTime * 1000; // Convert to milliseconds

    // Debug information to help track monster spawning
    // console.log(`
    //   -- MONSTER SPAWNER DEBUG --
    //   Total spawned: ${this.totalMonstersSpawned}/${this.totalMonstersToSpawn}
    //   Currently alive: ${this.monstersAlive}/${this.maxMonsters}
    //   Spawn timer: ${this.spawnTimer.toFixed(0)}/${this.spawnInterval}
    //   Spawn complete: ${this.spawnComplete}
    //   ---------------------------
    // `);

    // UPDATED SPAWN LOGIC: Always ensure all monsters are spawned
    // Create all monsters immediately at the start
    if (this.totalMonstersSpawned < this.totalMonstersToSpawn) {
      if (this.spawnTimer >= this.spawnInterval) {
        // Forced spawn for all required monsters - guarantees we spawn all 2
        console.log(
          `Forcing spawn of monster ${this.totalMonstersSpawned + 1}/${
            this.totalMonstersToSpawn
          }`
        );

        // Always force spawn required monsters
        const success = this.SpawnMonster(true);

        if (success) {
          console.log(
            `Successfully spawned monster ${this.totalMonstersSpawned}/${this.totalMonstersToSpawn}`
          );
        } else {
          console.error(
            `Failed to spawn monster ${this.totalMonstersSpawned + 1}/${
              this.totalMonstersToSpawn
            }`
          );
        }

        this.spawnTimer = 0;
      }
    }
    // Secondary spawning logic for additional monsters up to maxMonsters
    else if (
      !this.spawnComplete &&
      this.monstersAlive < this.maxMonsters &&
      this.spawnTimer >= this.spawnInterval * 2
    ) {
      console.log("Bonus monster spawn (not required for victory)");
      this.SpawnMonster();
      this.spawnTimer = 0;
    } // Check for victory condition - only when enough monsters have been killed
    // We only need to kill the required number of monsters to win (not necessarily all spawned ones)
    const monstersKilled = Math.max(
      0,
      this.totalMonstersSpawned - this.monstersAlive
    );
    if (monstersKilled >= this.totalMonstersToSpawn && !this.victoryAchieved) {
      console.log(
        `Update: Victory condition detected! ${monstersKilled} monsters killed out of ${this.totalMonstersSpawned} spawned.`
      );

      // Set a flag to avoid checking multiple times
      this.victoryAchieved = true;
      console.log("First time detecting victory condition");

      // Call the victory condition check with a slight delay to ensure UI stability
      setTimeout(() => this.CheckVictoryCondition(), 100);
    }

    // Update the monster counter display every frame
    if (this.monsterCounterDisplay && !this.victoryAchieved) {
      this.updateMonsterCounterDisplay();
    }
  }
  Reset() {
    console.log("Resetting MonsterSpawner...");

    // Reset counters
    this.monstersAlive = 0;
    this.monsterCounter = 0;
    this.totalMonstersSpawned = 0;
    this.spawnComplete = false;
    this.spawnTimer = 0;
    this.victoryAchieved = false; // Reset victory state

    // Hide monster counter display but keep it in the DOM
    if (this.monsterCounterDisplay) {
      // Recreate display with fresh content
      if (this.monsterCounterDisplay.parentNode) {
        this.monsterCounterDisplay.parentNode.removeChild(
          this.monsterCounterDisplay
        );
      }
      this.createMonsterCounterDisplay();
    }

    // Notify any registered handlers about the reset
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.BroadcastGlobalEvent({
        type: "monster_spawner_reset",
      });
    }

    // Make sure success screen is hidden
    const successScreen = document.getElementById("success_screen");
    if (successScreen) {
      successScreen.style.display = "none";
    }

    console.log("MonsterSpawner reset complete");
  }

  // Remove from DOM when level is unloaded
  CleanUp() {
    if (this.monsterCounterDisplay && this.monsterCounterDisplay.parentNode) {
      this.monsterCounterDisplay.parentNode.removeChild(
        this.monsterCounterDisplay
      );
      this.monsterCounterDisplay = null;
    }
  }
}

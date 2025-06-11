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
    this.spawnInterval = 5000; // 5 seconds
    this.maxMonsters = 10; // Maximum monsters at once
    this.monstersAlive = 0;
    this.monsterCounter = 0;
    this.spawnPoints = [
      new THREE.Vector3(20, 0, 20),
      new THREE.Vector3(-20, 0, 20),
      new THREE.Vector3(20, 0, -20),
      new THREE.Vector3(-20, 0, -20),
      new THREE.Vector3(25, 0, 0),
      new THREE.Vector3(-25, 0, 0),
      new THREE.Vector3(0, 0, 25),
      new THREE.Vector3(0, 0, -25),
    ];
  }
  Initialize() {
    this.uiManager = this.FindEntity("UIManager").GetComponent("UIManager");

    // Register for monster death events
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.RegisterGlobalEventHandler((eventData) => {
        if (eventData.type === "monster_death") {
          this.monstersAlive--;
          // Score is handled by UIManager
        }
      });
    }
  }

  SpawnMonster() {
    if (this.monstersAlive >= this.maxMonsters) {
      return;
    }

    // Get random spawn point
    const spawnPoint =
      this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];

    // Try to find a safe spawn position on navmesh
    let safePosition = this.GetSafeSpawnPosition(spawnPoint);
    if (!safePosition) {
      safePosition = spawnPoint; // Fallback to original position
    }

    const mutantEntity = new Entity();
    mutantEntity.SetPosition(safePosition);
    mutantEntity.SetName(`SpawnedMutant_${this.monsterCounter++}`);

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

      console.log(
        `Spawned monster at position: ${safePosition.x}, ${safePosition.y}, ${safePosition.z}`
      );
    }
  }

  GetSafeSpawnPosition(basePosition) {
    if (!this.navmesh) return basePosition;

    // Try to find a random node near the base position
    const randomNode = this.navmesh.GetRandomNode(basePosition, 10);
    if (randomNode) {
      return randomNode.centroid
        ? new THREE.Vector3().copy(randomNode.centroid)
        : basePosition;
    }

    return basePosition;
  }

  Update(deltaTime) {
    this.spawnTimer += deltaTime * 1000; // Convert to milliseconds

    if (this.spawnTimer >= this.spawnInterval) {
      this.SpawnMonster();
      this.spawnTimer = 0;

      // Gradually increase spawn rate (decrease interval) but cap it
      if (this.spawnInterval > 2000) {
        this.spawnInterval -= 100; // Reduce by 100ms each spawn
      }

      // Gradually increase max monsters
      if (this.monstersAlive === this.maxMonsters && this.maxMonsters < 15) {
        this.maxMonsters++;
      }
    }
  }
}

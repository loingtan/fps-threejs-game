import * as THREE from "three";
import Component from "../../Component";
import { Ammo, AmmoHelper, CollisionFilterGroups } from "../../AmmoLib";
import CharacterFSM from "./CharacterFSM";
import MonsterHealthBar from "./MonsterHealthBar";
import ObstacleAvoidance from "./AvoidObstacles"; // Add import for the obstacle avoidance helper

import DebugShapes from "../../DebugShapes";

export default class CharacterController extends Component {
  constructor(model, clips, scene, physicsWorld) {
    super();
    this.name = "CharacterController";
    this.physicsWorld = physicsWorld;
    this.scene = scene;
    this.mixer = null;
    this.clips = clips;
    this.animations = {};
    this.model = model;
    this.dir = new THREE.Vector3();
    this.forwardVec = new THREE.Vector3(0, 0, 1);
    this.pathDebug = new DebugShapes(scene);
    this.path = [];
    this.tempRot = new THREE.Quaternion();
    this.viewAngle = Math.cos(Math.PI / 2.5); // Even wider view angle for better detection
    this.maxViewDistance = 35.0 * 35.0; // Increased view distance further
    this.tempVec = new THREE.Vector3();
    this.attackDistance = 2.2;

    this.canMove = true;
    this.health = 100;
    this.isDying = false; // Flag to prevent multiple death events
    this.obstacleAvoidance = null; // Will be initialized later
    // this.maxHealth = 100;
  }

  SetAnim(name, clip) {
    const action = this.mixer.clipAction(clip);
    this.animations[name] = { clip, action };
  }

  SetupAnimations() {
    Object.keys(this.clips).forEach((key) => {
      this.SetAnim(key, this.clips[key]);
    });
  }
  Initialize() {
    try {
      this.stateMachine = new CharacterFSM(this);
      this.obstacleAvoidance = new ObstacleAvoidance(this.physicsWorld); // Initialize obstacle avoidance

      const levelEntity = this.FindEntity("Level");
      if (levelEntity) {
        this.navmesh = levelEntity.GetComponent("Navmesh");
      }

      this.hitbox = this.GetComponent("AttackTrigger");
      this.player = this.FindEntity("Player");

      // Set health based on monster name/type
      if (this.parent && this.parent.name) {
        if (this.parent.name.includes("Mutant_")) {
          // Normal mutants
          this.health = 100;
        } else if (this.parent.name.includes("Mutant")) {
          // Boss mutant with higher health
          this.health = 150;
        }
      }

      if (this.parent) {
        this.parent.RegisterEventHandler(this.TakeHit, "hit");
      }

      const scene = this.model;
      if (!scene) {
        console.error("No model found for CharacterController");
        return;
      }

      scene.scale.setScalar(0.01);
      if (this.parent && this.parent.position) {
        scene.position.copy(this.parent.position);
      }

      this.mixer = new THREE.AnimationMixer(scene);

      let foundRootBone = false;
      scene.traverse((child) => {
        if (!child.isSkinnedMesh) {
          return;
        }

        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        this.skinnedmesh = child;

        if (child.skeleton && child.skeleton.bones) {
          this.rootBone = child.skeleton.bones.find(
            (bone) => bone.name == "MutantHips"
          );

          if (this.rootBone) {
            foundRootBone = true;
            this.rootBone.refPos = this.rootBone.position.clone();
            this.lastPos = this.rootBone.position.clone();
          } else {
            console.warn("Could not find MutantHips bone in skeleton");
          }
        }
      });
      if (!foundRootBone) {
        console.warn("No root bone found for monster:", this.parent?.name);
      }

      // These operations must be in the try block to access the scene variable
      this.SetupAnimations();
      this.scene.add(scene);
      this.stateMachine.SetState("idle"); // Create physics body for collision with environment
      this.CreatePhysicsBody();

      // Add health bar component with camera reference - ensure it's added properly
      const player = this.FindEntity("Player");
      let camera = null;
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls) {
          camera = controls.camera;
        }
      }
      console.log(
        "Adding health bar to monster:",
        this.parent?.name || "unknown",
        "Camera:",
        camera
      );
      this.healthBar = this.parent.AddComponent(new MonsterHealthBar(camera));

      // Force initial health bar display and update
      if (this.healthBar) {
        console.log("Health bar component added successfully");
        // Give it a moment to initialize, then force show and update the health bar
        setTimeout(() => {
          if (this.healthBar && this.healthBar.container) {
            this.healthBar.container.visible = true;
            this.healthBar.UpdateHealth(this.health); // Force initial health update
            console.log(
              "Forced health bar visibility and health update for monster:",
              this.parent?.name || "unknown",
              "Health:",
              this.health
            );
          }
        }, 100);
      } else {
        console.error(
          "Failed to add health bar component to monster:",
          this.parent?.name || "unknown"
        );
      }

      // Force show health bar initially for testing
      setTimeout(() => {
        if (this.healthBar && this.healthBar.container) {
          this.healthBar.container.visible = true;
          console.log(
            "Health bar should be visible for:",
            this.parent?.name || "unknown"
          );
        }
      }, 1000);
    } catch (error) {
      console.error("Error in CharacterController.Initialize:", error);
    }
  }
  UpdateDirection() {
    this.dir.copy(this.forwardVec);
    this.dir.applyQuaternion(this.parent.rotation);
  }
  CreatePhysicsBody() {
    // Create a cylinder collision shape for the monster
    const radius = 0.5;
    const height = 1.8;
    const shape = new Ammo.btCylinderShape(
      new Ammo.btVector3(radius, height * 0.5, radius)
    );

    // Create transform for initial position
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform
      .getOrigin()
      .setValue(
        this.parent.position.x,
        this.parent.position.y + height * 0.5,
        this.parent.position.z
      );

    // Create motion state
    const motionState = new Ammo.btDefaultMotionState(transform);

    // Create kinematic body (mass = 0 for kinematic)
    const mass = 0;
    const localInertia = new Ammo.btVector3(0, 0, 0);
    const bodyInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    );
    this.physicsBody = new Ammo.btRigidBody(bodyInfo);

    // Set kinematic flags
    const CF_KINEMATIC_OBJECT = 2;
    const DISABLE_DEACTIVATION = 4;
    this.physicsBody.setCollisionFlags(
      this.physicsBody.getCollisionFlags() | CF_KINEMATIC_OBJECT
    );
    this.physicsBody.setActivationState(DISABLE_DEACTIVATION);
    this.physicsBody.setUserPointer(this.parent);

    this.physicsWorld.addRigidBody(this.physicsBody);
  }
  CheckCollision(newPosition) {
    if (!this.physicsBody) return true;

    // Enhanced collision detection with better boundary checking
    const currentPos = this.model.position.clone();
    currentPos.y += 0.9; // Monster center height
    const targetPos = newPosition.clone();
    targetPos.y += 0.9; // Check level boundaries - prevent monsters from going outside the play area
    // Using stricter boundaries to keep monsters well inside the playable area
    const levelBounds = {
      minX: -40, // Tighter boundaries (was -50)
      maxX: 40, // Tighter boundaries (was 50)
      minZ: -40, // Tighter boundaries (was -50)
      maxZ: 40, // Tighter boundaries (was 50)
      minY: 0, // Don't go below ground (was -5)
      maxY: 15, // Lower height limit (was 20)
    };

    if (
      newPosition.x < levelBounds.minX ||
      newPosition.x > levelBounds.maxX ||
      newPosition.z < levelBounds.minZ ||
      newPosition.z > levelBounds.maxZ ||
      newPosition.y < levelBounds.minY ||
      newPosition.y > levelBounds.maxY
    ) {
      console.log(
        "Monster blocked by level boundaries, attempting to move back to safe zone"
      );

      // Instead of just blocking, force the monster to move back inside boundary
      this.ForceReturnToValidArea();
      return false;
    }

    // Validate position with navmesh if available
    if (!this.IsPositionValid(newPosition)) {
      console.log("Monster blocked by navmesh boundaries");
      return false;
    }

    // Create multiple raycasts for more accurate collision detection
    const rayOrigins = [
      currentPos.clone(),
      currentPos.clone().add(new THREE.Vector3(0.3, 0, 0)),
      currentPos.clone().add(new THREE.Vector3(-0.3, 0, 0)),
      currentPos.clone().add(new THREE.Vector3(0, 0, 0.3)),
      currentPos.clone().add(new THREE.Vector3(0, 0, -0.3)),
    ];

    const rayInfo = {
      intersectionPoint: new THREE.Vector3(),
      intersectionNormal: new THREE.Vector3(),
    };
    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    // Check multiple raycasts to detect collisions from different angles
    for (const rayOrigin of rayOrigins) {
      if (
        AmmoHelper.CastRay(
          this.physicsWorld,
          rayOrigin,
          targetPos,
          rayInfo,
          collisionMask
        )
      ) {
        const hitBody = Ammo.castObject(
          rayInfo.collisionObject,
          Ammo.btRigidBody
        );
        const playerBody = this.player?.GetComponent("PlayerPhysics")?.body;

        // Allow movement if we hit the player, but block if we hit level geometry or containers
        if (hitBody && hitBody !== playerBody && hitBody !== this.physicsBody) {
          // Use a smaller distance threshold to improve collision detection with containers
          const distance = rayOrigin.distanceTo(rayInfo.intersectionPoint);
          if (distance < 1.5) {
            console.log("Monster blocked by obstacle at distance:", distance);
            return false;
          }
        }
      }
    }

    // Check for obstacles ahead using a sphere cast
    const movementDirection = targetPos.clone().sub(currentPos).normalize();
    const sphereRadius = 0.6; // Increased monster "width" for better collision detection
    const sphereCastRange = 1.2; // Increased distance ahead to check for obstacles

    // Calculate sphere cast end point
    const sphereEnd = currentPos
      .clone()
      .add(movementDirection.clone().multiplyScalar(sphereCastRange));

    // Create a transform for sphere cast start
    const startTransform = new Ammo.btTransform();
    startTransform.setIdentity();
    startTransform
      .getOrigin()
      .setValue(currentPos.x, currentPos.y, currentPos.z);

    // Create a transform for sphere cast end
    const endTransform = new Ammo.btTransform();
    endTransform.setIdentity();
    endTransform.getOrigin().setValue(sphereEnd.x, sphereEnd.y, sphereEnd.z);

    // Create sphere shape for casting
    const sphereShape = new Ammo.btSphereShape(sphereRadius);

    // Perform sphere cast
    const castResult = new Ammo.btCollisionWorld.ClosestConvexResultCallback(
      startTransform.getOrigin(),
      endTransform.getOrigin()
    );

    // Exclude sensor triggers from collision detection
    castResult.m_collisionFilterMask = collisionMask;

    // Perform convex sweep test
    this.physicsWorld.convexSweepTest(
      sphereShape,
      startTransform,
      endTransform,
      castResult
    );

    // Check if we hit anything
    if (castResult.hasHit()) {
      const hitDistance = castResult.m_closestHitFraction * sphereCastRange;
      if (hitDistance < 0.8) {
        console.log(
          "Monster blocked by obstacle detected in sphere cast, distance:",
          hitDistance
        );
        return false;
      }
    }

    return true;
  }

  CanSeeThePlayer() {
    const playerPos = this.player.Position.clone();
    const modelPos = this.model.position.clone();
    modelPos.y += 1.35;
    const charToPlayer = playerPos.sub(modelPos);

    if (playerPos.lengthSq() > this.maxViewDistance) {
      return;
    }

    charToPlayer.normalize();
    const angle = charToPlayer.dot(this.dir);

    if (angle < this.viewAngle) {
      return false;
    }

    const rayInfo = {};
    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    if (
      AmmoHelper.CastRay(
        this.physicsWorld,
        modelPos,
        this.player.Position,
        rayInfo,
        collisionMask
      )
    ) {
      const body = Ammo.castObject(rayInfo.collisionObject, Ammo.btRigidBody);

      if (body == this.player.GetComponent("PlayerPhysics").body) {
        return true;
      }
    }

    return false;
  }
  NavigateToRandomPoint() {
    // No random patrolling - monsters should stay in place until they see the player
    this.ClearPath();
    return;

    // Original behavior (disabled)
    // const node = this.navmesh.GetRandomNode(this.model.position, 50);
    // this.path = this.navmesh.FindPath(this.model.position, node);
  }

  // New method to check for obstacles in the monster's path
  HasObstacleInPath(fromPosition, toPosition) {
    // Don't check if physics world is not available
    if (!this.physicsWorld) return false;

    const rayInfo = {};
    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    // Cast a ray from the monster to the target position
    if (
      AmmoHelper.CastRay(
        this.physicsWorld,
        fromPosition,
        toPosition,
        rayInfo,
        collisionMask
      )
    ) {
      const hitBody = Ammo.castObject(
        rayInfo.collisionObject,
        Ammo.btRigidBody
      );
      const playerBody = this.player?.GetComponent("PlayerPhysics")?.body;

      // If we hit anything other than the player or self, there's an obstacle
      if (hitBody && hitBody !== playerBody && hitBody !== this.physicsBody) {
        const distance = fromPosition.distanceTo(rayInfo.intersectionPoint);
        if (distance < toPosition.distanceTo(fromPosition)) {
          // Obstacle detected before reaching target
          return true;
        }
      }
    }

    return false;
  }
  IsPositionValid(position) {
    if (!this.navmesh) return true; // If no navmesh, allow movement

    try {
      // Check if position is within navmesh bounds
      const groupID = this.navmesh.pathfinding.getGroup(
        this.navmesh.zone,
        position
      );
      return groupID !== null && groupID !== undefined;
    } catch (error) {
      // If navmesh check fails, allow movement to prevent monsters getting stuck
      console.warn("Navmesh validation failed, allowing movement:", error);
      return true;
    }
  }
  NavigateToPlayer() {
    const player = this.FindEntity("Player");
    if (!player) {
      console.warn("Player not found");
      return;
    }

    // FIX: Thay vì tìm EntityManager, dùng pathfinding trực tiếp
    if (!this.navmesh) {
      console.warn("Navmesh not found for navigation");
      return;
    }

    const playerPosition = player.Position;
    const currentPosition = this.parent.Position;

    // Calculate simple direct path
    const direction = new THREE.Vector3()
      .subVectors(playerPosition, currentPosition)
      .normalize();

    // Move towards player with improved pathfinding
    const moveDistance = 5.0;

    // Try to find a better path using navmesh
    const targetPosition = currentPosition
      .clone()
      .add(direction.multiplyScalar(moveDistance));

    // Check if path is valid and doesn't go through obstacles
    if (this.IsPositionValid(targetPosition)) {
      // Create additional waypoints to better navigate around obstacles
      this.path = [currentPosition.clone()];

      // Try to generate a series of waypoints to player
      try {
        const navPath = this.navmesh.FindPath(currentPosition, playerPosition);
        if (navPath && navPath.length > 0) {
          this.path = navPath;
          console.log(
            `Monster ${this.parent.name} using navmesh path to player`
          );
        } else {
          // Fallback to direct path if navmesh path failed
          this.path.push(targetPosition);
          console.log(
            `Monster ${this.parent.name} using direct path to player`
          );
        }
      } catch (e) {
        // If navmesh pathing fails, use direct path
        this.path.push(targetPosition);
        console.log(
          `Monster ${this.parent.name} using direct path to player (navmesh error)`
        );
      }
    } else {
      // If we can't move directly to the player, try to find another valid position
      console.log(
        `Monster ${this.parent.name} cannot directly navigate to player, finding alternative`
      );
      this.NavigateToRandomPoint();
    }
  }

  // THÊM: Backup method nếu cần EntityManager
  FindEntityManager() {
    // Thử tìm qua parent chain
    let current = this.parent;
    while (current) {
      if (current.entityManager) {
        return current.entityManager;
      }
      current = current.parent;
    }

    // Thử tìm qua global app
    if (window._APP && window._APP.entityManager) {
      return window._APP.entityManager;
    }

    return null;
  }

  FacePlayer(t, rate = 3.0) {
    this.tempVec.copy(this.player.Position).sub(this.model.position);
    this.tempVec.y = 0.0;
    this.tempVec.normalize();

    this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
    this.model.quaternion.rotateTowards(this.tempRot, rate * t);
  }

  get IsCloseToPlayer() {
    this.tempVec.copy(this.player.Position).sub(this.model.position);

    if (this.tempVec.lengthSq() <= this.attackDistance * this.attackDistance) {
      return true;
    }

    return false;
  }

  get IsPlayerInHitbox() {
    return this.hitbox.overlapping;
  }

  HitPlayer() {
    this.player.Broadcast({ topic: "hit" });
  }
  TakeHit = (msg) => {
    // Default damage amount if not specified
    const amount = msg.amount || 10;
    this.health = Math.max(0, this.health - amount);

    console.log(
      `Monster ${this.parent.name} took ${amount} damage, health now: ${this.health}`
    );

    if (this.healthBar) {
      console.log("Updating existing health bar");
      this.healthBar.UpdateHealth(this.health);
    } else {
      console.warn(
        "Health bar component not found for monster:",
        this.parent.name
      );
      const player = this.FindEntity("Player");
      let camera = null;
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls) {
          camera = controls.camera;
        }
      }

      this.healthBar = this.parent.AddComponent(new MonsterHealthBar(camera));
      if (this.healthBar) {
        console.log("Re-added health bar component, updating health");
        setTimeout(() => {
          if (this.healthBar) {
            this.healthBar.UpdateHealth(this.health);
          }
        }, 50);
      }
    }
    if (this.health == 0 && !this.isDying) {
      // Set the isDying flag to prevent multiple death events
      this.isDying = true;

      this.stateMachine.SetState("dead");
      // Make the health bar disappear instantly when dead
      if (this.healthBar && this.healthBar.container) {
        this.healthBar.container.visible = false;
      }

      console.log("Monster died! Attempting to broadcast monster_death event");

      // First try to get the entityManager directly from the parent
      let entityManager = null;

      if (this.parent && this.parent.entityManager) {
        entityManager = this.parent.entityManager;
        console.log("Found entityManager directly on parent");
      } else if (this.FindEntity && this.FindEntity("Level")) {
        const level = this.FindEntity("Level");
        if (level && level.entityManager) {
          entityManager = level.entityManager;
          console.log("Found entityManager on Level entity");
        }
      }
      if (entityManager && entityManager.BroadcastGlobalEvent) {
        // Ensure monster has a unique name and ID if it doesn't already
        if (!this.parent.name) {
          const uniqueId = `Monster_${Date.now()}_${Math.floor(
            Math.random() * 10000
          )}`;
          this.parent.SetName(uniqueId);
        }

        // Add a unique ID property if not present
        if (!this.parent.id) {
          this.parent.id = `${this.parent.name}_${Date.now()}`;
        }

        console.log(
          "Broadcasting monster_death event from:",
          this.parent.name,
          "with ID:",
          this.parent.id
        );
        // Broadcast event only once through the entity manager
        entityManager.BroadcastGlobalEvent({
          type: "monster_death",
          monster: this.parent,
        });
      } else {
        console.error(
          "Cannot broadcast monster_death event, entityManager not found"
        );
        // No direct fallback to UIManager to avoid duplicate score counting
      }
      console.log(`Monster ${this.parent.name} has died, removing from scene`);
      setTimeout(() => {
        this.CleanupResources();

        if (this.parent && this.parent.entityManager) {
          this.parent.entityManager.Remove(this.parent);
        }
      }, 2000);
    } else {
      // Always switch to chase when hit by player, regardless of current state
      // This makes monsters more responsive to player attacks
      if (this.stateMachine) {
        console.log(`Monster ${this.parent.name} was hit, now chasing player`);
        this.stateMachine.SetState("chase");

        // Immediately clear and set path to chase player when hit
        this.NavigateToPlayer();
      }
    }
  };

  // THÊM: Method tính điểm khi giết quái
  CalculateKillScore() {
    console.log("=== CALCULATING KILL SCORE ===");

    const player = this.FindEntity("Player");
    if (!player) {
      console.warn("Player not found for score calculation");
      return;
    }
    const playerHealth = player.GetComponent("PlayerHealth");
    if (!playerHealth) {
      console.warn("PlayerHealth component not found for score calculation");
      return;
    }

    // Updated score formula: current character health * 0.5 + 1
    const currentHealth = playerHealth.health || 0;
    const scoreEarned = Math.floor(currentHealth * 0.5 + 1);
    const playerHealthPercent = playerHealth.GetHealthPercent();

    console.log(
      `Player health: ${currentHealth}/${playerHealth.maxHealth} (${(
        playerHealthPercent * 100
      ).toFixed(1)}%)`
    );
    console.log(
      `Score earned for killing ${
        this.parent.name
      }: ${scoreEarned} points (calculated as: ${currentHealth} * 0.5 + 1 = ${
        currentHealth * 0.5 + 1
      })`
    );

    // SỬA: Broadcast qua entity manager
    const eventData = {
      type: "monster_killed",
      scoreEarned: scoreEarned,
      playerHealthPercent: playerHealthPercent,
      monsterName: this.parent.name,
    };

    console.log("Broadcasting event:", eventData);

    // Thử cả 2 cách
    if (this.parent && this.parent.entityManager) {
      this.parent.entityManager.BroadcastGlobalEvent(eventData);
      console.log("Event broadcasted via entityManager");
    }

    // Backup: Direct call to UIManager
    const uiEntity = this.FindEntity("UIManager");
    if (uiEntity) {
      const uiManager = uiEntity.GetComponent("UIManager");
      if (uiManager && uiManager.OnMonsterKilled) {
        uiManager.OnMonsterKilled(eventData);
        console.log("Event sent directly to UIManager");
      }
    }
  }
  MoveAlongPath(t) {
    // Check if path exists and has elements, also verify model exists
    if (!this.path?.length || !this.model || !this.model.position) return;

    // Check for nearby monsters to avoid overlapping during movement
    let avoidanceFactor = new THREE.Vector3(0, 0, 0);
    const myPos = this.model.position.clone();

    // Find all monsters in the scene for avoidance
    if (this.parent.entityManager) {
      const entities = Object.values(this.parent.entityManager.entities);
      for (const entity of entities) {
        // Skip if it's this monster or not a monster
        if (entity === this.parent || !entity.name.includes("Mutant")) {
          continue;
        }

        const monsterController = entity.GetComponent("CharacterController");
        if (!monsterController) continue;

        const otherPos = monsterController.model.position.clone();
        const distanceToOtherMonster = myPos.distanceTo(otherPos);

        // If another monster is too close, add a stronger avoidance vector
        if (distanceToOtherMonster < 3.0) {
          const avoidanceDirection = myPos.clone().sub(otherPos).normalize();
          const strength = 1.0 - distanceToOtherMonster / 3.0; // Stronger as they get closer
          avoidanceFactor.add(
            avoidanceDirection.multiplyScalar(strength * 0.6) // Increased strength
          );
        }
      }
    }

    // Check for obstacles in the scene
    const obstacleAvoidance = this.AvoidObstacles(myPos);
    avoidanceFactor.add(obstacleAvoidance);

    const target = this.path[0].clone().sub(this.model.position);
    target.y = 0.0;

    if (target.lengthSq() > 0.1 * 0.1) {
      target.normalize();
      this.tempRot.setFromUnitVectors(this.forwardVec, target);
      this.model.quaternion.slerp(this.tempRot, 4.0 * t);

      if (this.canMove) {
        // Slower walking speed, faster chase speed
        const speed =
          this.stateMachine.currentState.Name === "chase" ? 0.12 : 0.06;

        // Apply avoidance to prevent overlapping
        let movement = target.clone();

        // Add avoidance factor if there are nearby monsters or obstacles
        if (avoidanceFactor.lengthSq() > 0) {
          movement.add(avoidanceFactor);
          movement.normalize();
        } // Make monsters move more slowly to avoid passing through objects
        // Further reduced movement speed for better collision handling
        const reducedSpeed =
          this.stateMachine.currentState.Name === "chase" ? 0.06 : 0.03;
        movement.multiplyScalar(reducedSpeed);

        // Store original position before movement attempt
        const originalPosition = this.model.position.clone();

        // Try to move with enhanced validation and slower smaller steps
        // This helps prevent monsters from going through obstacles
        const newPosition = originalPosition.clone().add(movement);

        // Do a more thorough collision check before moving
        const canMove = this.CheckCollision(newPosition);

        if (canMove) {
          this.model.position.add(movement);
        } else {
          // More advanced collision handling
          // Try 8 different directions with varying angles
          const attemptDirections = [];
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            attemptDirections.push(
              movement
                .clone()
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
                .multiplyScalar(0.7) // Reduced step size for safer movement
            );
          }

          // Try each alternative direction
          let moved = false;
          for (const altMovement of attemptDirections) {
            const altPosition = originalPosition.clone().add(altMovement);
            if (this.CheckCollision(altPosition)) {
              this.model.position.add(altMovement);
              moved = true;
              break;
            }
          }

          // If still can't move, try a very small step
          if (!moved) {
            const tinyStep = movement.clone().multiplyScalar(0.2);
            const tinyPosition = originalPosition.clone().add(tinyStep);
            if (this.CheckCollision(tinyPosition)) {
              this.model.position.add(tinyStep);
            } else {
              // If completely stuck, force return to valid area
              console.log(
                "Monster completely stuck, trying to find valid area"
              );
              this.ForceReturnToValidArea();
            }
          }
        }
      }
    } else {
      // Remove node from the path we calculated
      this.path.shift();
      if (this.path.length === 0) {
        this.Broadcast({ topic: "nav.end", agent: this });
      }
    }
  }
  // New method to detect and avoid scene obstacles like containers
  AvoidObstacles(position) {
    const avoidanceVector = new THREE.Vector3();
    const raycastOrigins = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.7, 0, 0.7),
      new THREE.Vector3(0.7, 0, -0.7),
      new THREE.Vector3(-0.7, 0, 0.7),
      new THREE.Vector3(-0.7, 0, -0.7),
    ];

    const rayInfo = {
      intersectionPoint: new THREE.Vector3(),
      intersectionNormal: new THREE.Vector3(),
    };

    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    // Cast rays in 8 directions to detect obstacles
    for (const direction of raycastOrigins) {
      const rayOrigin = position.clone();
      rayOrigin.y += 0.9; // Monster's center height

      const rayTarget = rayOrigin
        .clone()
        .add(direction.clone().multiplyScalar(2.0));

      if (
        AmmoHelper.CastRay(
          this.physicsWorld,
          rayOrigin,
          rayTarget,
          rayInfo,
          collisionMask
        )
      ) {
        const hitBody = Ammo.castObject(
          rayInfo.collisionObject,
          Ammo.btRigidBody
        );
        const playerBody = this.player?.GetComponent("PlayerPhysics")?.body;

        // If it's an obstacle (not player or self)
        if (hitBody && hitBody !== playerBody && hitBody !== this.physicsBody) {
          const distance = rayOrigin.distanceTo(rayInfo.intersectionPoint);

          // Only care about close obstacles
          if (distance < 1.8) {
            // Add avoidance force opposite to the obstacle
            const strength = 1.0 - distance / 1.8;
            const avoidDir = rayOrigin
              .clone()
              .sub(rayInfo.intersectionPoint)
              .normalize();
            avoidanceVector.add(avoidDir.multiplyScalar(strength * 0.8));
          }
        }
      }
    }

    return avoidanceVector;
  }

  ClearPath() {
    if (this.path) {
      this.path.length = 0;
    }
  }
  ApplyRootMotion() {
    // Check if rootBone exists before trying to access its properties
    if (!this.rootBone || !this.lastPos) {
      return;
    }

    if (this.canMove) {
      const vel = this.rootBone.position.clone();
      vel.sub(this.lastPos).multiplyScalar(0.01);
      vel.y = 0;

      vel.applyQuaternion(this.model.quaternion);

      if (vel.lengthSq() < 0.1 * 0.1) {
        this.model.position.add(vel);
      }
    }

    //Reset the root bone horizontal position
    this.lastPos.copy(this.rootBone.position);

    // Make sure refPos exists before accessing it
    if (this.rootBone.refPos) {
      this.rootBone.position.z = this.rootBone.refPos.z;
      this.rootBone.position.x = this.rootBone.refPos.x;
    }
  }
  Update(t) {
    try {
      // Check for required components before updating
      if (!this.model || !this.parent) {
        return;
      }

      // Update animation mixer if it exists
      if (this.mixer) {
        this.mixer.update(t);
      }

      this.ApplyRootMotion();

      // Only call these methods if we have the necessary components
      if (this.dir) {
        this.UpdateDirection();
      }

      if (this.path) {
        this.MoveAlongPath(t);
      }

      if (this.stateMachine) {
        this.stateMachine.Update(t);
      }

      // Update parent entity's rotation and position
      if (this.model.quaternion && this.model.position) {
        this.parent.SetRotation(this.model.quaternion);
        this.parent.SetPosition(this.model.position);
      }

      // Update physics body position if it exists
      if (this.physicsBody && this.model && this.model.position) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform
          .getOrigin()
          .setValue(
            this.model.position.x,
            this.model.position.y + 0.9,
            this.model.position.z
          );
        this.physicsBody.setWorldTransform(transform);
      }
    } catch (error) {
      console.error("Error in CharacterController.Update:", error);
    }
  }

  CleanupResources() {
    try {
      // Stop all animations
      if (this.mixer) {
        this.mixer.stopAllAction();
      }

      // Clear path
      if (this.path) {
        this.path.length = 0;
      }

      // Remove physics body
      if (this.physicsBody && this.physicsWorld) {
        this.physicsWorld.removeRigidBody(this.physicsBody);
        this.physicsBody = null;
      }

      // Clear references
      this.rootBone = null;
      this.lastPos = null;
      this.skinnedmesh = null; // Remove model from scene if it exists
      if (this.model && this.scene) {
        this.scene.remove(this.model);
      }

      // Clean up other components
      const characterCollision =
        this.parent?.GetComponent("CharacterCollision");
      if (
        characterCollision &&
        typeof characterCollision.CleanupCollisions === "function"
      ) {
        characterCollision.CleanupCollisions();
      }

      // Clean up attack trigger
      const attackTrigger = this.parent?.GetComponent("AttackTrigger");
      if (attackTrigger && attackTrigger.ghostObj && this.physicsWorld) {
        try {
          this.physicsWorld.removeCollisionObject(attackTrigger.ghostObj);
          attackTrigger.ghostObj = null;
        } catch (err) {
          console.warn("Error cleaning up attack trigger:", err);
        }
      }

      console.log(
        `Resources cleaned up for monster: ${this.parent?.name || "unknown"}`
      );
    } catch (error) {
      console.error("Error cleaning up monster resources:", error);
    }
  }

  // Force monster to return to valid play area if it wanders out of bounds
  ForceReturnToValidArea() {
    // Only proceed if we have a valid model position
    if (!this.model || !this.model.position) return;

    // Define safe boundaries (smaller than check boundaries to ensure return to safe area)
    const safeBounds = {
      minX: -30,
      maxX: 30,
      minZ: -30,
      maxZ: 30,
      minY: 1,
      maxY: 10,
    };

    // Get current position
    const currentPos = this.model.position.clone();

    // Create a target position that's within safe bounds
    const safePos = new THREE.Vector3(
      Math.max(safeBounds.minX, Math.min(currentPos.x, safeBounds.maxX)),
      Math.max(safeBounds.minY, Math.min(currentPos.y, safeBounds.maxY)),
      Math.max(safeBounds.minZ, Math.min(currentPos.z, safeBounds.maxZ))
    );

    // If we're already in safe bounds, try to move toward map center
    if (safePos.distanceTo(currentPos) < 0.1) {
      // Move toward map center
      const centerDirection = new THREE.Vector3(0, 1, 0)
        .sub(currentPos)
        .normalize();
      safePos.add(centerDirection.multiplyScalar(5));
    }

    // Calculate direction toward safe position
    const direction = safePos.clone().sub(currentPos).normalize();

    // Set a new path to return to safe area
    this.path = [currentPos.clone(), safePos];
    console.log(
      `Monster ${
        this.parent?.name || "unknown"
      } returning to safe area at ${safePos.x.toFixed(1)}, ${safePos.y.toFixed(
        1
      )}, ${safePos.z.toFixed(1)}`
    );
  }
}

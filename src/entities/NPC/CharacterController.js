import * as THREE from "three";
import Component from "../../Component";
import { Ammo, AmmoHelper, CollisionFilterGroups } from "../../AmmoLib";
import CharacterFSM from "./CharacterFSM";
import MonsterHealthBar from "./MonsterHealthBar";

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
    targetPos.y += 0.9;

    // Check level boundaries - prevent monsters from going outside the play area
    const levelBounds = {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50,
      minY: -5,
      maxY: 20,
    };

    if (
      newPosition.x < levelBounds.minX ||
      newPosition.x > levelBounds.maxX ||
      newPosition.z < levelBounds.minZ ||
      newPosition.z > levelBounds.maxZ ||
      newPosition.y < levelBounds.minY ||
      newPosition.y > levelBounds.maxY
    ) {
      console.log("Monster blocked by level boundaries");
      return false;
    }

    // Validate position with navmesh if available
    if (!this.IsPositionValid(newPosition)) {
      console.log("Monster blocked by navmesh boundaries");
      return false;
    }

    const rayInfo = {
      intersectionPoint: new THREE.Vector3(),
      intersectionNormal: new THREE.Vector3(),
    };
    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    // Cast ray from current position to new position
    if (
      AmmoHelper.CastRay(
        this.physicsWorld,
        currentPos,
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

      // Allow movement if we hit the player, but block if we hit level geometry
      if (hitBody && hitBody !== playerBody && hitBody !== this.physicsBody) {
        // Check if the collision is close enough to matter
        const distance = currentPos.distanceTo(rayInfo.intersectionPoint);
        if (distance < 1.0) {
          // Stricter collision detection
          console.log("Monster blocked by obstacle at distance:", distance);
          return false;
        }
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
    const node = this.navmesh.GetRandomNode(this.model.position, 50);
    this.path = this.navmesh.FindPath(this.model.position, node);
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
    if (!this.player) {
      console.error("Player not found in NavigateToPlayer");
      return;
    }

    this.tempVec.copy(this.player.Position);
    this.tempVec.y = 0.5;

    // Log distance to player to debug
    const distanceToPlayer = this.model.position.distanceTo(this.tempVec);
    // console.log(`Monster ${this.parent.name} distance to player: ${distanceToPlayer}`);

    // Check for nearby monsters to avoid overlapping
    const myPos = this.model.position.clone();
    let nearbyMonster = false;

    // Find all monsters in the scene
    if (!this.parent.entityManager) {
      console.warn("EntityManager not found");
      return;
    }
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

      // If another monster is too close
      if (distanceToOtherMonster < 3.0) {
        nearbyMonster = true;
        break;
      }
    }

    // Direct path for close distances or if navmesh returns null
    if (distanceToPlayer < 10 && !nearbyMonster) {
      // Direct path when no other monsters are nearby
      this.path = [this.tempVec.clone()];
    } else if (nearbyMonster || distanceToPlayer < 5) {
      // If other monsters nearby, calculate an offset position around the player
      const angle = (this.parent.id * 72) % 360; // Different angle for each monster
      const offset = new THREE.Vector3(
        Math.cos((angle * Math.PI) / 180) * 3,
        0,
        Math.sin((angle * Math.PI) / 180) * 3
      );

      const offsetTarget = this.tempVec.clone().add(offset);
      this.path = [offsetTarget];
    } else {
      // For longer distances, try navmesh pathfinding
      if (!this.navmesh) {
        console.error("Navmesh not found for monster:", this.parent.name);
        this.path = [this.tempVec.clone()]; // Fallback to direct path
        return;
      }

      const navPath = this.navmesh.FindPath(this.model.position, this.tempVec);

      // If navmesh fails or returns empty path, use direct path
      if (!navPath || navPath.length === 0) {
        this.path = [this.tempVec.clone()];
      } else {
        this.path = navPath;
      }
    }

    // Force path update - ensure we always have at least one target point
    if (!this.path || this.path.length === 0) {
      this.path = [this.tempVec.clone()];
    }

    // Debug path visualization
    /*
        if(this.path){
            this.pathDebug.Clear();
            for(const point of this.path){
                this.pathDebug.AddPoint(point, "blue");
            }
        }
        */
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

    if (this.health == 0) {
      this.stateMachine.SetState("dead");
      // Make the health bar disappear instantly when dead
      if (this.healthBar && this.healthBar.container) {
        this.healthBar.container.visible = false;
      } // Try to get entityManager from various possible sources
      const entityManager =
        (this.parent && this.parent.entityManager) ||
        (this.parent && this.parent.parent) ||
        (this.FindEntity &&
          this.FindEntity("UIManager") &&
          this.FindEntity("UIManager").parent);

      if (entityManager && entityManager.BroadcastGlobalEvent) {
        console.log("Broadcasting monster_death event from:", this.parent.name);
        entityManager.BroadcastGlobalEvent({
          type: "monster_death",
          monster: this.parent,
        });
      } else {
        console.error(
          "Cannot broadcast monster_death event, entityManager not found"
        );
        // Try direct access to UIManager as fallback
        const uiManager = this.FindEntity("UIManager");
        if (uiManager) {
          const uiManagerComponent = uiManager.GetComponent("UIManager");
          if (uiManagerComponent && uiManagerComponent.AddScore) {
            console.log(
              "Direct fallback: adding score via UIManager component"
            );
            uiManagerComponent.AddScore(1);
          }
        }
      }
      console.log(`Monster ${this.parent.name} has died, removing from scene`);
      setTimeout(() => {
        this.CleanupResources();

        if (this.parent && this.parent.entityManager) {
          this.parent.entityManager.Remove(this.parent);
        }
      }, 2000);
    } else {
      const stateName = this.stateMachine.currentState.Name;
      if (stateName == "idle" || stateName == "patrol") {
        this.stateMachine.SetState("chase");
      }
    }
  };
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

        // If another monster is too close, add an avoidance vector
        if (distanceToOtherMonster < 2.0) {
          const avoidanceDirection = myPos.clone().sub(otherPos).normalize();
          const strength = 1.0 - distanceToOtherMonster / 2.0; // Stronger as they get closer
          avoidanceFactor.add(
            avoidanceDirection.multiplyScalar(strength * 0.3)
          );
        }
      }
    }

    const target = this.path[0].clone().sub(this.model.position);
    target.y = 0.0;

    if (target.lengthSq() > 0.1 * 0.1) {
      target.normalize();
      this.tempRot.setFromUnitVectors(this.forwardVec, target);
      this.model.quaternion.slerp(this.tempRot, 4.0 * t); // Add direct movement to actually move the model towards target
      if (this.canMove) {
        const speed =
          this.stateMachine.currentState.Name === "chase" ? 0.15 : 0.08; // Increased chase speed

        // Apply avoidance to prevent overlapping
        let movement = target.clone();

        // Add avoidance factor if there are nearby monsters
        if (avoidanceFactor.lengthSq() > 0) {
          movement.add(avoidanceFactor);
          movement.normalize();
        }

        movement.multiplyScalar(speed);

        // Try to move with enhanced validation
        const newPosition = this.model.position.clone().add(movement);

        // Use stricter validation for better boundary control
        const canMove = this.CheckCollision(newPosition);

        if (canMove) {
          this.model.position.add(movement);
        } else {
          // If blocked, try alternative movement directions
          const alternatives = [
            movement.clone().multiplyScalar(0.5), // Smaller step
            movement
              .clone()
              .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), // Turn right
            movement
              .clone()
              .applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4), // Turn left
          ];

          for (const altMovement of alternatives) {
            const altPosition = this.model.position.clone().add(altMovement);
            if (this.CheckCollision(altPosition)) {
              this.model.position.add(altMovement);
              break;
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
}

import * as THREE from "three";
import { CollisionFilterGroups, Ammo } from "../../AmmoLib";

// A helper class to handle obstacle avoidance logic for monsters
export default class ObstacleAvoidance {
  constructor(physicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  // Check if a position is valid for the monster to move to
  checkCollision(currentPos, newPosition, physicsBody, player) {
    if (!physicsBody) return true;

    // Enhanced collision detection with better boundary checking
    const origin = currentPos.clone();
    origin.y += 0.9; // Monster center height
    const target = newPosition.clone();
    target.y += 0.9;

    // Using stricter boundaries to keep monsters well inside the playable area
    const levelBounds = {
      minX: -40,
      maxX: 40,
      minZ: -40,
      maxZ: 40,
      minY: 0,
      maxY: 15,
    };

    // Check level boundaries
    if (
      newPosition.x < levelBounds.minX ||
      newPosition.x > levelBounds.maxX ||
      newPosition.z < levelBounds.minZ ||
      newPosition.z > levelBounds.maxZ ||
      newPosition.y < levelBounds.minY ||
      newPosition.y > levelBounds.maxY
    ) {
      return false;
    }

    // Create multiple raycasts for more accurate collision detection
    const rayOrigins = [
      origin.clone(),
      origin.clone().add(new THREE.Vector3(0.3, 0, 0)),
      origin.clone().add(new THREE.Vector3(-0.3, 0, 0)),
      origin.clone().add(new THREE.Vector3(0, 0, 0.3)),
      origin.clone().add(new THREE.Vector3(0, 0, -0.3)),
    ];

    const rayInfo = {
      intersectionPoint: new THREE.Vector3(),
      intersectionNormal: new THREE.Vector3(),
    };

    const collisionMask =
      CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    // Check multiple raycasts to detect collisions from different angles
    for (const rayOrigin of rayOrigins) {
      if (this.castRay(rayOrigin, target, rayInfo, collisionMask)) {
        const hitBody = Ammo.castObject(
          rayInfo.collisionObject,
          Ammo.btRigidBody
        );

        const playerBody = player?.GetComponent("PlayerPhysics")?.body;

        // Allow movement if we hit the player, but block if we hit level geometry or containers
        if (hitBody && hitBody !== playerBody && hitBody !== physicsBody) {
          // Use a smaller distance threshold to improve collision detection with containers
          const distance = rayOrigin.distanceTo(rayInfo.intersectionPoint);
          if (distance < 1.5) {
            return false;
          }
        }
      }
    }

    return true;
  }

  // Cast a ray to check for obstacles
  castRay(start, end, rayInfo, collisionMask) {
    return this.physicsWorld
      ? Ammo.castRay(this.physicsWorld, start, end, rayInfo, collisionMask)
      : false;
  }

  // Get avoidance vector to steer around obstacles
  getAvoidanceVector(position, player, physicsBody) {
    if (!this.physicsWorld) return new THREE.Vector3();

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
        .add(direction.clone().multiplyScalar(2.5)); // Increased detection range

      if (
        Ammo.castRay(
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
        const playerBody = player?.GetComponent("PlayerPhysics")?.body;

        // If it's an obstacle (not player or self)
        if (hitBody && hitBody !== playerBody && hitBody !== physicsBody) {
          const distance = rayOrigin.distanceTo(rayInfo.intersectionPoint);

          // Only care about close obstacles - increased detection radius
          if (distance < 2.2) {
            // Add avoidance force opposite to the obstacle
            const strength = 1.2 - distance / 2.2; // Increased strength
            const avoidDir = rayOrigin
              .clone()
              .sub(rayInfo.intersectionPoint)
              .normalize();
            avoidanceVector.add(avoidDir.multiplyScalar(strength));
          }
        }
      }
    }

    return avoidanceVector;
  }
}

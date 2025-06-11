import * as THREE from "three";
import Component from "../../Component";
import { Ammo, AmmoHelper } from "../../AmmoLib";

export default class CharacterCollision extends Component {
  constructor(physicsWorld) {
    super();
    this.world = physicsWorld;
    this.bonePos = new THREE.Vector3();
    this.boneRot = new THREE.Quaternion();
    this.globalRot = new Ammo.btQuaternion();

    this.collisions = {
      MutantLeftArm: {
        rotation: { x: -0.1, y: 0.0, z: Math.PI * 0.5 },
        position: { x: 0.13, y: -0.04, z: 0.0 },
        radius: 0.13,
        height: 0.13,
      },
      MutantLeftForeArm: {
        rotation: { x: -0.1, y: 0.0, z: Math.PI * 0.5 },
        position: { x: 0.3, y: 0.0, z: -0.05 },
        radius: 0.2,
        height: 0.3,
      },
      MutantRightArm: {
        rotation: { x: 0.1, y: 0.0, z: Math.PI * 0.5 },
        position: { x: -0.13, y: -0.04, z: 0.0 },
        radius: 0.13,
        height: 0.13,
      },
      MutantRightForeArm: {
        rotation: { x: 0.1, y: 0.0, z: Math.PI * 0.5 },
        position: { x: -0.3, y: 0.0, z: -0.05 },
        radius: 0.2,
        height: 0.3,
      },
      MutantSpine: {
        rotation: { x: 0.0, y: 0.0, z: 0.0 },
        position: { x: 0.0, y: 0.25, z: 0.0 },
        radius: 0.25,
        height: 0.5,
      },
      MutantLeftUpLeg: {
        rotation: { x: -0.1, y: 0.0, z: 0.1 },
        position: { x: -0.02, y: -0.12, z: 0.0 },
        radius: 0.16,
        height: 0.24,
      },
      MutantRightUpLeg: {
        rotation: { x: -0.1, y: 0.0, z: -0.1 },
        position: { x: 0.02, y: -0.12, z: 0.0 },
        radius: 0.16,
        height: 0.24,
      },
      MutantLeftLeg: {
        rotation: { x: 0.13, y: 0.0, z: 0.0 },
        position: { x: 0.02, y: -0.12, z: 0.0 },
        radius: 0.14,
        height: 0.24,
      },
      MutantRightLeg: {
        rotation: { x: 0.13, y: 0.0, z: 0.0 },
        position: { x: -0.02, y: -0.12, z: 0.0 },
        radius: 0.14,
        height: 0.24,
      },
    };
  }
  Initialize() {
    try {
      this.controller = this.GetComponent("CharacterController");

      if (!this.controller || !this.controller.model) {
        console.error("CharacterCollision: Controller or model not found");
        return;
      }

      this.controller.model.traverse((child) => {
        if (!child.isSkinnedMesh) {
          return;
        }

        this.mesh = child;
      });

      if (!this.mesh || !this.mesh.skeleton || !this.mesh.skeleton.bones) {
        console.error("CharacterCollision: Mesh or skeleton not found");
        return;
      }

      Object.keys(this.collisions).forEach((key) => {
        try {
          const collision = this.collisions[key];

          collision.bone = this.mesh.skeleton.bones.find(
            (bone) => bone.name == key
          );

          if (!collision.bone) {
            console.warn(
              `CharacterCollision: Bone ${key} not found in skeleton`
            );
            return; // Skip this collision
          }

          const shape = new Ammo.btCapsuleShape(
            collision.radius,
            collision.height
          );
          collision.object = AmmoHelper.CreateTrigger(shape);
          collision.object.parentEntity = this.parent;

          const localRot = new Ammo.btQuaternion();
          localRot.setEulerZYX(
            collision.rotation.z,
            collision.rotation.y,
            collision.rotation.x
          );
          collision.localTransform = new Ammo.btTransform();
          collision.localTransform.setIdentity();
          collision.localTransform.setRotation(localRot);
          collision.localTransform
            .getOrigin()
            .setValue(
              collision.position.x,
              collision.position.y,
              collision.position.z
            );

          if (this.world) {
            this.world.addCollisionObject(collision.object);
          } else {
            console.warn(
              "CharacterCollision: Physics world not available, collision not added"
            );
          }
        } catch (err) {
          console.warn(`Error setting up collision for bone ${key}:`, err);
        }
      });
    } catch (error) {
      console.error("Error in CharacterCollision.Initialize:", error);
    }
  }
  Update(t) {
    if (!this.collisions || !this.mesh) {
      return;
    }

    try {
      Object.keys(this.collisions).forEach((key) => {
        const collision = this.collisions[key];

        // Check if collision object and bone exist
        if (!collision || !collision.object || !collision.bone) {
          return; // Skip this collision
        }

        try {
          const transform = collision.object.getWorldTransform();

          collision.bone.getWorldPosition(this.bonePos);
          collision.bone.getWorldQuaternion(this.boneRot);

          this.globalRot.setValue(
            this.boneRot.x,
            this.boneRot.y,
            this.boneRot.z,
            this.boneRot.w
          );
          transform
            .getOrigin()
            .setValue(this.bonePos.x, this.bonePos.y, this.bonePos.z);
          transform.setRotation(this.globalRot);

          if (collision.localTransform) {
            transform.op_mul(collision.localTransform);
          }
        } catch (err) {
          console.warn(`Error updating collision for bone ${key}:`, err);
        }
      });
    } catch (error) {
      console.error("Error in CharacterCollision.Update:", error);
    }
  }

  CleanupCollisions() {
    try {
      if (!this.collisions || !this.world) {
        return;
      }

      Object.keys(this.collisions).forEach((key) => {
        const collision = this.collisions[key];
        if (collision && collision.object) {
          // Remove collision object from the world
          this.world.removeCollisionObject(collision.object);
          collision.object = null;
        }

        // Clear transform references
        if (collision && collision.localTransform) {
          collision.localTransform = null;
        }
      });

      console.log("CharacterCollision: Cleaned up collision objects");
    } catch (error) {
      console.error("Error cleaning up collisions:", error);
    }
  }

  OnDestroy() {
    this.CleanupCollisions();
    this.mesh = null;
    this.controller = null;
  }
}

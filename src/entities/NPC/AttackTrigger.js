import Component from "../../Component";
import { Ammo, AmmoHelper, CollisionFilterGroups } from "../../AmmoLib";

export default class AttackTrigger extends Component {
  constructor(physicsWorld) {
    super();
    this.name = "AttackTrigger";
    this.physicsWorld = physicsWorld;

    //Relative to parent
    this.localTransform = new Ammo.btTransform();
    this.localTransform.setIdentity();
    this.localTransform.getOrigin().setValue(0.0, 1.0, 1.0);

    this.quat = new Ammo.btQuaternion();

    this.overlapping = false;
  }
  SetupTrigger() {
    try {
      const shape = new Ammo.btSphereShape(0.4);
      this.ghostObj = AmmoHelper.CreateTrigger(shape);

      if (this.physicsWorld && this.ghostObj) {
        this.physicsWorld.addCollisionObject(
          this.ghostObj,
          CollisionFilterGroups.SensorTrigger
        );
        console.log(
          "AttackTrigger: Successfully created trigger for",
          this.parent?.name || "unknown entity"
        );
      } else {
        console.error(
          "AttackTrigger: Failed to create trigger - physicsWorld or ghostObj is undefined"
        );
      }
    } catch (error) {
      console.error("AttackTrigger: Error setting up trigger:", error);
    }
  }
  Initialize() {
    const player = this.FindEntity("Player");
    if (player) {
      this.playerPhysics = player.GetComponent("PlayerPhysics");
    } else {
      console.warn(
        "AttackTrigger: Player entity not found during initialization"
      );
    }
    this.SetupTrigger();
  }

  PhysicsUpdate(world, t) {
    if (this.playerPhysics && this.playerPhysics.body && this.ghostObj) {
      this.overlapping = AmmoHelper.IsTriggerOverlapping(
        this.ghostObj,
        this.playerPhysics.body
      );
    } else {
      // Try to find player if not found during initialization
      if (!this.playerPhysics) {
        const player = this.FindEntity("Player");
        if (player) {
          this.playerPhysics = player.GetComponent("PlayerPhysics");
          console.log("AttackTrigger: Found player in PhysicsUpdate");
        }
      }
      this.overlapping = false;
    }
  }
  Update(t) {
    if (!this.ghostObj) {
      return;
    }

    try {
      const entityPos = this.parent.position;
      const entityRot = this.parent.rotation;
      const transform = this.ghostObj.getWorldTransform();

      this.quat.setValue(entityRot.x, entityRot.y, entityRot.z, entityRot.w);
      transform.setRotation(this.quat);
      transform.getOrigin().setValue(entityPos.x, entityPos.y, entityPos.z);
      transform.op_mul(this.localTransform);
    } catch (error) {
      console.error("AttackTrigger: Error updating transform:", error);
    }
  }
}

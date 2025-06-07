import Component from "../../Component";
import { Ammo, AmmoHelper, CollisionFilterGroups } from "../../AmmoLib";

export default class AmmoBox extends Component {
  constructor(scene, model, shape, physicsWorld) {
    super();
    this.name = "AmmoBox";
    this.model = model;
    this.shape = shape;
    this.scene = scene;
    this.world = physicsWorld;

    this.quat = new Ammo.btQuaternion();
    this.update = true;
    this.regenerationTime = 10000; // 10 seconds to regenerate
    this.isDisabled = false;
  }

  Initialize() {
    this.player = this.FindEntity("Player");
    this.playerPhysics = this.player.GetComponent("PlayerPhysics");

    this.trigger = AmmoHelper.CreateTrigger(this.shape);

    this.world.addCollisionObject(
      this.trigger,
      CollisionFilterGroups.SensorTrigger
    );
    this.scene.add(this.model);
  }
  Disable() {
    this.isDisabled = true;
    this.model.visible = false; // Hide the model instead of removing it
    console.log(
      "Ammo box picked up - will regenerate in",
      this.regenerationTime / 1000,
      "seconds"
    );

    // Schedule regeneration
    setTimeout(() => {
      this.Regenerate();
    }, this.regenerationTime);
  }

  Regenerate() {
    this.isDisabled = false;
    this.model.visible = true; // Show the model again

    // Add a brief visual effect to indicate regeneration
    if (this.model) {
      const originalScale = this.model.scale.clone();
      this.model.scale.set(0.1, 0.1, 0.1);

      // Animate scale back to normal
      const animateScale = () => {
        const startTime = Date.now();
        const duration = 500; // 0.5 seconds

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const scale = 0.1 + (1 - 0.1) * progress;

          if (this.model) {
            this.model.scale.set(scale, scale, scale);
          }

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else if (this.model) {
            this.model.scale.copy(originalScale);
          }
        };
        animate();
      };

      animateScale();
    }

    console.log("Ammo box regenerated and ready for pickup!");
  }
  Update(t) {
    if (!this.update) {
      return;
    }

    const entityPos = this.parent.position;
    const entityRot = this.parent.rotation;

    this.model.position.copy(entityPos);
    this.model.quaternion.copy(entityRot);

    const transform = this.trigger.getWorldTransform();

    this.quat.setValue(entityRot.x, entityRot.y, entityRot.z, entityRot.w);
    transform.setRotation(this.quat);
    transform.getOrigin().setValue(entityPos.x, entityPos.y, entityPos.z);

    // Only allow pickup if not disabled
    if (
      !this.isDisabled &&
      AmmoHelper.IsTriggerOverlapping(this.trigger, this.playerPhysics.body)
    ) {
      this.player.Broadcast({ topic: "AmmoPickup" });
      this.Disable();
    }
  }
}

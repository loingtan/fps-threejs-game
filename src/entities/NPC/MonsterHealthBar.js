import * as THREE from "three";
import Component from "../../Component";

export default class MonsterHealthBar extends Component {
  constructor(camera) {
    super();
    this.name = "MonsterHealthBar";
    this.camera = camera; // Can be null, we'll handle it later
    this.visible = true;
    this.container = null;
    this.backgroundSprite = null;
    this.healthSprite = null;
    this.hideTimeout = null;
    this.healthBarDuration = 5000; // ms
    this.initialHealth = 100;
    this.currentHealth = 100;

    // Add static tracking for instances
    if (!MonsterHealthBar.instances) {
      MonsterHealthBar.instances = new Map();
    }

    console.log("MonsterHealthBar constructor called, camera:", !!camera);
    // THÊM: Create container early in constructor for robustness
    this.container = new THREE.Object3D();
    this.container.name = "HealthBarContainer";
  }

  Initialize() {
    console.log("MonsterHealthBar Initialize started");

    // Get the controller and store reference
    this.controller = this.GetComponent("CharacterController");
    if (!this.controller) {
      console.error("MonsterHealthBar: No CharacterController found");
      return;
    }

    // Register with static instances map
    if (this.controller.parent) {
      MonsterHealthBar.instances.set(this.controller.parent.id, this);
      console.log(
        `Health bar registered for monster ID ${this.controller.parent.id}`
      );
    }

    // If camera was null, try to find it now
    if (!this.camera) {
      console.log("Looking for camera in Initialize");
      const player = this.FindEntity("Player");
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls) {
          this.camera = controls.camera;
          console.log("Found camera via player entity:", !!this.camera);
        }
      }

      // Try global app as last resort
      if (!this.camera && typeof window !== "undefined" && window._APP) {
        try {
          const playerEntity = window._APP.entityManager.Get("Player");
          if (playerEntity) {
            const controls = playerEntity.GetComponent("PlayerControls");
            if (controls) {
              this.camera = controls.camera;
              console.log("Found camera via global _APP:", !!this.camera);
            }
          }
        } catch (e) {
          console.warn("Failed to get camera from global _APP:", e);
        }
      }
    }

    // Continue even without camera - we'll use default position if needed
    this.initialHealth = this.controller.health || 100;
    this.currentHealth = this.initialHealth;

    try {
      this.CreateHealthBar();
      console.log(
        "Health bar created successfully for",
        this.controller.parent?.name
      );
      return true;
    } catch (e) {
      console.error("Failed to create health bar:", e);
      return false;
    }
  }

  CreateHealthBar() {
    // Don't create if we already have a container with children
    if (this.container && this.container.children.length > 0) {
      console.log("Health bar already created, skipping");
      return;
    }

    // Make sure container exists
    if (!this.container) {
      this.container = new THREE.Object3D();
      this.container.name = "HealthBarContainer";
    }

    // Add to scene
    if (window._APP && window._APP.scene) {
      window._APP.scene.add(this.container);
    } else if (this.controller && this.controller.scene) {
      this.controller.scene.add(this.container);
    }

    const backgroundMaterial = new THREE.SpriteMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.6,
    });
    this.backgroundSprite = new THREE.Sprite(backgroundMaterial);
    this.backgroundSprite.scale.set(1, 0.2, 1);
    this.container.add(this.backgroundSprite);

    // Health bar sprite
    const healthMaterial = new THREE.SpriteMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
    });
    this.healthSprite = new THREE.Sprite(healthMaterial);
    this.healthSprite.scale.set(1, 0.2, 1);
    this.healthSprite.position.set(0, 0, 0.01); // Slightly in front of background
    this.container.add(this.healthSprite);

    // Position above monster head
    this.container.position.y = 2.5;

    // Set health to initial value
    this.UpdateHealth(this.currentHealth);
    this.container.visible = true;
  }

  UpdateHealth(health) {
    if (!this.container || !this.healthSprite) {
      console.warn("Health bar not initialized yet");
      return;
    }

    this.currentHealth = health;
    const healthPercent = Math.max(0, this.currentHealth / this.initialHealth);

    // Update the health bar width
    this.healthSprite.scale.x = Math.max(0.01, healthPercent);

    // Position the health bar correctly (centered)
    this.healthSprite.position.x = (healthPercent - 1) * 0.5;

    // Make health bar visible
    this.container.visible = true;

    // Color based on health percentage
    if (this.healthSprite.material) {
      if (healthPercent > 0.6) {
        this.healthSprite.material.color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        this.healthSprite.material.color.setHex(0xffff00); // Yellow
      } else {
        this.healthSprite.material.color.setHex(0xff0000); // Red
      }
    }

    // Clear any existing hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    // Set timeout to hide the health bar
    this.hideTimeout = setTimeout(() => {
      if (this.container) {
        this.container.visible = false;
      }
    }, this.healthBarDuration);
  }

  Update(t) {
    // Only update position if we have the container and camera
    if (!this.container || !this.camera) return;

    // Position the health bar above the monster
    const monsterPosition =
      this.parent?.position || this.controller?.model?.position;
    if (!monsterPosition) return;

    // Position health bar above the monster
    this.container.position.x = monsterPosition.x;
    this.container.position.z = monsterPosition.z;
    this.container.position.y = monsterPosition.y + 2.5; // Above monster head

    // Make health bar face the camera
    if (this.camera) {
      this.container.lookAt(this.camera.position);
    }
  }

  // Clean up when component is removed
  OnDestroy() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    if (this.container) {
      if (window._APP && window._APP.scene) {
        window._APP.scene.remove(this.container);
      } else if (this.controller && this.controller.scene) {
        this.controller.scene.remove(this.container);
      }
      this.container = null;
    }

    // Remove from instances map
    if (this.controller?.parent?.id && MonsterHealthBar.instances) {
      MonsterHealthBar.instances.delete(this.controller.parent.id);
    }
  }

  static GetHealthBar(monsterId) {
    if (
      MonsterHealthBar.instances &&
      MonsterHealthBar.instances.has(monsterId)
    ) {
      return MonsterHealthBar.instances.get(monsterId);
    }
    return null;
  }
}

import * as THREE from "three";
import Component from "../../Component";

export default class MonsterHealthBar extends Component {
  constructor(camera) {
    super();
    this.name = "MonsterHealthBar";
    this.camera = camera;
    this.visible = false;
    this.hideTimeout = null;
    this.healthBarDuration = 5000; // ms - increased to 5 seconds
    this.initialHealth = 100;
    this.currentHealth = 100;
  }

  Initialize() {
    // Get the controller
    this.controller = this.GetComponent("CharacterController");
    if (!this.controller) {
      console.error("MonsterHealthBar: No CharacterController found");
      return;
    }

    // Get the camera if not provided
    if (!this.camera) {
      const player = this.FindEntity("Player");
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls) {
          this.camera = controls.camera;
        }
      }
    }

    this.initialHealth = this.controller.health;
    this.currentHealth = this.controller.health;

    this.CreateHealthBar();
  }
  CreateHealthBar() {
    // Create health bar container
    this.container = new THREE.Object3D();

    const barWidth = 2.0; // Made even wider for better visibility
    const barHeight = 0.3; // Made taller for better visibility
    const barDepth = 0.05; // Create background (black with bright emissive)
    const backgroundGeometry = new THREE.BoxGeometry(
      barWidth,
      barHeight,
      barDepth
    );
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: false,
      depthTest: false, // Always render on top
      depthWrite: false,
      emissive: 0x333333, // Make it slightly glowing
    });
    this.background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    this.container.add(this.background);

    // Create foreground (green initially with emissive glow)
    const foregroundGeometry = new THREE.BoxGeometry(
      barWidth * 0.98,
      barHeight * 0.8,
      barDepth * 2
    );
    const foregroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Start with green
      transparent: false,
      depthTest: false, // Always render on top
      depthWrite: false,
      emissive: 0x002200, // Make it glow green
    });
    this.foreground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
    this.foreground.position.z = barDepth * 0.5;
    this.container.add(this.foreground);

    // Make elements not cast shadows
    this.background.castShadow = false;
    this.foreground.castShadow = false;
    this.background.receiveShadow = false;
    this.foreground.receiveShadow = false;

    // Position the health bar above the monster
    this.container.position.y = 3.0; // Positioned higher above monster

    // Add bright border to make the health bar more visible
    const borderGeometry = new THREE.BoxGeometry(
      barWidth + 0.04,
      barHeight + 0.04,
      barDepth
    );
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: false,
      depthTest: false, // Always render on top
      depthWrite: false,
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.z = -0.01;
    this.container.add(border); // Add the health bar to the scene through the controller
    if (this.controller.scene) {
      this.controller.scene.add(this.container);
      console.log("Health bar added to main scene");
    } else {
      // Fallback: add to the model
      this.controller.model.add(this.container);
      console.log("Health bar added to model");
    } // Position the health bar above the monster
    this.container.position.copy(this.controller.model.position);
    this.container.position.y += 2.5; // Positioned closer to monster head

    // Make it always visible initially
    this.container.visible = true;
    this.container.renderOrder = 999; // Render on top

    console.log(
      "Health bar created and made visible for:",
      this.controller.parent.name,
      "Added to scene:",
      !!this.controller.scene,
      "Position:",
      this.container.position
    );

    // Store initial width for scaling
    this.initialWidth = barWidth * 0.98;
  }
  UpdateHealth(health) {
    if (!this.container) {
      console.error("Health bar container not found!");
      return;
    }

    this.currentHealth = health;

    // Calculate health percentage
    const healthPercentage = Math.max(0, health / this.initialHealth);

    // Update the foreground bar
    this.foreground.scale.x = healthPercentage; // Change color based on health percentage
    if (healthPercentage <= 0.2) {
      this.foreground.material.color.setHex(0xff0000); // Red when critical
      this.foreground.material.emissive.setHex(0x220000); // Red glow
    } else if (healthPercentage <= 0.5) {
      this.foreground.material.color.setHex(0xff8800); // Orange when medium
      this.foreground.material.emissive.setHex(0x221100); // Orange glow
    } else {
      this.foreground.material.color.setHex(0x00ff00); // Green when healthy
      this.foreground.material.emissive.setHex(0x002200); // Green glow
    }

    // Adjust position to keep left-aligned
    this.foreground.position.x =
      (this.initialWidth * (healthPercentage - 1)) / 2;

    // Make health bar visible with full opacity
    this.container.visible = true;

    // Make health bar more noticeable by scaling it up briefly
    const originalScale = this.container.scale.clone();
    this.container.scale.set(1.2, 1.2, 1.0);

    setTimeout(() => {
      if (this.container) {
        this.container.scale.copy(originalScale);
      }
    }, 200);

    console.log(
      `Health bar updated for monster: ${health}/${
        this.initialHealth
      } (${Math.round(healthPercentage * 100)}%)`
    ); // Clear any existing timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    // Keep health bar visible always for debugging - remove timeout hiding
    this.container.visible = true;

    console.log(
      `Health bar updated and kept visible for monster: ${health}/${
        this.initialHealth
      } (${Math.round(healthPercentage * 100)}%)`
    );
  }
  Update() {
    if (!this.container || !this.controller || !this.camera) {
      return;
    }
    // Update position to follow the monster's head
    if (this.container.visible) {
      // Get bounding box of the monster model
      let box = new THREE.Box3().setFromObject(this.controller.model);
      let headY = box.max.y;
      this.container.position.set(
        this.controller.model.position.x,
        headY + 0.3, // Slightly above the head
        this.controller.model.position.z
      );
      // Make health bar face the camera
      this.container.lookAt(this.camera.position);
      this.container.rotation.z = 0;
      this.container.rotation.x = 0;
    }
  }

  OnDestroy() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    if (this.container && this.container.parent) {
      this.container.parent.remove(this.container);
    }
  }
}

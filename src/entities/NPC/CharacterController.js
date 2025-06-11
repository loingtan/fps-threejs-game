import * as THREE from "three";
import Component from "../../Component";
import { Ammo, AmmoHelper, CollisionFilterGroups } from "../../AmmoLib";
import CharacterFSM from "./CharacterFSM";
// import MonsterHealthBar from "./MonsterHealthBar";

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
    // THÊM: Biến để track health trước đó
    this.previousHealth = this.health; // Track health trước khi nhận damage
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
    this.stateMachine = new CharacterFSM(this);
    this.navmesh = this.FindEntity("Level").GetComponent("Navmesh");
    this.hitbox = this.GetComponent("AttackTrigger");
    this.player = this.FindEntity("Player");

    // Set health based on monster name/type
    if (this.parent.name.includes("Mutant_")) {
      // Normal mutants
      this.health = 100;
    } else if (this.parent.name.includes("Mutant")) {
      // Boss mutant with higher health
      this.health = 150;
    }

    this.parent.RegisterEventHandler(this.TakeHit, "hit");

    const scene = this.model;

    scene.scale.setScalar(0.01);
    scene.position.copy(this.parent.position);

    this.mixer = new THREE.AnimationMixer(scene);

    scene.traverse((child) => {
      if (!child.isSkinnedMesh) {
        return;
      }

      child.frustumCulled = false;
      child.castShadow = true;
      child.receiveShadow = true;
      this.skinnedmesh = child;
      this.rootBone = child.skeleton.bones.find(
        (bone) => bone.name == "MutantHips"
      );
      this.rootBone.refPos = this.rootBone.position.clone();
      this.lastPos = this.rootBone.position.clone();
    });
    this.SetupAnimations();
    this.scene.add(scene);
    this.stateMachine.SetState("idle");

    // THÊM: Cache entityManager reference vào biến
    // để không phải tìm lại nhiều lần
    this.cachedEntityManager = this.FindEntityManager();
    if (this.cachedEntityManager) {
      console.log(`Found and cached EntityManager for ${this.parent.name}`);
    } else {
      console.warn(
        `EntityManager not found for ${this.parent.name} during Initialize`
      );
    }

    // Create physics body for collision with environment
    this.CreatePhysicsBody();

    // THÊM: Store reference to parent ID
    this.parentId = this.parent.id;

    // // Defensive camera-finding logic
    // let camera = null;
    // if (this.player) {
    //   const controls = this.player.GetComponent("PlayerControls");
    //   if (controls && controls.camera) {
    //     camera = controls.camera;
    //   } else {
    //     console.warn(
    //       `Player controls or camera not found for ${this.parent.name}`
    //     );
    //   }
    // } else {
    //   console.warn(`Player reference missing for monster ${this.parent.name}`);
    // }

    // console.log(
    //   "Adding health bar to monster:",
    //   this.parent.name,
    //   "Camera object exists:",
    //   !!camera
    // );

    // // THÊM: Force delay to ensure player camera is fully initialized
    // setTimeout(() => {
    //   // THÊM: Try again to get camera if it was null
    //   if (!camera && this.player) {
    //     const controls = this.player.GetComponent("PlayerControls");
    //     if (controls && controls.camera) {
    //       camera = controls.camera;
    //       console.log("Camera found on retry for:", this.parent.name);
    //     }
    //   }

    //   // THÊM: Double-check existing health bar
    //   this.healthBar = this.parent.GetComponent("MonsterHealthBar");
    //   if (!this.healthBar) {
    //     try {
    //       // Make sure camera is still valid
    //       if (!camera && window._APP && window._APP.entityManager) {
    //         const playerEntity = window._APP.entityManager.Get("Player");
    //         if (playerEntity) {
    //           const controls = playerEntity.GetComponent("PlayerControls");
    //           if (controls) {
    //             camera = controls.camera;
    //             console.log("Got camera from _APP for:", this.parent.name);
    //           }
    //         }
    //       }

    //       console.log(
    //         `Creating health bar for ${this.parent.name} with camera:`,
    //         !!camera
    //       );

    //       // Create health bar component
    //       const healthBarComponent = new MonsterHealthBar(camera);
    //       console.log("Health bar component created:", !!healthBarComponent);

    //       // THÊM: Tạo container trước khi thêm vào entity
    //       if (typeof healthBarComponent.CreateHealthBar === "function") {
    //         healthBarComponent.controller = this; // Set controller reference
    //         healthBarComponent.CreateHealthBar();
    //         console.log(
    //           "Created container manually:",
    //           !!healthBarComponent.container
    //         );
    //       }

    //       // Now add it to the parent entity
    //       this.healthBar = this.parent.AddComponent(healthBarComponent);
    //       console.log("Health bar added successfully:", !!this.healthBar);

    //       // Force initialize it (this will trigger both Initialize and Update)
    //       if (this.healthBar && !this.healthBar.container) {
    //         console.log("Container still missing, forcing creation");
    //         if (typeof this.healthBar.Initialize === "function") {
    //           this.healthBar.Initialize();
    //         }
    //         if (typeof this.healthBar.CreateHealthBar === "function") {
    //           this.healthBar.CreateHealthBar();
    //         }
    //       }

    //       // THÊM: Check if container exists now
    //       console.log("Final container status:", !!this.healthBar?.container);

    //       // THÊM: Nếu vẫn không có container, tạo một cái đơn giản
    //       if (this.healthBar && !this.healthBar.container) {
    //         try {
    //           console.log("Creating emergency container");
    //           this.healthBar.container = new THREE.Object3D();
    //           this.healthBar.container.name = "EmergencyHealthBarContainer";

    //           // Create simple health indicator
    //           const geometry = new THREE.PlaneGeometry(1, 0.2);
    //           const material = new THREE.MeshBasicMaterial({
    //             color: 0xff0000,
    //             transparent: true,
    //             opacity: 0.8,
    //           });

    //           const healthMesh = new THREE.Mesh(geometry, material);
    //           this.healthBar.container.add(healthMesh);

    //           // Add to scene
    //           if (this.scene) {
    //             this.scene.add(this.healthBar.container);
    //             console.log("Emergency container added to scene");
    //           }
    //         } catch (e) {
    //           console.error("Failed to create emergency container:", e);
    //         }
    //       }
    //     } catch (err) {
    //       console.error("Error creating health bar:", err);
    //     }
    //   }

    //   // Force initial health bar display and update
    //   if (this.healthBar) {
    //     console.log(
    //       "Health bar component added successfully for",
    //       this.parent.name
    //     );

    //     setTimeout(() => {
    //       if (this.healthBar && this.healthBar.UpdateHealth) {
    //         this.healthBar.container.visible = true;
    //         this.healthBar.UpdateHealth(this.health);
    //         console.log(
    //           "Forced health bar visibility and health update for monster:",
    //           this.parent.name,
    //           "Health:",
    //           this.health
    //         );
    //       } else {
    //         console.warn(
    //           "Health bar exists but UpdateHealth missing for:",
    //           this.parent.name
    //         );
    //       }
    //     }, 100);
    //   } else {
    //     console.error(
    //       "Failed to add health bar component to monster:",
    //       this.parent.name
    //     );
    //   }
    // }, 200); // Add delay to ensure everything is properly initialized
    // THAY THẾ toàn bộ đoạn code tìm camera và tạo health bar bằng:
    console.log(`Creating direct health bar for ${this.parent.name}`);
    const directHealthBar = this.CreateDirectHealthBar();
    directHealthBar.UpdateHealth(this.health);

    // Nếu muốn ẩn health bar sau khi tạo
    setTimeout(() => {
      if (this.directHealthBar && this.directHealthBar.container) {
        this.directHealthBar.container.visible = false;
      }
    }, 1000);
  }

  // // FIX: Tìm lại health bar nếu bị mất
  // GetHealthBar() {
  //   if (this.healthBar) return this.healthBar;

  //   // Tìm lại từ component
  //   this.healthBar = this.parent.GetComponent("MonsterHealthBar");
  //   if (this.healthBar) return this.healthBar;

  //   // Tìm trong static cache
  //   if (
  //     typeof MonsterHealthBar !== "undefined" &&
  //     MonsterHealthBar.GetHealthBar
  //   ) {
  //     this.healthBar = MonsterHealthBar.GetHealthBar(this.parentId);
  //     if (this.healthBar) return this.healthBar;
  //   }

  //   return null;
  // }
  // CẬP NHẬT: Chuyển đổi để trả về directHealthBar thay vì healthBar component
  GetHealthBar() {
    return this.directHealthBar;
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
  // CreateDirectHealthBar() {
  //   // Nếu đã có thì trả về
  //   if (this.directHealthBar) return this.directHealthBar;

  //   // Tạo container
  //   const container = new THREE.Object3D();
  //   container.name = `HealthBar_${this.parent.name}`;

  //   // Tạo nền thanh máu (background)
  //   const bgGeometry = new THREE.PlaneGeometry(1, 0.15);
  //   const bgMaterial = new THREE.MeshBasicMaterial({
  //     color: 0x000000,
  //     transparent: true,
  //     opacity: 0.6,
  //     depthTest: false,
  //   });
  //   const background = new THREE.Mesh(bgGeometry, bgMaterial);
  //   container.add(background);

  //   // Tạo thanh máu (foreground)
  //   const healthGeometry = new THREE.PlaneGeometry(0.96, 0.11);
  //   const healthMaterial = new THREE.MeshBasicMaterial({
  //     color: 0xff0000,
  //     transparent: true,
  //     opacity: 0.8,
  //     depthTest: false,
  //   });
  //   const healthIndicator = new THREE.Mesh(healthGeometry, healthMaterial);
  //   healthIndicator.position.z = 0.01; // Đặt phía trước background
  //   container.add(healthIndicator);

  //   // Thêm vào scene
  //   this.scene.add(container);

  //   // Đặt vị trí ban đầu
  //   container.position.copy(this.model.position);
  //   container.position.y += 2.5; // Trên đầu quái vật

  //   // Lưu tham chiếu
  //   this.directHealthBar = {
  //     container,
  //     background,
  //     healthIndicator,
  //     healthMaterial,
  //     maxWidth: 0.96, // Chiều rộng tối đa của thanh máu

  //     // Phương thức cập nhật máu
  //     UpdateHealth: (health, maxHealth) => {
  //       const percent = Math.max(0, health / maxHealth);

  //       // Cập nhật kích thước và vị trí
  //       const newWidth = this.directHealthBar.maxWidth * percent;
  //       healthIndicator.scale.x = percent;

  //       // Căn giữa thanh máu
  //       healthIndicator.position.x =
  //         (percent - 1) * this.directHealthBar.maxWidth * 0.5;

  //       // Đổi màu dựa theo phần trăm máu
  //       if (percent > 0.6) {
  //         healthMaterial.color.setHex(0x00ff00); // Xanh lá (>60%)
  //       } else if (percent > 0.3) {
  //         healthMaterial.color.setHex(0xffff00); // Vàng (30-60%)
  //       } else {
  //         healthMaterial.color.setHex(0xff0000); // Đỏ (<30%)
  //       }

  //       // Hiển thị thanh máu
  //       container.visible = true;

  //       // Tự động ẩn sau một khoảng thời gian
  //       if (this.hideTimeout) clearTimeout(this.hideTimeout);
  //       this.hideTimeout = setTimeout(() => {
  //         if (health > 0) container.visible = false;
  //       }, 3000);
  //     },
  //   };

  //   return this.directHealthBar;
  // }

  CreateDirectHealthBar() {
    // Nếu đã có thì trả về
    if (this.directHealthBar) return this.directHealthBar;

    // Tạo container
    const container = new THREE.Object3D();
    container.name = `HealthBar_${this.parent.name}`;

    // Tạo nền thanh máu (background) - màu đỏ
    const bgGeometry = new THREE.PlaneGeometry(1, 0.15);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // ĐỔI: Background là màu đỏ (hiển thị máu đã mất)
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    container.add(background);

    // Tạo thanh máu (foreground) - màu xanh lá
    const healthGeometry = new THREE.PlaneGeometry(0.96, 0.11);
    const healthMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // ĐỔI: Foreground là màu xanh lá (hiển thị máu còn lại)
      transparent: true,
      opacity: 0.9, // ĐỔI: Tăng opacity để dễ nhìn hơn
      depthTest: false,
    });
    const healthIndicator = new THREE.Mesh(healthGeometry, healthMaterial);
    healthIndicator.position.z = 0.01; // Đặt phía trước background
    container.add(healthIndicator);

    // Thêm vào scene
    this.scene.add(container);

    // Đặt vị trí ban đầu
    container.position.copy(this.model.position);
    container.position.y += 2.5; // Trên đầu quái vật

    // Lưu tham chiếu
    this.directHealthBar = {
      container,
      background,
      healthIndicator,
      healthMaterial,
      maxWidth: 0.96, // Chiều rộng tối đa của thanh máu
      initialHealth: this.health, // Lưu lại máu ban đầu

      // Phương thức cập nhật máu
      UpdateHealth: (currentHealth) => {
        // Tính phần trăm máu còn lại
        const maxHealth = this.directHealthBar.initialHealth;
        const percent = Math.max(0, currentHealth / maxHealth);

        // ĐỔI: Đảm bảo thanh máu có giá trị tối thiểu để luôn nhìn thấy
        const visiblePercent = Math.max(0.01, percent);

        // ĐỔI: Đơn giản hóa cách hiển thị - scale và không dịch chuyển
        healthIndicator.scale.x = visiblePercent;

        // ĐỔI: Căn lề trái thay vì căn giữa (giống như health bar thông thường)
        healthIndicator.position.x = -0.48 * (1 - visiblePercent);

        // ĐỔI: Đổi màu dựa theo phần trăm máu
        if (percent > 0.6) {
          healthMaterial.color.setHex(0x00ff00); // Xanh lá (>60%)
        } else if (percent > 0.3) {
          healthMaterial.color.setHex(0xffff00); // Vàng (30-60%)
        } else {
          healthMaterial.color.setHex(0xff6600); // Cam đỏ (<30%)
        }

        // Hiển thị thanh máu
        container.visible = true;

        // // Tự động ẩn sau một khoảng thời gian
        // if (this.hideTimeout) clearTimeout(this.hideTimeout);
        // if (currentHealth > 0) {
        //   this.hideTimeout = setTimeout(() => {
        //     if (this.directHealthBar && this.directHealthBar.container) {
        //       this.directHealthBar.container.visible = false;
        //     }
        //   }, 3000);
        // }

        // DEBUG: In thông tin để kiểm tra
        console.log(
          `Health bar updated: ${currentHealth}/${maxHealth} (${Math.round(
            percent * 100
          )}%)`
        );
      },
    };

    // Cập nhật máu ban đầu
    this.directHealthBar.UpdateHealth(this.health);

    return this.directHealthBar;
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

    // FIX: Use FindEntityManager instead of direct access
    const entityManager = this.FindEntityManager();
    if (!entityManager) {
      console.warn("EntityManager not found via FindEntityManager");
      // Fallback: Just return a direct path to player without avoidance
      this.path = [this.tempVec.clone()];
      return;
    }

    // Find all monsters in the scene
    const entities = Object.values(entityManager.entities);
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

  // TakeHit = (msg) => {
  //   // Default damage amount if not specified
  //   const amount = msg.amount || 10;

  //   // Lưu health trước khi nhận damage
  //   this.previousHealth = this.health;

  //   // Apply damage
  //   this.health = Math.max(0, this.health - amount);

  //   console.log(
  //     `Monster ${this.parent.name} took ${amount} damage, health: ${this.previousHealth} -> ${this.health}`
  //   );

  //   // Tạo và cập nhật thanh máu
  //   const healthBar = this.CreateDirectHealthBar();
  //   if (healthBar) {
  //     healthBar.UpdateHealth(this.health);
  //   }

  //   // KIỂM TRA: Chỉ tính điểm khi health chuyển từ >0 xuống ≤0
  //   if (this.previousHealth > 0 && this.health <= 0) {
  //     console.log(
  //       `Monster ${this.parent.name} just died! (${this.previousHealth} -> ${this.health})`
  //     );
  //     console.log("Calculating kill score...");

  //     this.CalculateKillScore();

  //     // TÍNH ĐIỂM CHỈ KHI VỪA CHẾT
  //     this.CalculateKillScore();

  //     // MANUAL BACKUP: Direct call to UIManager
  //     const uiEntity = this.FindEntity("UIManager");
  //     if (uiEntity) {
  //       const uiManager = uiEntity.GetComponent("UIManager");
  //       if (uiManager && uiManager.OnMonsterKilled) {
  //         const playerEntity = this.FindEntity("Player");
  //         const playerHealth = playerEntity
  //           ? playerEntity.GetComponent("PlayerHealth")
  //           : null;

  //         if (playerHealth) {
  //           const scoreData = {
  //             scoreEarned: Math.floor(100 * playerHealth.GetHealthPercent()),
  //             playerHealthPercent: playerHealth.GetHealthPercent(),
  //             monsterName: this.parent.name,
  //           };

  //           uiManager.OnMonsterKilled(scoreData);
  //           console.log("Manual score update completed:", scoreData);
  //         }
  //       }
  //     }

  //     this.stateMachine.SetState("dead");

  //     // Make the health bar disappear instantly when dead
  //     if (this.directHealthBar && this.directHealthBar.container) {
  //       this.directHealthBar.container.visible = false;
  //     }

  //     // Remove the monster after a delay
  //     setTimeout(() => {
  //       if (this.parent && this.parent.entityManager) {
  //         this.parent.entityManager.Remove(this.parent);
  //       }
  //     }, 2000);
  //   } else if (this.health > 0) {
  //     // CHỈ CHUYỂN STATE KHI CHƯA CHẾT VÀ VẪN SỐNG
  //     const stateName = this.stateMachine.currentState.Name;
  //     if (stateName == "idle" || stateName == "patrol") {
  //       this.stateMachine.SetState("chase");
  //     }
  //   } else {
  //     // Monster đã chết từ trước, không làm gì cả
  //     console.log(
  //       `Monster ${this.parent.name} was already dead (${this.previousHealth} -> ${this.health})`
  //     );
  //   }
  // };

  TakeHit = (msg) => {
    // Default damage amount if not specified
    const amount = msg.amount || 10;

    // Lưu health trước khi nhận damage
    this.previousHealth = this.health;

    // Apply damage
    this.health = Math.max(0, this.health - amount);

    console.log(
      `Monster ${this.parent.name} took ${amount} damage, health: ${this.previousHealth} -> ${this.health}`
    );

    // Sử dụng chỉ duy nhất directHealthBar
    const healthBar = this.CreateDirectHealthBar();
    if (healthBar) {
      healthBar.UpdateHealth(this.health);
    }

    // KIỂM TRA: Chỉ tính điểm khi health chuyển từ >0 xuống ≤0
    if (this.previousHealth > 0 && this.health <= 0) {
      console.log(
        `Monster ${this.parent.name} just died! (${this.previousHealth} -> ${this.health})`
      );
      console.log("Calculating kill score...");

      this.CalculateKillScore();

      // TÍNH ĐIỂM CHỈ KHI VỪA CHẾT
      this.CalculateKillScore();

      // MANUAL BACKUP: Direct call to UIManager
      const uiEntity = this.FindEntity("UIManager");
      if (uiEntity) {
        const uiManager = uiEntity.GetComponent("UIManager");
        if (uiManager && uiManager.OnMonsterKilled) {
          const playerEntity = this.FindEntity("Player");
          const playerHealth = playerEntity
            ? playerEntity.GetComponent("PlayerHealth")
            : null;

          if (playerHealth) {
            const scoreData = {
              scoreEarned: Math.floor(100 * playerHealth.GetHealthPercent()),
              playerHealthPercent: playerHealth.GetHealthPercent(),
              monsterName: this.parent.name,
            };

            uiManager.OnMonsterKilled(scoreData);
            console.log("Manual score update completed:", scoreData);
          }
        }
      }

      this.stateMachine.SetState("dead");

      // Make the health bar disappear instantly when dead
      if (this.directHealthBar && this.directHealthBar.container) {
        this.directHealthBar.container.visible = false;
      }

      // Remove the monster after a delay
      setTimeout(() => {
        if (this.parent && this.parent.entityManager) {
          this.parent.entityManager.Remove(this.parent);
        }
      }, 2000);
    } else if (this.health > 0) {
      // CHỈ CHUYỂN STATE KHI CHƯA CHẾT VÀ VẪN SỐNG
      const stateName = this.stateMachine.currentState.Name;
      if (stateName == "idle" || stateName == "patrol") {
        this.stateMachine.SetState("chase");
      }
    } else {
      // Monster đã chết từ trước, không làm gì cả
      console.log(
        `Monster ${this.parent.name} was already dead (${this.previousHealth} -> ${this.health})`
      );
    }
  };

  GetHealthBar() {
    return this.directHealthBar;
  }

  CalculateKillScore() {
    console.log("=== CALCULATING KILL SCORE FOR FRESH KILL ===");

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

    const playerHealthPercent = playerHealth.GetHealthPercent();
    const scoreEarned = Math.floor(100 * playerHealthPercent);

    console.log(
      `Player health: ${playerHealth.health}/${playerHealth.maxHealth} (${(
        playerHealthPercent * 100
      ).toFixed(1)}%)`
    );
    console.log(
      `FRESH KILL SCORE for ${this.parent.name}: ${scoreEarned} points`
    );

    const eventData = {
      type: "monster_killed",
      scoreEarned: scoreEarned,
      playerHealthPercent: playerHealthPercent,
      monsterName: this.parent.name,
    };

    // Broadcast event
    const entityManager = this.FindEntityManager();
    if (entityManager) {
      entityManager.BroadcastGlobalEvent(eventData);
      console.log("Fresh kill score event broadcasted");
    } else {
      // Direct call to UIManager
      const uiEntity = this.FindEntity("UIManager");
      if (uiEntity) {
        const uiManager = uiEntity.GetComponent("UIManager");
        if (uiManager && uiManager.OnMonsterKilled) {
          uiManager.OnMonsterKilled(eventData);
          console.log("Fresh kill score sent directly to UIManager");
        }
      }
    }
  }

  MoveAlongPath(t) {
    if (!this.path?.length) return;

    // Check for nearby monsters to avoid overlapping during movement
    let avoidanceFactor = new THREE.Vector3(0, 0, 0);
    const myPos = this.model.position.clone();

    // FIX: Use FindEntityManager instead of direct access
    const entityManager = this.FindEntityManager();
    if (entityManager) {
      const entities = Object.values(entityManager.entities);
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
          this.stateMachine.currentState.Name === "chase" ? 0.05 : 0.08; // Increased chase speed

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
    this.rootBone.position.z = this.rootBone.refPos.z;
    this.rootBone.position.x = this.rootBone.refPos.x;
  }
  Update(t) {
    this.mixer && this.mixer.update(t);
    this.ApplyRootMotion();

    this.UpdateDirection();
    this.MoveAlongPath(t);
    this.stateMachine.Update(t);

    this.parent.SetRotation(this.model.quaternion);
    this.parent.SetPosition(this.model.position);
    // Cập nhật vị trí thanh máu nếu có
    if (this.directHealthBar && this.directHealthBar.container) {
      // Đặt vị trí trên đầu quái vật
      this.directHealthBar.container.position.copy(this.model.position);
      this.directHealthBar.container.position.y += 2.5;

      // Luôn quay về phía camera
      const player = this.FindEntity("Player");
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls && controls.camera) {
          this.directHealthBar.container.lookAt(controls.camera.position);
        }
      }
    }

    // Update physics body position if it exists
    if (this.physicsBody) {
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
    // Cập nhật vị trí thanh máu nếu có
    if (this.directHealthBar && this.directHealthBar.container) {
      // Đặt vị trí trên đầu quái vật
      this.directHealthBar.container.position.copy(this.model.position);
      this.directHealthBar.container.position.y += 2.5;

      // Luôn quay về phía camera
      const player = this.FindEntity("Player");
      if (player) {
        const controls = player.GetComponent("PlayerControls");
        if (controls && controls.camera) {
          this.directHealthBar.container.lookAt(controls.camera.position);
        }
      }
    }
  }
  // THÊM: Method để tìm EntityManager
  FindEntityManager() {
    // First check the cached reference
    if (this.cachedEntityManager) {
      return this.cachedEntityManager;
    }

    // Thử tìm qua parent chain
    let current = this.parent;
    while (current) {
      if (current.entityManager) {
        // Cache the result
        this.cachedEntityManager = current.entityManager;
        return current.entityManager;
      }
      current = current.parent;
    }

    // Thử tìm qua global app
    if (window._APP && window._APP.entityManager) {
      // Cache the result
      this.cachedEntityManager = window._APP.entityManager;
      return window._APP.entityManager;
    }

    return null;
  }
  // Thêm cleanup khi quái vật bị xóa
  OnDestroy() {
    // Xóa thanh máu khỏi scene
    if (this.directHealthBar && this.directHealthBar.container) {
      this.scene.remove(this.directHealthBar.container);
      this.directHealthBar = null;
    }

    // Xóa timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}

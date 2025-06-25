import * as THREE from "three";
import { AmmoHelper, Ammo, createConvexHullShape } from "../../AmmoLib";
import Component from "../../Component";

export default class Cookie extends Component {
  constructor(scene, cookieModel, physicsWorld) {
    super(); // QUAN TRỌNG!
    this.name = "Cookie";
    this.scene = scene;
    this.cookieModel = cookieModel;
    this.physicsWorld = physicsWorld;
    this.mesh = null;
    this.physicsBody = null;
    this.isCollected = false;
  }

  Initialize() {
    console.log("Cookie Initialize called");

    try {
      if (this.cookieModel) {
        // Clone model
        this.mesh = this.cookieModel.clone();

        // SIÊU QUAN TRỌNG: Set userData để phát hiện được
        this.mesh.userData.type = "cookie";

        // LÀM CHO COOKIE DỄ NHÌN THẤY
        this.mesh.visible = true;
        this.mesh.scale.set(0.01, 0.01, 0.01); // Đặt rất lớn

        // Đặt vị trí từ parent
        if (this.parent) {
          this.mesh.position.copy(this.parent.Position);
          console.log("Cookie positioned at:", this.mesh.position);
        }

        // THÊM PHÁT SÁNG MẠN
        if (this.mesh.material) {
          // Clone material để tránh ảnh hưởng đến các cookie khác
          this.mesh.material = this.mesh.material.clone();
          this.mesh.material.emissive = new THREE.Color(0xffff00);
          this.mesh.material.emissiveIntensity = 1.0; // Max brightness
          this.mesh.material.transparent = true;
          this.mesh.material.opacity = 1.0;

          // Thêm glow effect
          this.addGlowEffect();
        }

        // THÊM: Tạo sphere phát sáng bao quanh cookie
        const glowGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide,
        });
        this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glowMesh);

        // Thêm vào scene
        this.scene.add(this.mesh);
        console.log("Cookie mesh added to scene!");

        // Tạo physics body
        this.CreatePhysicsBody();

        // Thêm hiệu ứng xoay
        this.rotationSpeed = Math.random() * 3 + 2; // 2-5 radians/sec
      } else {
        console.error("Cookie model is missing!");
      }
    } catch (err) {
      console.error("Error initializing cookie:", err);
    }
  }

  // THÊM phương thức hiệu ứng phát sáng
  addGlowEffect() {
    // Tạo sprite phát sáng
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.createLightTexture(),
      color: 0xffff00,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(5, 5, 1);
    this.mesh.add(sprite);
  }

  // THÊM phương thức tạo texture phát sáng
  createLightTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");

    // Vẽ gradient tròn
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,0,0.8)");
    gradient.addColorStop(0.4, "rgba(255,128,0,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // Cập nhật Update với hiệu ứng đập nhịp
  Update(timeElapsed) {
    // Nếu cookie đã được thu thập thì bỏ qua
    if (this.isCollected) return;

    // Hiệu ứng xoay và nhấp nháy
    if (this.mesh) {
      this.mesh.rotation.x += timeElapsed * 1;
      this.mesh.rotation.y += timeElapsed * this.rotationSpeed;

      const pulseFactor = (Math.sin(Date.now() * 0.005) + 1) * 0.5;
      const baseScale = 0.3;
      this.mesh.scale.set(
        baseScale * (1 + pulseFactor * 0.2),
        baseScale * (1 + pulseFactor * 0.2),
        baseScale * (1 + pulseFactor * 0.2)
      );

      if (this.mesh.material) {
        this.mesh.material.emissiveIntensity = 0.7 + pulseFactor * 0.3;
      }

      this.mesh.position.y += Math.sin(Date.now() * 0.002) * 0.01;

      // THÊM: Kiểm tra khoảng cách với người chơi
      this.CheckPlayerCollision();
    }
  }
  // THÊM: Phương thức mới để kiểm tra va chạm với người chơi
  CheckPlayerCollision() {
    try {
      // Tìm người chơi
      const player = this.FindEntity("Player");
      if (!player) {
        console.log("Player not found");
        return;
      }

      // Lấy vị trí của người chơi và cookie
      const playerPos = player.Position;
      const cookiePos = this.parent.Position;

      // THÊM DEBUG: In ra khoảng cách liên tục
      // const distance = playerPos.distanceTo(cookiePos);
      // console.log(`Distance to cookie: ${distance.toFixed(2)}`);

      // Tăng khoảng cách lên rất nhiều để dễ test
      if (distance < 2.0) {
        console.log(`COOKIE COLLECTED! Distance: ${distance.toFixed(2)}`);
        this.Collect(player);
      }
    } catch (err) {
      console.error("Error checking player collision:", err);
    }
  }
  // THÊM: Phương thức mới để xử lý thu thập cookie
  Collect(player) {
    if (this.isCollected) return;

    // Đánh dấu đã thu thập
    this.isCollected = true;

    console.log("COOKIE COLLECTED - trying to add health");

    // THÊM DEBUG: Kiểm tra player và các components
    console.log("Player:", player);
    console.log("Player components:", player.components);

    // Tìm PlayerHealth và log chi tiết
    const playerHealth = player.GetComponent("PlayerHealth");
    console.log("PlayerHealth component:", playerHealth);

    if (playerHealth && typeof playerHealth.AddHealth === "function") {
      // Tăng máu lên 10
      playerHealth.AddHealth(10);
    } else {
      // ĐẶC BIỆT QUAN TRỌNG: Nếu không tìm thấy AddHealth, tạo một cách thủ công
      console.error(
        "PlayerHealth or AddHealth method not found! Trying alternative..."
      );

      // Tìm kiếm health property bằng nhiều cách
      if (playerHealth && typeof playerHealth.health !== "undefined") {
        playerHealth.health = Math.min(
          playerHealth.health + 10,
          playerHealth.maxHealth || 100
        );
        console.log("Set health directly to:", playerHealth.health);

        // Gọi UpdateHealthBar nếu có
        if (typeof playerHealth.UpdateHealthBar === "function") {
          playerHealth.UpdateHealthBar();
        }
      }
    }

    // Xóa cookie ngay lập tức để xác nhận
    if (this.mesh) {
      console.log("Removing cookie mesh from scene");
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }
  // THÊM: Hiệu ứng khi thu thập
  PlayCollectAnimation(playerPosition) {
    if (!this.mesh) return;

    // Tạo hiệu ứng phát sáng khi thu thập
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7,
    });

    // Tạo particle effect
    const particles = [];
    const particleCount = 10;

    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        glowMaterial.clone()
      );

      // Vị trí ban đầu là vị trí cookie
      particle.position.copy(this.mesh.position);

      // Vận tốc hướng về người chơi
      particle.velocity = new THREE.Vector3()
        .subVectors(playerPosition, this.mesh.position)
        .normalize()
        .multiplyScalar(2 + Math.random() * 3);

      this.scene.add(particle);
      particles.push(particle);
    }

    // Animation loop
    const animateParticles = () => {
      if (particles.length === 0) return;

      particles.forEach((p, index) => {
        p.position.add(p.velocity.clone().multiplyScalar(0.1));
        p.material.opacity -= 0.05;

        if (p.material.opacity <= 0) {
          this.scene.remove(p);
          particles.splice(index, 1);
        }
      });

      if (particles.length > 0) {
        requestAnimationFrame(animateParticles);
      }
    };

    animateParticles();

    // Ẩn mesh gốc ngay lập tức
    this.mesh.visible = false;
  }

  // THÊM: Xóa khỏi scene
  RemoveFromScene() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }

    // Xóa physics body nếu có
    if (this.physicsBody && this.physicsWorld) {
      this.physicsWorld.removeRigidBody(this.physicsBody);
      this.physicsBody = null;
    }

    // THAY ĐỔI: Cách truy cập EntityManager từ Component
    try {
      // Phương pháp 1: thông qua parent
      if (this.parent && this.parent.parent) {
        const entityManager = this.parent.parent;
        const cookieSpawners = Object.values(entityManager.entities)
          .filter((e) => e.GetComponent("CookieSpawner"))
          .map((e) => e.GetComponent("CookieSpawner"));

        cookieSpawners.forEach((spawner) => {
          if (spawner && spawner.DestroyCookie) {
            spawner.DestroyCookie(this.parent);
          }
        });
      }
      // HOẶC Phương pháp 2: Dùng biến toàn cục (nếu có)
      // else if (window._APP && window._APP.entityManager) {
      //   const cookieSpawners = Object.values(window._APP.entityManager.entities)
      //     .filter(e => e.GetComponent("CookieSpawner"))
      //     .map(e => e.GetComponent("CookieSpawner"));
      //
      //   cookieSpawners.forEach(spawner => {
      //     if (spawner && spawner.DestroyCookie) {
      //       spawner.DestroyCookie(this.parent);
      //     }
      //   });
      // }
    } catch (error) {
      console.error("Error notifying CookieSpawner:", error);
      // Vẫn xử lý được nếu có lỗi
    }

    // Đánh dấu đã thu thập
    this.isCollected = true;
  }
  // THÊM: Hiển thị thông báo khi nhặt được cookie
  ShowHealthPickupMessage(amount) {
    // Tạo thông báo floating text
    const message = document.createElement("div");
    message.textContent = `+${amount.toFixed(0)} Health`;
    message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #00ff00;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 5px #000;
    pointer-events: none;
    animation: floatUp 1s ease-out forwards;
    z-index: 1000;
  `;

    // Thêm animation CSS
    if (!document.getElementById("cookie-animations")) {
      const style = document.createElement("style");
      style.id = "cookie-animations";
      style.textContent = `
      @keyframes floatUp {
        0% { opacity: 1; transform: translate(-50%, -50%); }
        100% { opacity: 0; transform: translate(-50%, -150%); }
      }
    `;
      document.head.appendChild(style);
    }

    document.body.appendChild(message);

    // Xóa element sau animation
    setTimeout(() => {
      document.body.removeChild(message);
    }, 1000);
  }

  CreatePhysicsBody() {
    // KHÔNG CÓ SEMICOLON SAU ()
    if (!this.physicsWorld || !this.mesh) return;

    // Tạo sphere collision shape cho cookie
    const radius = 0.5; // Adjust size as needed
    const shape = new Ammo.btSphereShape(radius);

    // Cookie là static/kinematic object (không rơi)
    const mass = 0;
    const localInertia = new Ammo.btVector3(0, 0, 0);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const position = this.mesh.position;
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    );

    this.physicsBody = new Ammo.btRigidBody(rbInfo);

    // Set collision flags để detect collision
    this.physicsBody.setCollisionFlags(
      this.physicsBody.getCollisionFlags() | 4
    ); // KINEMATIC_OBJECT

    // Add user pointer để identify trong collision
    this.physicsBody.threeObject = this.mesh;
    this.physicsBody.entityType = "cookie";
    this.physicsBody.entity = this.parent;

    this.physicsWorld.addRigidBody(this.physicsBody);
  }

  // Update(timeElapsed) {
  //   // Add rotation animation cho cookie
  //   if (this.mesh && !this.isCollected) {
  //     // Xoay nhanh hơn
  //     this.mesh.rotation.y += timeElapsed * 3; // Tăng từ 2 lên 3

  //     // Di chuyển lên xuống rõ rệt hơn
  //     this.mesh.position.y += Math.sin(Date.now() * 0.003) * 0.02; // Tăng từ 0.01 lên 0.02

  //     // THÊM: Hiệu ứng phát sáng nhấp nháy
  //     if (this.mesh.material) {
  //       const pulseFactor = (Math.sin(Date.now() * 0.005) + 1) * 0.5; // 0 to 1
  //       this.mesh.material.emissiveIntensity = 0.3 + pulseFactor * 0.5;

  //       // Kích thước nhấp nháy nhẹ
  //       const scaleFactor = 1 + pulseFactor * 0.1;
  //       this.mesh.scale.set(scaleFactor * 2, scaleFactor * 2, scaleFactor * 2);
  //     }
  //   }
  // }
  // THÊM: Phương thức mới để kiểm tra va chạm với người chơi
  CheckPlayerCollision() {
    try {
      // Tìm người chơi
      const player = this.FindEntity("Player");
      if (!player) return;

      // Lấy vị trí của người chơi và cookie
      const playerPos = player.Position;
      const cookiePos = this.parent.Position;

      // Tính khoảng cách giữa người chơi và cookie
      const distanceSq = playerPos.distanceToSquared(cookiePos);

      // SỬA: Giảm khoảng cách kiểm tra để đảm bảo "rất gần nhau"
      if (distanceSq < 2.0 * 2.0) {
        console.log(
          `Cookie collected! Distance: ${Math.sqrt(distanceSq).toFixed(2)}`
        );
        this.Collect(player);
      }
    } catch (err) {
      console.error("Error checking player collision:", err);
    }
  }
  // THÊM: Phương thức mới để xử lý thu thập cookie
  Collect(player) {
    if (this.isCollected) return; // Tránh collect nhiều lần

    // Đánh dấu đã thu thập
    this.isCollected = true;

    // Tìm component PlayerHealth
    const playerHealth = player.GetComponent("PlayerHealth");
    if (playerHealth) {
      // SỬA: Tăng máu 10 giá trị cố định thay vì 10%
      const healthIncrement = 10; // Thay vì maxHealth * 0.1

      console.log(
        `Health before: ${playerHealth.health}/${playerHealth.maxHealth}`
      );
      playerHealth.AddHealth(healthIncrement);
      console.log(
        `Health after: ${playerHealth.health}/${playerHealth.maxHealth}`
      );

      // Hiển thị thông báo
      this.ShowHealthPickupMessage(healthIncrement);
    } else {
      console.warn("PlayerHealth component not found");
    }

    // Tạo hiệu ứng hút vào người chơi
    this.PlayCollectAnimation(player.Position);

    // Xóa cookie khỏi scene ngay lập tức hoặc sau hiệu ứng
    // SỬA: Xóa ngay lập tức hoặc giữ timeout tùy bạn
    this.RemoveFromScene(); // Xóa ngay
    // HOẶC giữ lại timeout nếu muốn hiệu ứng trước
    // setTimeout(() => {
    //   this.RemoveFromScene();
    // }, 300);
  }
  AddCollectionEffect() {
    if (!this.mesh || this.isCollected) return;

    this.isCollected = true;

    // Tạo particle effect hoặc animation khi collect
    // Simple scale animation
    const originalScale = this.mesh.scale.clone();

    // Animate scale up then disappear
    const duration = 500; // ms
    const startTime = Date.now();

    const animateCollection = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // Scale up and fade out
        const scale = originalScale.clone().multiplyScalar(1 + progress * 0.5);
        this.mesh.scale.copy(scale);

        // Fade out
        if (this.mesh.material) {
          this.mesh.material.transparent = true;
          this.mesh.material.opacity = 1 - progress;
        }

        requestAnimationFrame(animateCollection);
      } else {
        // Animation complete, destroy
        this.Destroy();
      }
    };

    animateCollection();

    // Broadcast collection event
    if (this.parent && this.parent.parent) {
      this.parent.parent.BroadcastGlobalEvent({
        type: "cookie_collected",
        entity: this.parent,
      });
    }

    console.log("Cookie collected!");
  }

  OnCollision(otherEntity) {
    // Check if player collides with cookie
    if (otherEntity && otherEntity.Name === "Player" && !this.isCollected) {
      this.AddCollectionEffect();
    }
  }

  Destroy() {
    // Remove physics body
    if (this.physicsBody && this.physicsWorld) {
      this.physicsWorld.removeRigidBody(this.physicsBody);
      this.physicsBody = null;
    }

    // Remove mesh from scene
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }
}

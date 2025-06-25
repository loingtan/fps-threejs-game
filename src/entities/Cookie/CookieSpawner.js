import * as THREE from "three";
import Entity from "../../Entity";
import Cookie from "./Cookie";
import Component from "../../Component";

export default class CookieSpawner extends Component {
  constructor(cookieModels, scene, physicsWorld, navmeshComponent) {
    super();
    this.name = "CookieSpawner";

    // Thay đổi: nhận mảng models thay vì single model
    this.cookieModels = Array.isArray(cookieModels)
      ? cookieModels
      : [cookieModels];
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.navmesh_ = navmeshComponent;

    // THAY ĐỔI: Từ single cookie thành array
    this.activeCookies_ = [];
    this.maxCookies_ = 1;
    this.spawnTimer_ = 0;
    this.waitTimer_ = 0;

    // // States: 'waiting', 'spawning'
    // this.state_ = "waiting";

    // Timings (in seconds)
    this.COOKIE_LIFETIME = 60;
    this.SPAWN_INTERVAL = 50; //  // Thay đổi từ 1s sang 3s để giảm tần suất spawn
    this.WAIT_TIME = 1;
    // THÊM: Spawn ngay lập tức
    this.state_ = "spawning";

    // THÊM: Các vị trí cố định cho cookie (tương tự MonsterSpawner)
    // Cho cookie xuất hiện ở nhiều vị trí khác nhau
    this.fixedSpawnPoints = [
      new THREE.Vector3(10, 1.5, 10), // Gần góc
      new THREE.Vector3(-10, 1.5, 10), // Góc khác
      new THREE.Vector3(10, 1.5, -10), // Góc thứ ba
      new THREE.Vector3(-10, 1.5, -10), // Góc thứ tư
      new THREE.Vector3(0, 2.5, 0), // Giữa map - TĂNG ĐỘ CAO lên 2.5
      new THREE.Vector3(15, 1.8, 0), // Bên phải - TĂNG ĐỘ CAO lên 1.8
      new THREE.Vector3(-15, 1.8, 0), // Bên trái - TĂNG ĐỘ CAO lên 1.8
      new THREE.Vector3(0, 1.8, 15), // Phía trên - TĂNG ĐỘ CAO lên 1.8
      new THREE.Vector3(0, 1.8, -15), // Phía dưới - TĂNG ĐỘ CAO lên 1.8
    ];
    // Vị trí spawn hiện tại (index trong fixedSpawnPoints)
    this.currentSpawnIndex = 0;

    console.log(
      `CookieSpawner initialized with ${this.cookieModels.length} cookie models, max cookies: ${this.maxCookies_}`
    );
  }

  // THÊM: Phương thức mới để chọn model ngẫu nhiên
  getRandomCookieModel() {
    if (!this.cookieModels || this.cookieModels.length === 0) {
      console.error("No cookie models available!");
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.cookieModels.length);
    return this.cookieModels[randomIndex].clone();
  }

  // THAY ĐỔI: Phương thức lấy vị trí spawn tương tự MonsterSpawner
  GetRandomSpawnPosition() {
    // Lấy vị trí cố định từ danh sách và luân phiên
    const position = this.fixedSpawnPoints[this.currentSpawnIndex].clone();

    // Thêm một chút ngẫu nhiên để cookie không xuất hiện ở chính xác cùng một vị trí
    position.x += (Math.random() - 0.5) * 3;
    position.z += (Math.random() - 0.5) * 3;
    position.y += Math.random() * 0.5; // Thay đổi độ cao một chút

    // Cập nhật index cho lần spawn tiếp theo
    this.currentSpawnIndex =
      (this.currentSpawnIndex + 1) % this.fixedSpawnPoints.length;

    console.log(
      `Cookie spawn position: (${position.x.toFixed(2)}, ${position.y.toFixed(
        2
      )}, ${position.z.toFixed(2)})`
    );
    return position;
  }

  SpawnCookie() {
    try {
      console.log("=== SPAWN COOKIE ATTEMPT ===");

      // Kiểm tra max cookies
      if (this.activeCookies_.length >= this.maxCookies_) {
        console.log("Đã đạt max cookies:", this.maxCookies_);
        return;
      }

      // TẠO VỊ TRÍ DỄ NHÌN THẤY NHẤT - TẠI VỊ TRÍ NGƯỜI CHƠI
      let spawnPosition;

      // Tìm người chơi
      const entityManager = this.parent.parent;
      const player = entityManager ? entityManager.Get("Player") : null;

      if (player) {
        // Spawn ngay trước mặt người chơi
        const playerPos = player.Position.clone();
        const playerControls = player.GetComponent("PlayerControls");

        if (playerControls && playerControls.camera) {
          // Lấy hướng camera
          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(playerControls.camera.quaternion);

          // Đặt cookie cách người chơi 20 đơn vị theo hướng nhìn
          direction.multiplyScalar(20);
          spawnPosition = playerPos.clone().add(direction);
          spawnPosition.y = playerPos.y; // Đặt ngang tầm mắt
        } else {
          // Nếu không có camera, đặt trước mặt người chơi
          spawnPosition = playerPos.clone();
          spawnPosition.z -= 5;
          // spawnPosition.y += 1;
        }

        console.log("Spawning cookie AT PLAYER VIEW:", spawnPosition);
      } else {
        // Backup: Vị trí cố định dễ thấy
        spawnPosition = new THREE.Vector3(0, 2, 0); // Ngay giữa map
        console.log("Player not found, spawning at center:", spawnPosition);
      }

      // TẠO COOKIE VỚI KÍCH THƯỚC LỚN HƠN NHIỀU
      const randomCookieModel = this.getRandomCookieModel();
      if (!randomCookieModel) {
        console.error("No cookie model available!");
        return;
      }

      // Đặt cookie size SIÊU LỚN
      randomCookieModel.scale.setScalar(0.5);

      // Tạo entity
      const cookieEntity = new Entity();
      cookieEntity.SetName(`Cookie_${Date.now()}`);
      cookieEntity.SetPosition(spawnPosition);

      // THÊM: Debug marker tại vị trí spawn
      if (this.debugMode) {
        // Tạo sphere đỏ to để đánh dấu vị trí
        const markerGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(spawnPosition);
        this.scene.add(marker);
        this.debugMarkers.push(marker);
        console.log("Added debug marker at cookie position");
      }

      // Tạo cookie component với SIZE LỚN
      const cookieComponent = new Cookie(
        this.scene,
        randomCookieModel,
        this.physicsWorld
      );
      cookieEntity.AddComponent(cookieComponent);
      cookieEntity.spawnTime = Date.now();

      // THÊM: Force initialize ngay lập tức
      if (cookieComponent.Initialize) {
        cookieComponent.Initialize();
        console.log("Force initialized cookie component");
      }

      // Thêm vào entity manager
      if (this.parent && this.parent.parent) {
        this.parent.parent.Add(cookieEntity);
        console.log("Added cookie to entity manager");
      } else {
        console.error("EntityManager not found!");
        return;
      }

      // Thêm vào active cookies
      this.activeCookies_.push(cookieEntity);
      console.log(
        `Cookie spawned! Total cookies: ${this.activeCookies_.length}`
      );
    } catch (error) {
      console.error("Error spawning cookie:", error);
    }
  }

  CreateDebugDisplay() {
    if (this.debugDisplay) return;

    this.debugDisplay = document.createElement("div");
    this.debugDisplay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.7);
    color: lime;
    font-size: 16px;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
  `;
    document.body.appendChild(this.debugDisplay);
    this.UpdateDebugDisplay();
  }

  UpdateDebugDisplay() {
    if (!this.debugDisplay) return;

    // Hiển thị thông tin cookie
    let cookieInfo = "";
    for (let i = 0; i < this.activeCookies_.length; i++) {
      const cookie = this.activeCookies_[i];
      if (cookie) {
        const pos = cookie.Position;
        cookieInfo += `Cookie ${i + 1}: x=${pos.x.toFixed(
          1
        )}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}<br>`;
      }
    }

    this.debugDisplay.innerHTML = `
    <strong>COOKIES: ${this.activeCookies_.length}/${
      this.maxCookies_
    }</strong><br>
    <small>${cookieInfo || "No cookies active"}</small>
  `;
  }

  DestroyCookie(cookieEntity) {
    if (!cookieEntity) return;

    console.log("Destroying cookie:", cookieEntity.Name);

    // Get cookie component and cleanup
    const cookieComponent = cookieEntity.GetComponent("Cookie");
    if (cookieComponent && cookieComponent.Destroy) {
      cookieComponent.Destroy();
    }

    // Remove from EntityManager
    if (this.parent && this.parent.parent) {
      this.parent.parent.Remove(cookieEntity);
    }

    // Remove from active cookies array
    const index = this.activeCookies_.indexOf(cookieEntity);
    if (index > -1) {
      this.activeCookies_.splice(index, 1);
    }

    console.log(
      `Cookie destroyed. Active cookies: ${this.activeCookies_.length}`
    );
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

    // Thông báo cho CookieSpawner để cập nhật danh sách
    try {
      const cookieSpawners = Object.values(this.FindEntityManager().entities)
        .filter((e) => e.GetComponent("CookieSpawner"))
        .map((e) => e.GetComponent("CookieSpawner"));

      cookieSpawners.forEach((spawner) => {
        if (spawner && spawner.DestroyCookie) {
          spawner.DestroyCookie(this.parent);
        }
      });
    } catch (error) {
      console.error("Error notifying CookieSpawner:", error);
    }
  }
  Update(timeElapsed) {
    try {
      // THÊM: Force spawn cookie ngay lập tức nếu không có cookie
      if (this.activeCookies_.length === 0 && this.state_ !== "spawning") {
        console.log(
          "No cookies active, changing to spawning state immediately"
        );
        this.state_ = "spawning";
        this.waitTimer_ = 0;
        this.spawnTimer_ = this.SPAWN_INTERVAL; // Force spawn ngay lập tức
      }

      switch (this.state_) {
        case "waiting":
          this.waitTimer_ += timeElapsed;
          if (this.waitTimer_ >= this.WAIT_TIME) {
            this.state_ = "spawning";
            this.spawnTimer_ = 0;
            console.log("CookieSpawner state changed to spawning");
          }
          break;

        case "spawning":
          // THÊM: Đảm bảo luôn có cookie
          if (this.activeCookies_.length === 0) {
            console.log("No cookies active, spawning immediately!");
            this.SpawnCookie();
            this.spawnTimer_ = 0;
          } else {
            // Spawn timer cho cookie mới
            this.spawnTimer_ += timeElapsed;
            if (this.spawnTimer_ >= this.SPAWN_INTERVAL) {
              this.SpawnCookie();
              this.spawnTimer_ = 0; // Reset timer
            }
          }

          // Update existing cookies và check lifetime
          const currentTime = Date.now();
          for (let i = this.activeCookies_.length - 1; i >= 0; i--) {
            const cookieEntity = this.activeCookies_[i];
            if (!cookieEntity) continue;

            // Check lifetime
            const lifetime =
              (currentTime - (cookieEntity.spawnTime || 0)) / 1000; // Convert to seconds
            if (lifetime >= this.COOKIE_LIFETIME) {
              this.DestroyCookie(cookieEntity);
            }
          }
          break;
      }

      // THÊM: Debug Display
      // this.CreateDebugDisplay();
      // this.UpdateDebugDisplay();
    } catch (error) {
      console.error("Error in CookieSpawner Update:", error);
    }
  }
  GetActiveCookies() {
    return this.activeCookies_;
  }

  GetCookieCount() {
    return this.activeCookies_.length;
  }
}

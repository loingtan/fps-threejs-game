import * as THREE from "three";
import Entity from "../../Entity";
import Cookie from "./Cookie";
import Component from "../../Component";

export default class CookieSpawner extends Component { 
  constructor(cookieModel, scene, physicsWorld, navmeshComponent) {
    super();
    this.name = "CookieSpawner";
    this.cookieModel = cookieModel;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.navmesh_ = navmeshComponent;
    
    // THAY ĐỔI: Từ single cookie thành array
    this.activeCookies_ = []; // Array thay vì single cookie
    this.maxCookies_ = 200; // Số lượng cookie tối đa cùng lúc
    this.spawnTimer_ = 0;
    this.waitTimer_ = 0;
    
    // States: 'waiting', 'spawning'
    this.state_ = 'waiting';
    
    // Timings (in seconds)
    this.COOKIE_LIFETIME = 15; // Cookie tồn tại lâu hơn
    this.SPAWN_INTERVAL = 3; // Spawn cookie mới mỗi 3 giây
    this.WAIT_TIME = 5; // Chờ 5 giây trước khi bắt đầu spawn
    
    console.log("CookieSpawner initialized with max cookies:", this.maxCookies_);
  }

  GetRandomSpawnPosition() {
    if (!this.navmesh_ || !this.navmesh_.navmesh_) {
      // Fallback positions if no navmesh
      const fallbackPositions = [
        new THREE.Vector3(10, 1, 10),
        new THREE.Vector3(-10, 1, -10),
        new THREE.Vector3(15, 1, -5),
        new THREE.Vector3(-5, 1, 15),
        new THREE.Vector3(0, 1, 20),
        new THREE.Vector3(20, 1, 0)
      ];
      return fallbackPositions[Math.floor(Math.random() * fallbackPositions.length)];
    }

    // Get random position from navmesh
    const geometry = this.navmesh_.navmesh_.geometry;
    if (!geometry.attributes.position) {
      return new THREE.Vector3(0, 1, 0);
    }

    const positions = geometry.attributes.position.array;
    const triangleCount = positions.length / 9; // 3 vertices per triangle, 3 components per vertex
    
    if (triangleCount === 0) {
      return new THREE.Vector3(0, 1, 0);
    }

    // Pick random triangle
    const triangleIndex = Math.floor(Math.random() * triangleCount);
    const baseIndex = triangleIndex * 9;

    // Get triangle vertices
    const v1 = new THREE.Vector3(
      positions[baseIndex], 
      positions[baseIndex + 1], 
      positions[baseIndex + 2]
    );
    const v2 = new THREE.Vector3(
      positions[baseIndex + 3], 
      positions[baseIndex + 4], 
      positions[baseIndex + 5]
    );
    const v3 = new THREE.Vector3(
      positions[baseIndex + 6], 
      positions[baseIndex + 7], 
      positions[baseIndex + 8]
    );

    // Random point in triangle using barycentric coordinates
    const r1 = Math.random();
    const r2 = Math.random();
    
    let a = r1;
    let b = r2;
    
    if (a + b > 1) {
      a = 1 - a;
      b = 1 - b;
    }
    
    const c = 1 - a - b;

    const randomPos = new THREE.Vector3()
      .copy(v1).multiplyScalar(a)
      .add(v2.clone().multiplyScalar(b))
      .add(v3.clone().multiplyScalar(c));

    // Add some height offset
    randomPos.y += 1.0;

    return randomPos;
  }

  SpawnCookie() {
    // Kiểm tra nếu đã đạt max cookies
    if (this.activeCookies_.length >= this.maxCookies_) {
      return;
    }

    const spawnPosition = this.GetRandomSpawnPosition();
    console.log("Spawning cookie at:", spawnPosition);
    // DEBUG: Kiểm tra position có hợp lý không
    if (spawnPosition.y < 0) {
      console.warn("Cookie spawning below ground!");
      spawnPosition.y = 2; // Force above ground
    }

    if (!this.cookieModel) {
      console.error("Cookie model is undefined!");
      return;
    }

    // Create cookie entity
    const cookieEntity = new Entity();
    cookieEntity.SetName(`Cookie_${Date.now()}`); // Unique name
    cookieEntity.SetPosition(spawnPosition);

    try {
      const cookieComponent = new Cookie(
        this.scene,
        this.cookieModel.clone(),
        this.physicsWorld
      );
      cookieEntity.AddComponent(cookieComponent);

      // Add spawn timestamp để track lifetime
      cookieEntity.spawnTime = Date.now();
    } catch (error) {
      console.error("Failed to create Cookie component:", error);
      return;
    }

    // Add to EntityManager
    if (this.parent && this.parent.parent) {
      this.parent.parent.Add(cookieEntity);
    } else {
      console.warn("EntityManager not found for cookie spawning");
      return;
    }

    // Add to active cookies array
    this.activeCookies_.push(cookieEntity);
    console.log(`Cookie spawned successfully. Active cookies: ${this.activeCookies_.length}`);
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

    console.log(`Cookie destroyed. Active cookies: ${this.activeCookies_.length}`);
  }

  Update(timeElapsed) {
    switch (this.state_) {
      case 'waiting':
        this.waitTimer_ += timeElapsed;
        if (this.waitTimer_ >= this.WAIT_TIME) {
          this.state_ = 'spawning';
          this.spawnTimer_ = 0;
        }
        break;

      case 'spawning':
        // Spawn timer cho cookie mới
        this.spawnTimer_ += timeElapsed;
        if (this.spawnTimer_ >= this.SPAWN_INTERVAL) {
          this.SpawnCookie();
          this.spawnTimer_ = 0; // Reset timer
        }

        // Update existing cookies và check lifetime
        const currentTime = Date.now();
        for (let i = this.activeCookies_.length - 1; i >= 0; i--) {
          const cookieEntity = this.activeCookies_[i];
          
          // Update cookie component
          const cookieComponent = cookieEntity.GetComponent("Cookie");
          if (cookieComponent && cookieComponent.Update) {
            cookieComponent.Update(timeElapsed);
          }

          // Check lifetime
          const lifetime = (currentTime - cookieEntity.spawnTime) / 1000; // Convert to seconds
          if (lifetime >= this.COOKIE_LIFETIME) {
            this.DestroyCookie(cookieEntity);
          }
        }
        break;
    }
  }

  GetActiveCookies() {
    return this.activeCookies_;
  }

  GetCookieCount() {
    return this.activeCookies_.length;
  }

  // GetCurrentCookie() {
  //   return this.currentCookie_;
  // }
}
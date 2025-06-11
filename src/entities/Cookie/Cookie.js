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
    console.log("Cookie Initialize called with model:", this.cookieModel);
    
    if (this.cookieModel) {
      // Clone mesh để tránh conflict
      this.mesh = this.cookieModel.clone();
      // QUAN TRỌNG: Set userData để teleport tìm được
      this.mesh.userData = { type: 'cookie' };

      // Make sure mesh is visible
      this.mesh.visible = true;
      this.mesh.scale.set(1, 1, 1);
      
      // Set position từ parent entity
      if (this.parent) {
        this.mesh.position.copy(this.parent.Position);
        console.log("Cookie position set to:", this.mesh.position);
      }
      
      // Add to scene
      this.scene.add(this.mesh);
      console.log("Cookie mesh added to scene:", this.mesh);
      
      // Mark as cookie for debugging
      this.mesh.userData.type = 'cookie';
      
      // Tạo physics body
      this.CreatePhysicsBody();
    } else {
      console.error("Cookie model is null!");
    }
  }
  CreatePhysicsBody() { // KHÔNG CÓ SEMICOLON SAU ()
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
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    
    this.physicsBody = new Ammo.btRigidBody(rbInfo);
    
    // Set collision flags để detect collision
    this.physicsBody.setCollisionFlags(this.physicsBody.getCollisionFlags() | 4); // KINEMATIC_OBJECT
    
    // Add user pointer để identify trong collision
    this.physicsBody.threeObject = this.mesh;
    this.physicsBody.entityType = "cookie";
    this.physicsBody.entity = this.parent;
    
    this.physicsWorld.addRigidBody(this.physicsBody);
  }

  Update(timeElapsed) {
    // Add rotation animation cho cookie
    if (this.mesh && !this.isCollected) {
      this.mesh.rotation.y += timeElapsed * 2; // Rotate slowly
      
      // Add bobbing effect (lên xuống nhẹ)
      this.mesh.position.y += Math.sin(Date.now() * 0.003) * 0.01;
    }
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
        type: 'cookie_collected',
        entity: this.parent
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
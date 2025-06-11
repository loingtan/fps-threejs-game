/**
 * entry.js
 *
 * This is the first file loaded. It sets up the Renderer,
 * Scene, Physics and Entities. It also starts the render loop and
 * handles window resizes.
 *
 */

import * as THREE from "three";
import { AmmoHelper, Ammo, createConvexHullShape } from "./AmmoLib";
import EntityManager from "./EntityManager";
import Entity from "./Entity";
import Sky from "./entities/Sky/Sky2";
import LevelSetup from "./entities/Level/LevelSetup";
import PlayerControls from "./entities/Player/PlayerControls";
import PlayerPhysics from "./entities/Player/PlayerPhysics";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils";
import NpcCharacterController from "./entities/NPC/CharacterController";
import Input from "./Input";

import level from "./assets/level.glb";
import navmesh from "./assets/navmesh.obj";

import mutant from "./assets/animations/mutant.fbx";
import idleAnim from "./assets/animations/mutant breathing idle.fbx";
import attackAnim from "./assets/animations/mutant punch.fbx";
import walkAnim from "./assets/animations/mutant walking.fbx";
import runAnim from "./assets/animations/mutant run.fbx";
import dieAnim from "./assets/animations/mutant dying.fbx";

import cookie from "./assets/animations/cookie.fbx";

//AK47 Model and textures
import ak47 from "./assets/guns/ak47/ak47.glb";
import muzzleFlash from "./assets/muzzle_flash.glb";
//Shot sound
import ak47Shot from "./assets/sounds/ak47_shot.wav";

//Ammo box
import ammobox from "./assets/ammo/AmmoBox.fbx";
import ammoboxTexD from "./assets/ammo/AmmoBox_D.tga.png";
import ammoboxTexN from "./assets/ammo/AmmoBox_N.tga.png";
import ammoboxTexM from "./assets/ammo/AmmoBox_M.tga.png";
import ammoboxTexR from "./assets/ammo/AmmoBox_R.tga.png";
import ammoboxTexAO from "./assets/ammo/AmmoBox_AO.tga.png";

//Bullet Decal
import decalColor from "./assets/decals/decal_c.jpg";
import decalNormal from "./assets/decals/decal_n.jpg";
import decalAlpha from "./assets/decals/decal_a.jpg";

//Sky
import skyTex from "./assets/sky.jpg";

import DebugDrawer from "./DebugDrawer";
import Navmesh from "./entities/Level/Navmesh";
import AttackTrigger from "./entities/NPC/AttackTrigger";
import DirectionDebug from "./entities/NPC/DirectionDebug";
import CharacterCollision from "./entities/NPC/CharacterCollision";
import Weapon from "./entities/Player/Weapon";
import UIManager from "./entities/UI/UIManager";
import AmmoBox from "./entities/AmmoBox/AmmoBox";
import LevelBulletDecals from "./entities/Level/BulletDecals";
import MonsterSpawner from "./entities/Level/MonsterSpawner";
import PlayerHealth from "./entities/Player/PlayerHealth";

//Cookie
import CookieSpawner from "./entities/Cookie/CookieSpawner";

class FPSGameApp {
  constructor() {
    this.lastFrameTime = null;
    this.assets = {};
    this.animFrameId = 0;

    AmmoHelper.Init(() => {
      this.Init();
    });
    // Add global teleport function
    window.teleportToNearestCookie = () => {
      const cookies = [];
      this.scene.traverse((object) => {
        if (object.userData && object.userData.type === 'cookie') {
          cookies.push(object);
        }
      });
      
    if (cookies.length > 0) {
      const nearestCookie = cookies[0];
      const player = this.entityManager.Get("Player");
      if (player) {
        const newPos = nearestCookie.position.clone();
        newPos.y += 2; // Spawn above cookie
        player.SetPosition(newPos);
        console.log("Teleported to cookie at:", newPos);
      }
    } else {
      console.log("No cookies found!");
    }
  };
  
    // Add list all cookies function  
    window.listCookies = () => {
      const cookies = [];
      this.scene.traverse((object) => {
        if (object.userData && object.userData.type === 'cookie') {
          cookies.push(object.position.clone());
        }
      });
      console.log("Cookie positions:", cookies);
      return cookies;
    };

  }

  Init() {
    this.LoadAssets();
    this.SetupGraphics();
    this.SetupStartButton();
    this.SetupMapButtons();
  }
  SetupGraphics() {
    this.scene = new THREE.Scene();

    // Check if we're likely on a mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable antialiasing for better performance
      powerPreference: isMobile ? "low-power" : "high-performance",
      precision: isMobile ? "mediump" : "highp", // Lower precision on mobile
    });

    // Reduce shadow quality on mobile
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Use basic PCF instead of soft shadows    // Simplified renderer settings for better performance
    this.renderer.toneMapping = THREE.NoToneMapping; // Disable tone mapping for performance
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Set a lower pixel ratio for better performance
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);

    this.camera = new THREE.PerspectiveCamera();
    this.camera.near = 0.01;

    // create an AudioListener and add it to the camera
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener); // Pixel ratio is already set in tone mapping section above

    this.WindowResizeHanlder();
    window.addEventListener("resize", this.WindowResizeHanlder);

    document.body.appendChild(this.renderer.domElement);

    // Stats.js
    // document.body.appendChild(this.stats.dom); // REMOVE FPS WINDOW
  }

  SetupPhysics() {
    // Physics configuration
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration
    );
    this.physicsWorld.setGravity(new Ammo.btVector3(0.0, -9.81, 0.0));
    const fp = Ammo.addFunction(this.PhysicsUpdate);
    this.physicsWorld.setInternalTickCallback(fp);
    this.physicsWorld
      .getBroadphase()
      .getOverlappingPairCache()
      .setInternalGhostPairCallback(new Ammo.btGhostPairCallback()); //  Physics debug drawer - disabled for performance
    this.debugDrawer = new DebugDrawer(this.scene, this.physicsWorld);
    // this.debugDrawer.enable();
  }

  SetAnim(name, obj) {
    const clip = obj.animations[0];
    this.mutantAnims[name] = clip;
  }

  PromiseProgress(proms, progress_cb) {
    let d = 0;
    progress_cb(0);
    for (const p of proms) {
      p.then(() => {
        d++;
        progress_cb((d / proms.length) * 100);
      });
    }
    return Promise.all(proms);
  }

  AddAsset(asset, loader, name) {
    return loader.loadAsync(asset).then((result) => {
      this.assets[name] = result;
    });
  }

  OnProgress(p) {
    const progressbar = document.getElementById("progress");
    progressbar.style.width = `${p}%`;
  }

  HideProgress() {
    this.OnProgress(0);
  }

  SetupStartButton() {
    document
      .getElementById("start_game")
      .addEventListener("click", () => this.StartGame());
  }

  ShowMenu(visible = true) {
    document.getElementById("menu").style.visibility = visible
      ? "visible"
      : "hidden";
    const menuMusic = document.getElementById("menu_music");
    if (menuMusic) {
      if (visible) {
        menuMusic.currentTime = 0;
        menuMusic.play();
      } else {
        menuMusic.pause();
        menuMusic.currentTime = 0;
      }
    }
  }
  SetupMapButtons() {
    // Map selection functionality removed - only using level map
    this.selectedMap = "level";
  }

  async LoadAssets() {
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const objLoader = new OBJLoader();
    const audioLoader = new THREE.AudioLoader();
    const texLoader = new THREE.TextureLoader();
    const promises = []; //Level only
    promises.push(this.AddAsset(level, gltfLoader, "level"));
    promises.push(this.AddAsset(navmesh, objLoader, "navmesh"));
    //Mutant
    promises.push(this.AddAsset(mutant, fbxLoader, "mutant"));
    promises.push(this.AddAsset(idleAnim, fbxLoader, "idleAnim"));
    promises.push(this.AddAsset(walkAnim, fbxLoader, "walkAnim"));
    promises.push(this.AddAsset(runAnim, fbxLoader, "runAnim"));
    promises.push(this.AddAsset(attackAnim, fbxLoader, "attackAnim"));
    promises.push(this.AddAsset(dieAnim, fbxLoader, "dieAnim"));
    // THÊM COOKIE VÀO PROMISES TRƯỚC KHI LOAD
    promises.push(this.AddAsset(cookie, fbxLoader, "cookie"));

    //AK47
    promises.push(this.AddAsset(ak47, gltfLoader, "ak47"));
    promises.push(this.AddAsset(muzzleFlash, gltfLoader, "muzzleFlash"));
    promises.push(this.AddAsset(ak47Shot, audioLoader, "ak47Shot"));
    //Ammo box
    promises.push(this.AddAsset(ammobox, fbxLoader, "ammobox"));
    promises.push(this.AddAsset(ammoboxTexD, texLoader, "ammoboxTexD"));
    promises.push(this.AddAsset(ammoboxTexN, texLoader, "ammoboxTexN"));
    promises.push(this.AddAsset(ammoboxTexM, texLoader, "ammoboxTexM"));
    promises.push(this.AddAsset(ammoboxTexR, texLoader, "ammoboxTexR"));
    promises.push(this.AddAsset(ammoboxTexAO, texLoader, "ammoboxTexAO"));
    //Decal
    promises.push(this.AddAsset(decalColor, texLoader, "decalColor"));
    promises.push(this.AddAsset(decalNormal, texLoader, "decalNormal"));
    promises.push(this.AddAsset(decalAlpha, texLoader, "decalAlpha"));

    promises.push(this.AddAsset(skyTex, texLoader, "skyTex"));

    await this.PromiseProgress(promises, this.OnProgress);

    this.assets["level"] = this.assets["level"].scene;
    this.assets["muzzleFlash"] = this.assets["muzzleFlash"].scene;



    //Extract mutant anims
    this.mutantAnims = {};
    this.SetAnim("idle", this.assets["idleAnim"]);
    this.SetAnim("walk", this.assets["walkAnim"]);
    this.SetAnim("run", this.assets["runAnim"]);
    this.SetAnim("attack", this.assets["attackAnim"]);
    this.SetAnim("die", this.assets["dieAnim"]);

    this.assets["ak47"].scene.animations = this.assets["ak47"].animations; //Set ammo box textures and other props
    this.assets["ammobox"].scale.set(0.08, 0.08, 0.08);

    // Create a shared optimized material for better performance
    const ammoBoxMaterial = new THREE.MeshStandardMaterial({
      map: this.assets["ammoboxTexD"],
      // Remove aoMap for better performance
      normalMap: this.assets["ammoboxTexN"],
      metalness: 0.8, // Reduced metalness
      metalnessMap: this.assets["ammoboxTexM"],
      roughnessMap: this.assets["ammoboxTexR"],
      color: new THREE.Color(0.4, 0.4, 0.4),
    });

    this.assets["ammobox"].traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = ammoBoxMaterial;
      }
    });

    this.assets["ammoboxShape"] = createConvexHullShape(this.assets["ammobox"]);

    this.HideProgress();
    this.ShowMenu();
  }

  EntitySetup() {
    this.entityManager = new EntityManager();

    const levelEntity = new Entity();
    levelEntity.SetName("Level");
    levelEntity.AddComponent(
      new LevelSetup(this.assets["level"], this.scene, this.physicsWorld)
    );
    levelEntity.AddComponent(new Navmesh(this.scene, this.assets["navmesh"]));
    levelEntity.AddComponent(
      new LevelBulletDecals(
        this.scene,
        this.assets["decalColor"],
        this.assets["decalNormal"],
        this.assets["decalAlpha"]
      )
    );
    this.entityManager.Add(levelEntity); // Tạo một số lượng nhỏ mutant ở các vị trí cụ thể để tránh va chạm
    if (this.assets["mutant"] && this.mutantAnims) {
      // Tạo 3 mutant ở vị trí cụ thể
      const mutantPositions = [
        new THREE.Vector3(15, 0, 15),
        new THREE.Vector3(-15, 0, -15),
        new THREE.Vector3(10, 0, -10),
      ];

      for (let i = 0; i < mutantPositions.length; i++) {
        const mutantEntity = new Entity();
        mutantEntity.SetPosition(mutantPositions[i]);
        mutantEntity.SetName(`Mutant_${i}`);

        mutantEntity.AddComponent(
          new NpcCharacterController(
            SkeletonUtils.clone(this.assets["mutant"]),
            this.mutantAnims,
            this.scene,
            this.physicsWorld
          )
        );
        mutantEntity.AddComponent(new AttackTrigger(this.physicsWorld));
        mutantEntity.AddComponent(new CharacterCollision(this.physicsWorld));
        // Remove direction debug for better performance
        // mutantEntity.AddComponent(new DirectionDebug(this.scene));

        this.entityManager.Add(mutantEntity);
      }
      console.log("Created mutants at specific positions");
    }

    const skyEntity = new Entity();
    skyEntity.SetName("Sky");
    skyEntity.AddComponent(new Sky(this.scene, this.assets["skyTex"]));
    this.entityManager.Add(skyEntity);

    const playerEntity = new Entity();
    playerEntity.SetName("Player");
    playerEntity.AddComponent(new PlayerPhysics(this.physicsWorld, Ammo));
    playerEntity.AddComponent(new PlayerControls(this.camera, this.scene));
    playerEntity.AddComponent(
      new Weapon(
        this.camera,
        this.assets["ak47"].scene,
        this.assets["muzzleFlash"],
        this.physicsWorld,
        this.assets["ak47Shot"],
        this.listener
      )
    );
    playerEntity.AddComponent(new PlayerHealth());
    playerEntity.SetPosition(new THREE.Vector3(2.14, 1.48, -1.36));
    playerEntity.SetRotation(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -Math.PI * 0.5
      )
    );
    this.entityManager.Add(playerEntity);

    const npcLocations = [[10.8, 0.0, 22.0]];

    npcLocations.forEach((v, i) => {
      const npcEntity = new Entity();
      npcEntity.SetPosition(new THREE.Vector3(v[0], v[1], v[2]));
      npcEntity.SetName(`Mutant${i}`);
      npcEntity.AddComponent(
        new NpcCharacterController(
          SkeletonUtils.clone(this.assets["mutant"]),
          this.mutantAnims,
          this.scene,
          this.physicsWorld
        )
      );
      npcEntity.AddComponent(new AttackTrigger(this.physicsWorld));
      npcEntity.AddComponent(new CharacterCollision(this.physicsWorld));
      // Removed DirectionDebug for better performance
      this.entityManager.Add(npcEntity);
    });
    const uimanagerEntity = new Entity();
    uimanagerEntity.SetName("UIManager");
    uimanagerEntity.AddComponent(new UIManager());
    this.entityManager.Add(uimanagerEntity);

    // Add MonsterSpawner for infinite spawning
    const spawnerEntity = new Entity();
    spawnerEntity.SetName("MonsterSpawner");
    const levelmutannavmeshComponent = levelEntity.GetComponent("Navmesh");
    spawnerEntity.AddComponent(
      new MonsterSpawner(
        this.assets["mutant"],
        this.mutantAnims,
        this.scene,
        this.physicsWorld,
        levelmutannavmeshComponent
      )
    );
    this.entityManager.Add(spawnerEntity);

    const ammoLocations = [
      [14.37, 0.0, 10.45],
      [32.77, 0.0, 33.84],
    ];

    ammoLocations.forEach((loc, i) => {
      const box = new Entity();
      box.SetName(`AmmoBox${i}`);
      box.AddComponent(
        new AmmoBox(
          this.scene,
          this.assets["ammobox"].clone(),
          this.assets["ammoboxShape"],
          this.physicsWorld
        )
      );
      box.SetPosition(new THREE.Vector3(loc[0], loc[1], loc[2]));
      this.entityManager.Add(box);
    });
    // DEBUG: Kiểm tra cookie asset
    console.log("Original cookie asset:", this.assets["cookie"]);
    
    // CREATE SIMPLE COOKIE GEOMETRY thay vì dùng asset
    const cookieGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16);
    const cookieMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFFD700, // Gold color
      emissive: 0x222200 // Slight glow
    });
    const cookieMesh = new THREE.Mesh(cookieGeometry, cookieMaterial);
    
    // Override cookie asset với geometry tự tạo
    this.assets["cookie"] = cookieMesh;
    console.log("Created custom cookie mesh:", this.assets["cookie"]);

    // CREATE MULTIPLE COOKIE SPAWNERS
    const numberOfSpawners = 3; // Tăng số này để có nhiều cookie cùng lúc
    
    for (let i = 0; i < numberOfSpawners; i++) {
      const cookieSpawnerEntity = new Entity();
      cookieSpawnerEntity.SetName(`CookieSpawner_${i}`);
      const levelcookienavmeshComponent = levelEntity.GetComponent("Navmesh");
      
      if (this.assets["cookie"]) {
        cookieSpawnerEntity.AddComponent(
          new CookieSpawner(
            this.assets["cookie"],
            this.scene,
            this.physicsWorld,
            levelcookienavmeshComponent
          )
        );
        this.entityManager.Add(cookieSpawnerEntity);
      }
    }
    this.entityManager.EndSetup();

    this.scene.add(this.camera);
    this.animFrameId = window.requestAnimationFrame(
      this.OnAnimationFrameHandler
    );
  }

  StartGame = async () => {
    window.cancelAnimationFrame(this.animFrameId);
    Input.ClearEventListners();

    // Reload assets for the selected map
    await this.LoadAssets();

    // Create entities and physics
    this.scene.clear();
    this.SetupPhysics();
    this.EntitySetup();
    this.ShowMenu(false);
  };

  // resize
  WindowResizeHanlder = () => {
    const { innerHeight, innerWidth } = window;
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  };
  // render loop with FPS limiting for better consistency
  OnAnimationFrameHandler = (t) => {
    if (this.lastFrameTime === null) {
      this.lastFrameTime = t;
      this.animFrameId = window.requestAnimationFrame(
        this.OnAnimationFrameHandler
      );
      return;
    }

    const delta = t - this.lastFrameTime; // Target 60 FPS (16.67ms per frame) for better responsiveness
    const targetFrameTime = 1000 / 60; // ms per frame

    if (delta >= targetFrameTime) {
      // Process frame with consistent timestep
      let timeElapsed = Math.min(1.0 / 30.0, delta * 0.001);
      this.Step(timeElapsed);
      this.lastFrameTime = t;
    }

    this.animFrameId = window.requestAnimationFrame(
      this.OnAnimationFrameHandler
    );
  };

  PhysicsUpdate = (world, timeStep) => {
    this.entityManager.PhysicsUpdate(world, timeStep);
  };
  Step(elapsedTime) {
    this.physicsWorld.stepSimulation(elapsedTime, 3); // Reduce sub-steps from 10 to 3
    //this.debugDrawer.update();

    // DEBUG: Count cookies in scene - THÊM VÀO ĐÂY
    let cookieCount = 0;
    this.scene.traverse((object) => {
      if (object.userData && object.userData.type === 'cookie') {
        cookieCount++;
      }
    });
    
    if (cookieCount > 0) {
      console.log("Cookies in scene:", cookieCount);
    }

    this.entityManager.Update(elapsedTime);
    // Force UIManager update for score sync
    const uiEntity = this.entityManager.Get("UIManager");
    if (uiEntity) {
      const ui = uiEntity.GetComponent("UIManager");
      if (ui && typeof ui.Update === "function") {
        ui.Update();
      }
    }
    this.renderer.render(this.scene, this.camera);
    // this.stats.update(); // REMOVE: stats window is gone, avoid freeze
  }
}

let _APP = null;
window.addEventListener("DOMContentLoaded", () => {
  _APP = new FPSGameApp();
  window._APP = _APP; // Expose app instance globally for game over handling
});

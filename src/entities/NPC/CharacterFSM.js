import { FiniteStateMachine, State } from "../../FiniteStateMachine";
import * as THREE from "three";

export default class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this.proxy = proxy;
    this.Init();
  }

  Init() {
    this.AddState("idle", new IdleState(this));
    this.AddState("patrol", new PatrolState(this));
    this.AddState("chase", new ChaseState(this));
    this.AddState("attack", new AttackState(this));
    this.AddState("dead", new DeadState(this));
  }
}

class IdleState extends State {
  constructor(parent) {
    super(parent);
    this.maxWaitTime = 5.0;
    this.minWaitTime = 1.0;
    this.waitTime = 0.0;
  }

  get Name() {
    return "idle";
  }
  get Animation() {
    return this.parent.proxy.animations["idle"];
  }

  Enter(prevState) {
    this.parent.proxy.canMove = false;
    const action = this.Animation.action;

    if (prevState) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevState.Animation.action, 0.5, true);
    }

    action.play();

    this.waitTime =
      Math.random() * (this.maxWaitTime - this.minWaitTime) + this.minWaitTime;
  }
  Update(t) {
    if (this.waitTime <= 0.0) {
      this.parent.SetState("patrol");
      return;
    }

    this.waitTime -= t;

    // Check for player more frequently and with wider detection
    const distanceToPlayer = this.parent.proxy.model.position.distanceTo(
      this.parent.proxy.player.Position
    );

    // Start chasing if player is within detection range, even without direct line of sight
    if (distanceToPlayer < 20 || this.parent.proxy.CanSeeThePlayer()) {
      console.log(
        `Monster ${
          this.parent.proxy.parent.name
        } detected player at distance ${distanceToPlayer.toFixed(2)}`
      );
      this.parent.SetState("chase");
    }
  }
}

class PatrolState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "patrol";
  }
  get Animation() {
    return this.parent.proxy.animations["walk"];
  }

  PatrolEnd = () => {
    this.parent.SetState("idle");
  };

  Enter(prevState) {
    this.parent.proxy.canMove = true;
    const action = this.Animation.action;

    if (prevState) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevState.Animation.action, 0.5, true);
    }

    action.play();

    this.parent.proxy.NavigateToRandomPoint();
  }
  Update(t) {
    // Check for player more aggressively during patrol
    const distanceToPlayer = this.parent.proxy.model.position.distanceTo(
      this.parent.proxy.player.Position
    );

    // Start chasing if player is close or visible
    if (distanceToPlayer < 25 || this.parent.proxy.CanSeeThePlayer()) {
      console.log(
        `Monster ${
          this.parent.proxy.parent.name
        } detected player during patrol at distance ${distanceToPlayer.toFixed(
          2
        )}`
      );
      this.parent.SetState("chase");
    } else if (this.parent.proxy.path && this.parent.proxy.path.length == 0) {
      this.parent.SetState("idle");
    }
  }
}

class ChaseState extends State {
  constructor(parent) {
    super(parent);
    this.updateFrequency = 0.2; // More frequent path updates for better tracking
    this.updateTimer = 0.0;
    this.attackDistance = 2.2; // Match controller attack distance
    this.shouldRotate = false;
    this.switchDelay = 0.1;
    this.lostPlayerTimer = 0.0;
    this.maxLostTime = 3.0; // How long to keep chasing after losing sight
  }

  get Name() {
    return "chase";
  }
  get Animation() {
    return this.parent.proxy.animations["run"];
  }

  RunToPlayer(prevState) {
    this.parent.proxy.canMove = true;
    const action = this.Animation.action;
    this.updateTimer = 0.0;

    if (prevState) {
      action.time = 0.0;
      action.enabled = true;
      action.setEffectiveTimeScale(1.0);
      action.setEffectiveWeight(1.0);
      action.crossFadeFrom(prevState.Animation.action, 0.2, true);
    }

    action.timeScale = 1.8; // Faster animation for more aggressive chase
    action.play();
  }

  Enter(prevState) {
    this.RunToPlayer(prevState);
    this.lostPlayerTimer = 0.0; // Reset timer when entering chase
    // Immediately navigate to player
    this.parent.proxy.NavigateToPlayer();
  }

  Update(t) {
    // More frequent path updates for better tracking
    if (this.updateTimer <= 0.0) {
      this.parent.proxy.NavigateToPlayer();
      this.updateTimer = this.updateFrequency;
    }

    // Check if we can see the player
    const canSeePlayer = this.parent.proxy.CanSeeThePlayer();

    if (canSeePlayer) {
      this.lostPlayerTimer = 0.0; // Reset lost timer if we can see player
    } else {
      this.lostPlayerTimer += t; // Increment lost timer
    }

    // Get distance to player for decision making
    const distanceToPlayer = this.parent.proxy.model.position.distanceTo(
      this.parent.proxy.player.Position
    );

    // Switch to attack if close enough
    if (this.parent.proxy.IsCloseToPlayer) {
      if (this.switchDelay <= 0.0) {
        this.parent.SetState("attack");
      }
      this.parent.proxy.ClearPath();
      this.switchDelay -= t;
    } else {
      this.switchDelay = 0.1;
    }

    // Face the player while chasing for better orientation
    if (canSeePlayer || distanceToPlayer < 10) {
      this.parent.proxy.FacePlayer(t, 2.0);
    }

    // Return to patrol if we've lost the player for too long and are far away
    if (this.lostPlayerTimer > this.maxLostTime && distanceToPlayer > 15) {
      console.log(
        `Monster ${this.parent.proxy.parent.name} lost player, returning to patrol`
      );
      this.parent.SetState("patrol");
      return;
    }

    this.updateTimer -= t;
  }
}

class AttackState extends State {
  constructor(parent) {
    super(parent);
    this.attackTime = 0.0;
    this.canHit = true;
  }

  get Name() {
    return "attack";
  }
  get Animation() {
    return this.parent.proxy.animations["attack"];
  }

  Enter(prevState) {
    this.parent.proxy.canMove = false;
    const action = this.Animation.action;
    this.attackTime = this.Animation.clip.duration;
    this.attackEvent = this.attackTime * 0.85;

    if (prevState) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevState.Animation.action, 0.1, true);
    }

    action.play();
  }

  Update(t) {
    this.parent.proxy.FacePlayer(t);

    if (!this.parent.proxy.IsCloseToPlayer && this.attackTime <= 0.0) {
      this.parent.SetState("chase");
      return;
    }

    if (
      this.canHit &&
      this.attackTime <= this.attackEvent &&
      this.parent.proxy.IsPlayerInHitbox
    ) {
      this.parent.proxy.HitPlayer();
      this.canHit = false;
    }

    if (this.attackTime <= 0.0) {
      this.attackTime = this.Animation.clip.duration;
      this.canHit = true;
    }

    this.attackTime -= t;
  }
}

class DeadState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "dead";
  }
  get Animation() {
    return this.parent.proxy.animations["die"];
  }

  Enter(prevState) {
    const action = this.Animation.action;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    if (prevState) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevState.Animation.action, 0.1, true);
    }

    action.play();
  }

  Update(t) {}
}

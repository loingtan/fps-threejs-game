/*
 * This file contains patches to be applied to the CharacterController.js file
 * Follow these instructions to implement the changes:
 *
 * 1. MAKE MONSTERS STAND STILL UNTIL THEY SEE PLAYER
 *    - In CharacterFSM.js:
 *      - In the IdleState class's Update method, remove the code that switches to patrol state
 *      - Make the monster only chase if it can actually see the player (CanSeeThePlayer returns true)
 *      - Increase the detection distance threshold for very close players
 *
 * 2. FIX MONSTERS GOING THROUGH CONTAINERS
 *    - In CharacterController.js:
 *      - Improve the CheckCollision method to use multiple raycasts at different angles
 *      - Use a larger collision detection radius for better obstacle avoidance
 *      - In MoveAlongPath method, add more collision checks before moving
 *      - When hit by the player, make monsters immediately switch to chase state
 *
 * IMPLEMENTATION STEPS:
 *
 * Step 1: In CharacterFSM.js, IdleState class Update method:
 * - Remove this code:
 *   if (this.waitTime <= 0.0) {
 *     this.parent.SetState("patrol");
 *     return;
 *   }
 *
 * Step 2: In CharacterFSM.js, PatrolState class:
 * - Set this.parent.proxy.canMove = false; to prevent movement
 * - Disable NavigateToRandomPoint call
 * - Make the monster stay still but check for player visibility
 *
 * Step 3: In CharacterController.js, CheckCollision method:
 * - Add multiple raycasts in different directions to better detect collisions
 * - Use a larger detection radius for obstacles (1.5 instead of 1.0)
 *
 * Step 4: In CharacterController.js, NavigateToRandomPoint method:
 * - Disable random movement by just setting this.ClearPath();
 */

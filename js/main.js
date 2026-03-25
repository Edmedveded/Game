// Basic Phaser 3 Setup
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#333333',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 } // Top-down view, so no gravity
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let targetPosition = null;
let isMoving = false;
let moveSpeed = 150; // pixels per second
let walls;
let enemies;
let targetedEnemy = null;
let attackRange = 40;

function preload() {
    // Load assets here later (images, spritesheets)
    // For now, we will draw simple graphics
}

function create() {
    // Create a simple floor grid
    this.add.grid(400, 300, 800, 600, 32, 32, 0x444444, 1, 0x555555, 1);

    // Create walls group
    walls = this.physics.add.staticGroup();

    // Create a simple dungeon room
    const wallColor = 0x888888;

    // Top wall
    let wallTop = this.add.rectangle(400, 50, 700, 20, wallColor);
    walls.add(wallTop);

    // Bottom wall
    let wallBottom = this.add.rectangle(400, 550, 700, 20, wallColor);
    walls.add(wallBottom);

    // Left wall
    let wallLeft = this.add.rectangle(50, 300, 20, 500, wallColor);
    walls.add(wallLeft);

    // Right wall
    let wallRight = this.add.rectangle(750, 300, 20, 500, wallColor);
    walls.add(wallRight);

    // Obstacle inside the room
    let obstacle = this.add.rectangle(400, 300, 100, 100, wallColor);
    walls.add(obstacle);

    // Basic setup for the first scene
    this.add.text(10, 10, 'Fate Web - Prototype (Click to move)', { font: '16px Arial', fill: '#ffffff' }).setDepth(100);

    // Create the player (a simple circle for now)
    // Start slightly offset to avoid the middle obstacle
    player = this.add.circle(200, 300, 16, 0x00ff00);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);

    // Add collision between player and walls
    this.physics.add.collider(player, walls, handleWallCollision, null, this);

    // Create enemies group
    enemies = this.physics.add.group();

    // Add a couple of placeholder enemies (red squares)
    let enemy1 = this.add.rectangle(600, 150, 30, 30, 0xff0000);
    this.physics.add.existing(enemy1);
    enemy1.body.setImmovable(true);
    enemy1.health = 3;
    enemies.add(enemy1);

    let enemy2 = this.add.rectangle(600, 450, 30, 30, 0xff0000);
    this.physics.add.existing(enemy2);
    enemy2.body.setImmovable(true);
    enemy2.health = 3;
    enemies.add(enemy2);

    // Collision between player and enemies
    this.physics.add.collider(player, enemies);

    // Setup click listener
    this.input.on('pointerdown', function (pointer) {
        // Check if we clicked on an enemy
        let clickedEnemy = false;

        enemies.getChildren().forEach((enemy) => {
            if (enemy.active) {
                // Check if click is inside the enemy bounds (roughly)
                const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, enemy.x, enemy.y);
                if (dist < 20) {
                    targetedEnemy = enemy;
                    clickedEnemy = true;
                }
            }
        });

        // Set target position based on click or enemy location
        targetPosition = new Phaser.Math.Vector2(pointer.x, pointer.y);
        isMoving = true;

        if (!clickedEnemy) {
            targetedEnemy = null;
        }

        // Move towards target
        this.physics.moveToObject(player, targetPosition, moveSpeed);
    }, this);
}

function handleWallCollision() {
    // When hitting a wall, stop moving to avoid sliding infinitely against it
    // in a weird way with moveToObject
    player.body.reset(player.x, player.y);
    isMoving = false;
    targetPosition = null;
}

function update() {
    // Stop moving if close enough to target
    if (isMoving && targetPosition) {
        let stopDistance = 4;

        // If we are targeting an enemy, stop when in attack range
        if (targetedEnemy && targetedEnemy.active) {
            const distToEnemy = Phaser.Math.Distance.Between(player.x, player.y, targetedEnemy.x, targetedEnemy.y);
            if (distToEnemy <= attackRange) {
                // Attack!
                player.body.reset(player.x, player.y);
                isMoving = false;
                targetPosition = null;
                attackEnemy(targetedEnemy);
                return;
            }
        }

        const distance = Phaser.Math.Distance.Between(player.x, player.y, targetPosition.x, targetPosition.y);

        // If close enough to ground target, stop
        if (distance < stopDistance) {
            player.body.reset(targetPosition.x, targetPosition.y);
            isMoving = false;
            targetPosition = null;
        }
    }
}

function attackEnemy(enemy) {
    if (!enemy || !enemy.active) return;

    enemy.health -= 1;

    // Flash white to show damage
    enemy.fillColor = 0xffffff;

    // Reset color after a short delay
    game.scene.scenes[0].time.delayedCall(100, () => {
        if (enemy.active) {
            enemy.fillColor = 0xff0000;
        }
    });

    if (enemy.health <= 0) {
        // Enemy dies
        enemy.destroy();
        targetedEnemy = null;
    }
}
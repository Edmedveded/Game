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
let targetMarker = null;

function preload() {
    // Generate simple textures programmatically using Phaser's Graphics
    const graphics = this.make.graphics();

    // Floor Tile
    graphics.fillStyle(0x3e3c38, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.lineStyle(2, 0x2a2825, 1);
    graphics.strokeRect(0, 0, 64, 64);
    // Add some random details to the floor
    graphics.fillStyle(0x302e2b, 1);
    graphics.fillRect(10, 10, 8, 8);
    graphics.fillRect(40, 30, 12, 6);
    graphics.generateTexture('floor', 64, 64);
    graphics.clear();

    // Wall Tile
    graphics.fillStyle(0x5a5650, 1);
    graphics.fillRect(0, 0, 64, 64);
    // Draw brick pattern
    graphics.lineStyle(2, 0x1f1d1b, 1);
    graphics.strokeRect(0, 0, 64, 64); // border
    graphics.lineBetween(0, 32, 64, 32); // middle horizontal line
    graphics.lineBetween(32, 0, 32, 32); // top vertical line
    graphics.lineBetween(16, 32, 16, 64); // bottom vertical line 1
    graphics.lineBetween(48, 32, 48, 64); // bottom vertical line 2
    graphics.generateTexture('wall', 64, 64);
    graphics.clear();

    // Player (A simple character)
    graphics.fillStyle(0x4287f5, 1); // Blue body
    graphics.fillCircle(16, 16, 16);
    // Simple face/direction indicator (lighter front)
    graphics.fillStyle(0x9bc0ff, 1);
    graphics.fillCircle(24, 16, 6);
    graphics.generateTexture('player', 32, 32);
    graphics.clear();

    // Enemy (Goblin/Spider like)
    graphics.fillStyle(0x2a7a3a, 1); // Green body
    graphics.fillCircle(16, 16, 16);
    // Red eyes
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(24, 10, 4);
    graphics.fillCircle(24, 22, 4);
    graphics.generateTexture('enemy', 32, 32);
    graphics.clear();

    // Target Indicator (X marks the spot)
    graphics.lineStyle(2, 0xffffff, 0.8);
    graphics.strokeCircle(16, 16, 12);
    graphics.lineBetween(16, 0, 16, 8);
    graphics.lineBetween(16, 24, 16, 32);
    graphics.lineBetween(0, 16, 8, 16);
    graphics.lineBetween(24, 16, 32, 16);
    graphics.generateTexture('target', 32, 32);
    graphics.clear();

    // Attack Slash Effect
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.beginPath();
    graphics.arc(32, 32, 24, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false);
    graphics.strokePath();
    graphics.generateTexture('slash', 64, 64);
    graphics.clear();
}

function create() {
    // Create floor with repeating tiles
    this.add.tileSprite(400, 300, 800, 600, 'floor');

    // Create walls group
    walls = this.physics.add.staticGroup();

    // Create a more interesting dungeon room shape using a simple map array
    const levelMap = [
        "WWWWWWWWWWWW",
        "W..........W",
        "W..WW..E...W",
        "W..WW......W",
        "W......W...W",
        "W..P...W...W",
        "WWWW.......W",
        "W......E...W",
        "WWWWWWWWWWWW"
    ];

    const tileSize = 64;
    const startX = 32;
    const startY = 32;

    // Remove old enemies group init as we will do it below based on the map
    enemies = this.physics.add.group();

    let playerSpawn = {x: 200, y: 300}; // Default fallback

    for (let row = 0; row < levelMap.length; row++) {
        for (let col = 0; col < levelMap[row].length; col++) {
            let char = levelMap[row][col];
            let px = startX + col * tileSize;
            let py = startY + row * tileSize;

            if (char === 'W') {
                walls.create(px, py, 'wall');
            } else if (char === 'P') {
                playerSpawn = {x: px, y: py};
            } else if (char === 'E') {
                let enemy = enemies.create(px, py, 'enemy');
                enemy.body.setImmovable(true);
                enemy.setCircle(16);
                enemy.health = 3;
                enemy.setRotation(Math.PI);
            }
        }
    }

    // Basic setup for the first scene
    this.add.text(10, 10, 'Fate Web - Prototype (Click to move/attack)', { font: '16px Arial', fill: '#ffffff' }).setDepth(100);

    // Create the player at the spawn point determined by the map
    player = this.physics.add.sprite(playerSpawn.x, playerSpawn.y, 'player');
    player.body.setCollideWorldBounds(true);
    player.setCircle(16); // Better collision shape

    // Add collision between player and walls
    this.physics.add.collider(player, walls, handleWallCollision, null, this);

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

        // Show target marker
        if (targetMarker) {
            targetMarker.destroy();
        }

        targetMarker = this.add.sprite(targetPosition.x, targetPosition.y, 'target');
        targetMarker.setDepth(10);

        // Rotate the marker slightly over time
        this.tweens.add({
            targets: targetMarker,
            angle: 90,
            duration: 500,
            repeat: -1
        });

        // Move towards target and rotate player
        this.physics.moveToObject(player, targetPosition, moveSpeed);
        player.setRotation(Phaser.Math.Angle.Between(player.x, player.y, targetPosition.x, targetPosition.y));
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
                if(targetMarker) {
                    targetMarker.destroy();
                    targetMarker = null;
                }
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
            if(targetMarker) {
                targetMarker.destroy();
                targetMarker = null;
            }
        }
    }
}

function attackEnemy(enemy) {
    if (!enemy || !enemy.active) return;

    let scene = game.scene.scenes[0];
    enemy.health -= 1;

    // Calculate angle to enemy
    let angleToEnemy = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
    player.setRotation(angleToEnemy);

    // Show Slash Effect
    let slash = scene.add.sprite(
        player.x + Math.cos(angleToEnemy) * 20,
        player.y + Math.sin(angleToEnemy) * 20,
        'slash'
    );
    slash.setRotation(angleToEnemy);
    slash.setDepth(20);

    // Animate slash
    scene.tweens.add({
        targets: slash,
        alpha: 0,
        scale: 1.5,
        duration: 200,
        onComplete: () => {
            slash.destroy();
        }
    });

    // Flash red to show damage
    enemy.setTint(0xff0000);

    // Reset color after a short delay
    scene.time.delayedCall(100, () => {
        if (enemy.active) {
            enemy.clearTint();
        }
    });

    if (enemy.health <= 0) {
        // Enemy dies

        // Death animation (shrink and fade)
        scene.tweens.add({
            targets: enemy,
            scale: 0.1,
            alpha: 0,
            angle: 180,
            duration: 300,
            onComplete: () => {
                enemy.destroy();
            }
        });
        targetedEnemy = null;
    } else {
        // Knockback slightly
        scene.tweens.add({
            targets: enemy,
            x: enemy.x + Math.cos(angleToEnemy) * 10,
            y: enemy.y + Math.sin(angleToEnemy) * 10,
            duration: 100
        });
    }
}
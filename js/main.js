// Basic Phaser 3 Setup for Web Worms
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#87CEEB', // Sky blue
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 600 } // Stronger gravity for worms
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let terrainGroup;
const blockSize = 10;
let worms = [];
let currentWormIndex = 0;
let turnText;
let healthTexts = [];

// Artillery Mechanics
let aimAngle = -Math.PI / 4; // Default aim up-right 45 deg
let aimGraphics; // Replacing aimLine with a dotted graphics arc
let chargePower = 0;
let isCharging = false;
let maxCharge = 1000;
let projectile = null;
let powerBar;
let powerBarBg;
let cloudGroup;

function preload() {
    // Load assets here later
}

function create() {
    // Sky Gradient
    let bg = this.add.graphics();
    bg.fillGradientStyle(0x1e90ff, 0x1e90ff, 0x87ceeb, 0x87ceeb, 1);
    bg.fillRect(0, 0, 800, 600);
    bg.setDepth(-10);

    // Clouds
    cloudGroup = this.add.group();
    for(let i=0; i<5; i++) {
        let cx = Phaser.Math.Between(0, 800);
        let cy = Phaser.Math.Between(50, 250);
        createCloud(this, cx, cy);
    }

    // Setup inputs
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    terrainGroup = this.physics.add.staticGroup();
    generateTerrain(this);

    // Create Worms
    let worm1 = createWorm(this, 200, 100, 0xff0000); // Red worm
    let worm2 = createWorm(this, 600, 100, 0x0000ff); // Blue worm

    worms.push(worm1);
    worms.push(worm2);

    this.physics.add.collider(worms, terrainGroup);

    // UI Panels
    let uiBg = this.add.graphics();
    uiBg.fillStyle(0x000000, 0.4);
    uiBg.fillRoundedRect(10, 10, 780, 50, 10);
    uiBg.setDepth(99);

    turnText = this.add.text(config.width / 2, 25, "Player 1's Turn", { font: 'bold 24px Arial', fill: '#ffcc00', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(100);

    healthTexts.push(this.add.text(30, 25, "P1 HP: 100", { font: 'bold 20px Arial', fill: '#ff6666', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(100));
    healthTexts.push(this.add.text(config.width - 30, 25, "P2 HP: 100", { font: 'bold 20px Arial', fill: '#6666ff', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0.5).setDepth(100));

    // Power Bar UI
    powerBarBg = this.add.rectangle(config.width / 2, 70, 200, 15, 0x000000).setDepth(100).setOrigin(0.5);
    powerBar = this.add.rectangle(config.width / 2 - 100, 70, 0, 15, 0xff0000).setDepth(101).setOrigin(0, 0.5);

    // Aim Graphics (Dotted Line)
    aimGraphics = this.add.graphics().setDepth(50);
}

function createCloud(scene, x, y) {
    let cloud = scene.add.graphics();
    cloud.fillStyle(0xffffff, 0.8);
    cloud.fillCircle(x, y, 30);
    cloud.fillCircle(x - 20, y + 10, 20);
    cloud.fillCircle(x + 20, y + 10, 25);
    cloud.fillCircle(x, y + 15, 25);

    // Simple drift animation
    scene.tweens.add({
        targets: cloud,
        x: x + 100,
        duration: Phaser.Math.Between(15000, 25000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

function update() {
    if (worms.length === 0) return;

    let currentWorm = worms[currentWormIndex];
    if (!currentWorm || !currentWorm.active) return;

    // Handle projectile in flight
    if (projectile && projectile.active) {
        // Stop worm movement while projectile is flying
        currentWorm.body.setVelocityX(0);
        return;
    }

    // Aiming
    if (this.wKey.isDown) {
        aimAngle -= 0.05;
    } else if (this.sKey.isDown) {
        aimAngle += 0.05;
    }

    // Update Aim Dotted Line
    aimGraphics.clear();
    aimGraphics.fillStyle(0xffffff, 1);
    for(let i = 1; i <= 5; i++) {
        let dotX = currentWorm.x + Math.cos(aimAngle) * (15 * i);
        let dotY = currentWorm.y + Math.sin(aimAngle) * (15 * i);
        aimGraphics.fillCircle(dotX, dotY, 3);
    }

    // Charging and Firing
    if (this.spacebar.isDown) {
        isCharging = true;
        chargePower += 20;
        if (chargePower > maxCharge) chargePower = maxCharge;
    } else if (isCharging && this.spacebar.isUp) {
        fireProjectile(this, currentWorm, chargePower, aimAngle);
        isCharging = false;
        chargePower = 0;
    }

    // Update Power Bar
    let powerRatio = chargePower / maxCharge;
    powerBar.width = 200 * powerRatio;

    // Color gradient for power bar
    if (powerRatio < 0.5) {
        powerBar.fillColor = 0xffff00; // Yellow
    } else if (powerRatio < 0.8) {
        powerBar.fillColor = 0xff8800; // Orange
    } else {
        powerBar.fillColor = 0xff0000; // Red
    }

    // Basic Movement (Left/Right + Jump)
    if (!isCharging) { // Can't move while charging
        if (this.cursors.left.isDown) {
            currentWorm.body.setVelocityX(-100);
            aimAngle = Math.PI - Math.abs(aimAngle) * Math.sign(aimAngle); // Flip aim when moving
            if (aimAngle > Math.PI) aimAngle -= Math.PI * 2;
            currentWorm.setFlipX(true); // Face left
        } else if (this.cursors.right.isDown) {
            currentWorm.body.setVelocityX(100);
            aimAngle = Math.abs(aimAngle) < Math.PI/2 ? aimAngle : Math.PI - aimAngle;
            if (aimAngle > Math.PI) aimAngle -= Math.PI * 2;
            currentWorm.setFlipX(false); // Face right
        } else {
            currentWorm.body.setVelocityX(0);
        }

        if (this.cursors.up.isDown && currentWorm.body.touching.down) {
            currentWorm.body.setVelocityY(-350);
        }
    }
}

function fireProjectile(scene, worm, power, angle) {
    aimGraphics.clear();

    projectile = scene.add.circle(worm.x, worm.y, 6, 0x333333);
    projectile.setStrokeStyle(2, 0x000000); // Add outline to projectile
    scene.physics.add.existing(projectile);

    let velX = Math.cos(angle) * power;
    let velY = Math.sin(angle) * power;

    projectile.body.setVelocity(velX, velY);
    projectile.body.setCollideWorldBounds(true);
    projectile.body.onWorldBounds = true; // Trigger event on world bounds

    // Projectile collides with terrain
    scene.physics.add.collider(projectile, terrainGroup, handleExplosion, null, scene);

    // Projectile collides with worms
    scene.physics.add.collider(projectile, worms, handleExplosion, null, scene);

    // Destroy projectile if it hits world bounds (e.g. falls out bottom)
    scene.physics.world.once('worldbounds', (body) => {
        if (body.gameObject === projectile) {
             projectile.destroy();
             projectile = null;
             nextTurn();
        }
    });
}

function handleExplosion(proj, target) {
    let expX = proj.x;
    let expY = proj.y;
    let radius = 60;
    let maxDamage = 50;

    // Enhanced Visual Explosion
    let explosionCore = proj.scene.add.circle(expX, expY, 5, 0xffffff, 1);
    let explosionFire = proj.scene.add.circle(expX, expY, 15, 0xff8800, 0.8);
    let explosionSmoke = proj.scene.add.circle(expX, expY, 20, 0x333333, 0.6);

    proj.scene.tweens.add({
        targets: explosionCore,
        radius: radius * 0.4,
        alpha: 0,
        duration: 200,
        onComplete: () => explosionCore.destroy()
    });

    proj.scene.tweens.add({
        targets: explosionFire,
        radius: radius * 0.8,
        alpha: 0,
        duration: 300,
        onComplete: () => explosionFire.destroy()
    });

    proj.scene.tweens.add({
        targets: explosionSmoke,
        radius: radius,
        alpha: 0,
        duration: 500,
        onComplete: () => explosionSmoke.destroy()
    });

    // Destroy Terrain
    // Iterate over a copy of the children array to avoid skipping elements when destroying them
    const blocksToDestroy = terrainGroup.getChildren().filter(block => {
        if (block.active) {
            let dist = Phaser.Math.Distance.Between(expX, expY, block.x, block.y);
            return dist < radius;
        }
        return false;
    });

    blocksToDestroy.forEach(block => block.destroy());

    // Damage and Knockback Worms
    worms.forEach((w, index) => {
        if (w.active) {
            let dist = Phaser.Math.Distance.Between(expX, expY, w.x, w.y);
            if (dist < radius) {
                // Calculate damage (closer = more damage)
                let dmg = Math.floor(maxDamage * (1 - dist / radius));
                w.health -= dmg;
                healthTexts[index].setText(`P${index+1} HP: ${Math.max(0, w.health)}`);

                // Knockback
                let angle = Phaser.Math.Angle.Between(expX, expY, w.x, w.y);
                let knockbackForce = 300 * (1 - dist / radius);
                w.body.setVelocity(Math.cos(angle) * knockbackForce, Math.sin(angle) * knockbackForce - 150);

                if (w.health <= 0) {
                    w.destroy();
                    w.active = false;
                }
            }
        }
    });

    proj.destroy();
    projectile = null;

    checkWinCondition(proj.scene);
    if(worms.filter(w => w.active).length > 1) {
         nextTurn();
    }
}

function checkWinCondition(scene) {
    let aliveWorms = worms.filter(w => w.active);
    if (aliveWorms.length <= 1) {
        if (aliveWorms.length === 1) {
            let winnerIndex = worms.indexOf(aliveWorms[0]);
            turnText.setText(`Player ${winnerIndex + 1} Wins!`);
        } else {
             turnText.setText(`Draw!`);
        }
        // Disable aiming/shooting
        aimGraphics.clear();
        scene.spacebar.isDown = false;
    }
}

function generateTerrain(scene) {
    const width = config.width;
    const height = config.height;

    for (let x = 0; x < width; x += blockSize) {
        let terrainY = 300 + Math.sin(x / 100) * 100 + Math.sin(x / 50) * 30;

        // Ensure terrainY is aligned to grid for clean top edge
        terrainY = Math.floor(terrainY / blockSize) * blockSize;

        for (let y = terrainY; y < height; y += blockSize) {
            // Give dirt color to lower blocks, grass color to top
            let isTop = (y === terrainY);
            let color = isTop ? 0x3CB371 : 0x8B4513; // Medium Sea Green / Saddle Brown

            let block = scene.add.rectangle(x + blockSize/2, y + blockSize/2, blockSize, blockSize, color);
            // Slight border to make blocks look better
            block.setStrokeStyle(1, 0x000000, 0.2);

            scene.physics.add.existing(block, true);
            terrainGroup.add(block);
        }
    }
}

function createWorm(scene, x, y, color) {
    // Creating a more "worm-like" look using a container
    let wormContainer = scene.add.container(x, y);
    wormContainer.setSize(20, 20);
    scene.physics.add.existing(wormContainer);

    // Body
    let bodyGraphics = scene.add.graphics();
    bodyGraphics.fillStyle(color, 1);
    bodyGraphics.fillRoundedRect(-10, -10, 20, 20, 8); // Pill/rounded square shape
    bodyGraphics.lineStyle(2, 0x000000, 1);
    bodyGraphics.strokeRoundedRect(-10, -10, 20, 20, 8);
    wormContainer.add(bodyGraphics);

    // Eyes
    let eyeWhite = scene.add.circle(4, -2, 4, 0xffffff);
    let eyePupil = scene.add.circle(5, -2, 2, 0x000000);
    wormContainer.add([eyeWhite, eyePupil]);

    wormContainer.body.setCollideWorldBounds(true);
    wormContainer.body.setBounce(0.1);
    wormContainer.body.setDragX(200); // Friction

    // Properties
    wormContainer.health = 100;
    wormContainer.color = color;
    wormContainer.active = true;

    // Helper method to flip sprite
    wormContainer.setFlipX = function(flip) {
        // Simple way to flip the container visually
        this.scaleX = flip ? -1 : 1;
    };

    return wormContainer;
}

function nextTurn() {
    let startIdx = currentWormIndex;
    do {
        currentWormIndex = (currentWormIndex + 1) % worms.length;
    } while (!worms[currentWormIndex].active && currentWormIndex !== startIdx);

    turnText.setText(`Player ${currentWormIndex + 1}'s Turn`);

    // Reset aim angle and facing direction based on side
    let currentWorm = worms[currentWormIndex];
    if (currentWormIndex === 0) {
         aimAngle = -Math.PI / 4;
         if (currentWorm) currentWorm.setFlipX(false);
    } else {
         aimAngle = -Math.PI * 3/4;
         if (currentWorm) currentWorm.setFlipX(true);
    }
}

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
let aimLine;
let chargePower = 0;
let isCharging = false;
let maxCharge = 1000;
let projectile = null;
let powerText;

function preload() {
    // Load assets here later
}

function create() {
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

    // UI
    turnText = this.add.text(config.width / 2, 20, "Player 1's Turn", { font: '24px Arial', fill: '#000' }).setOrigin(0.5).setDepth(100);

    healthTexts.push(this.add.text(50, 20, "P1 Health: 100", { font: '20px Arial', fill: '#f00' }).setDepth(100));
    healthTexts.push(this.add.text(config.width - 200, 20, "P2 Health: 100", { font: '20px Arial', fill: '#00f' }).setDepth(100));

    powerText = this.add.text(config.width / 2, 50, "Power: 0", { font: '20px Arial', fill: '#000' }).setOrigin(0.5).setDepth(100);

    // Aim Line
    aimLine = this.add.line(0, 0, 0, 0, 50, 0, 0xffffff).setOrigin(0, 0).setDepth(50);
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

    // Update Aim Line Position and Angle
    aimLine.setPosition(currentWorm.x, currentWorm.y);
    let endX = Math.cos(aimAngle) * 50;
    let endY = Math.sin(aimAngle) * 50;
    aimLine.setTo(0, 0, endX, endY);
    aimLine.setVisible(true);

    // Charging and Firing
    if (this.spacebar.isDown) {
        isCharging = true;
        chargePower += 15;
        if (chargePower > maxCharge) chargePower = maxCharge;
    } else if (isCharging && this.spacebar.isUp) {
        fireProjectile(this, currentWorm, chargePower, aimAngle);
        isCharging = false;
        chargePower = 0;
    }

    powerText.setText(`Power: ${Math.floor(chargePower)}`);

    // Basic Movement (Left/Right + Jump)
    if (!isCharging) { // Can't move while charging
        if (this.cursors.left.isDown) {
            currentWorm.body.setVelocityX(-100);
            aimAngle = Math.PI - Math.abs(aimAngle) * Math.sign(aimAngle); // Flip aim when moving
            if (aimAngle > Math.PI) aimAngle -= Math.PI * 2;
        } else if (this.cursors.right.isDown) {
            currentWorm.body.setVelocityX(100);
            aimAngle = Math.abs(aimAngle) < Math.PI/2 ? aimAngle : Math.PI - aimAngle;
            if (aimAngle > Math.PI) aimAngle -= Math.PI * 2;
        } else {
            currentWorm.body.setVelocityX(0);
        }

        if (this.cursors.up.isDown && currentWorm.body.touching.down) {
            currentWorm.body.setVelocityY(-350);
        }
    }
}

function fireProjectile(scene, worm, power, angle) {
    aimLine.setVisible(false);

    projectile = scene.add.circle(worm.x, worm.y, 5, 0x000000);
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

    // Visual Explosion
    let explosion = proj.scene.add.circle(expX, expY, radius, 0xffa500, 0.7);
    proj.scene.time.delayedCall(200, () => { explosion.destroy(); });

    // Destroy Terrain
    terrainGroup.getChildren().forEach(block => {
        if (block.active) {
            let dist = Phaser.Math.Distance.Between(expX, expY, block.x, block.y);
            if (dist < radius) {
                block.destroy();
            }
        }
    });

    // Damage and Knockback Worms
    worms.forEach((w, index) => {
        if (w.active) {
            let dist = Phaser.Math.Distance.Between(expX, expY, w.x, w.y);
            if (dist < radius) {
                // Calculate damage (closer = more damage)
                let dmg = Math.floor(maxDamage * (1 - dist / radius));
                w.health -= dmg;
                healthTexts[index].setText(`P${index+1} Health: ${w.health}`);

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
        aimLine.setVisible(false);
        scene.spacebar.isDown = false;
    }
}

function generateTerrain(scene) {
    const width = config.width;
    const height = config.height;

    for (let x = 0; x < width; x += blockSize) {
        let terrainY = 300 + Math.sin(x / 100) * 100 + Math.sin(x / 50) * 30;

        for (let y = height; y > terrainY; y -= blockSize) {
            let block = scene.add.rectangle(x + blockSize/2, y - blockSize/2, blockSize, blockSize, 0x228B22);
            scene.physics.add.existing(block, true);
            terrainGroup.add(block);
        }
    }
}

function createWorm(scene, x, y, color) {
    let worm = scene.add.rectangle(x, y, 20, 20, color);
    scene.physics.add.existing(worm);
    worm.body.setCollideWorldBounds(true);
    worm.body.setBounce(0.1);
    worm.body.setDragX(200); // Friction
    worm.health = 100;
    worm.color = color;
    worm.active = true;
    return worm;
}

function nextTurn() {
    let startIdx = currentWormIndex;
    do {
        currentWormIndex = (currentWormIndex + 1) % worms.length;
    } while (!worms[currentWormIndex].active && currentWormIndex !== startIdx);

    turnText.setText(`Player ${currentWormIndex + 1}'s Turn`);

    // Reset aim angle based on side
    if (currentWormIndex === 0) {
         aimAngle = -Math.PI / 4;
    } else {
         aimAngle = -Math.PI * 3/4;
    }
}

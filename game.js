// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 8;
const SHOOT_DELAY = 50; // Slightly faster shooting

// Visual effects constants
const PARTICLE_COUNT = 15;
const STAR_COUNT = 100;
const SCREEN_SHAKE_AMOUNT = 5;
const SCREEN_SHAKE_DURATION = 200;

// Power-up constants
const POWERUP_DURATION = 5000; // 5 seconds
const POWERUP_SPAWN_CHANCE = 0.002; // 0.2% chance per frame
const SPECIAL_BULLET_DAMAGE = 2; // Special bullets do double damage

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let difficulty = null;
let lastShootTime = 0;
let isMoving = false;
let screenShake = { amount: 0, duration: 0 };
let specialBulletTimer = 0;
let hasSpecialBullets = false;
let lastFrameTime = 0;
let animationFrameId = null;
let isMultiplayer = false;
let player2Score = 0;
let isShooting = false;
let shootInterval = null;

// Load images
const playerImage = new Image();
const enemyImage = new Image();
playerImage.src = 'space.jpg';
enemyImage.src = 'enemy.jpg';

// Game objects
let player;
let player2;
let enemies = [];
let projectiles = [];
let stars = [];
let particles = [];
let powerups = [];

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set fixed canvas size
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Sound management
let soundEnabled = true;
const sounds = {
    shoot: document.getElementById('shootSound'),
    explosion: document.getElementById('explosionSound'),
    gameOver: document.getElementById('gameOverSound'),
    background: document.getElementById('bgMusic')
};

function playSound(sound) {
    if (soundEnabled && sounds[sound]) {
        try {
            sounds[sound].currentTime = 0;
            sounds[sound].play();
        } catch (e) {
            console.log("Audio play failed:", e);
        }
    }
}

// Game objects classes
class Player {
    constructor(x, y, controls, isTopPlayer = false) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.dx = 0;
        this.controls = controls;
        this.lastShootTime = 0;
        this.score = 0;
        this.isTopPlayer = isTopPlayer;
        this.health = 100;
        this.isAlive = true;
    }

    update() {
        if (!this.isAlive) {
            this.y += 5; // Fall when defeated
            return;
        }
        this.x += this.dx;
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;
    }

    shoot() {
        if (!this.isAlive) return;
        if (Date.now() - this.lastShootTime > SHOOT_DELAY) {
            projectiles.push(new Projectile(
                this.x + this.width/2,
                this.isTopPlayer ? this.y + this.height : this.y,
                hasSpecialBullets,
                this,
                this.isTopPlayer
            ));
            playSound('shoot');
            this.lastShootTime = Date.now();
        }
    }

    draw() {
        if (!this.isAlive && this.y > GAME_HEIGHT) return;
        
        ctx.save();
        
        if (screenShake.duration > 0) {
            ctx.translate(
                Math.random() * screenShake.amount - screenShake.amount/2,
                Math.random() * screenShake.amount - screenShake.amount/2
            );
        }
        
        // Only draw health bars and labels in multiplayer mode
        if (this.isAlive && isMultiplayer) {
            const healthBarWidth = 150;
            const healthBarHeight = 10;
            const healthPercentage = this.health / 100;
            
            // Position health bars - P2 top-left, P1 bottom-right
            const healthBarX = this.isTopPlayer ? 10 : GAME_WIDTH - healthBarWidth - 10;
            const healthBarY = this.isTopPlayer ? 10 : GAME_HEIGHT - healthBarHeight - 10;
            
            // Health bar background (red)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            // Health bar foreground (blue instead of green)
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
            
            // Draw player number next to health bar
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            if (this.isTopPlayer) {
                ctx.textAlign = 'left';
                ctx.fillText('P2', 10, healthBarY + healthBarHeight + 20);
            } else {
                ctx.textAlign = 'right';
                ctx.fillText('P1', GAME_WIDTH - 10, healthBarY - 5);
            }
        }
        
        // Draw ship
        if (playerImage.complete) {
            ctx.save();
            if (this.isTopPlayer) {
                // Rotate the top player's ship 180 degrees
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.rotate(Math.PI);
                ctx.drawImage(playerImage, -this.width/2, -this.height/2, this.width, this.height);
            } else {
                ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
            }
            ctx.restore();
            
            // Thruster effect
            if (isMoving && this.isAlive) {
                const gradient = ctx.createLinearGradient(
                    this.x + this.width * 0.3,
                    this.isTopPlayer ? this.y - 30 : this.y + this.height,
                    this.x + this.width * 0.5,
                    this.isTopPlayer ? this.y : this.y + this.height + 30
                );
                gradient.addColorStop(0, '#ff6600');
                gradient.addColorStop(1, 'rgba(255, 102, 0, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                if (this.isTopPlayer) {
                    ctx.moveTo(this.x + this.width * 0.3, this.y);
                    ctx.lineTo(this.x + this.width * 0.5, this.y - 30);
                    ctx.lineTo(this.x + this.width * 0.7, this.y);
                } else {
                    ctx.moveTo(this.x + this.width * 0.3, this.y + this.height);
                    ctx.lineTo(this.x + this.width * 0.5, this.y + this.height + 30);
                    ctx.lineTo(this.x + this.width * 0.7, this.y + this.height);
                }
                ctx.closePath();
                ctx.fill();
            }
        } else {
            // Fallback shape
            ctx.fillStyle = this.isTopPlayer ? '#ff0000' : '#00ff00';
            ctx.beginPath();
            if (this.isTopPlayer) {
                ctx.moveTo(this.x + this.width/2, this.y + this.height);
                ctx.lineTo(this.x + this.width, this.y);
                ctx.lineTo(this.x, this.y);
            } else {
                ctx.moveTo(this.x + this.width/2, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.lineTo(this.x, this.y + this.height);
            }
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }

    takeDamage(damage) {
        if (!this.isAlive) return;
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
            createExplosion(this.x + this.width/2, this.y + this.height/2, '#ff0000');
            playSound('explosion');
        }
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

class Enemy {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.speed = speed;
        this.angle = 0;
    }

    update() {
        this.y += this.speed;
        this.angle += 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);
        
        if (enemyImage.complete) {
            ctx.drawImage(
                enemyImage, 
                -this.width/2, 
                -this.height/2, 
                this.width, 
                this.height
            );
        } else {
            // Fallback if image fails to load
            ctx.fillStyle = difficulty ? DIFFICULTY_SETTINGS[difficulty].color : '#ff0000';
            ctx.beginPath();
            ctx.moveTo(0, -this.height/2);
            ctx.lineTo(this.width/2, 0);
            ctx.lineTo(0, this.height/2);
            ctx.lineTo(-this.width/2, 0);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

class Projectile {
    constructor(x, y, isSpecial = false, player, isTopPlayer = false) {
        this.x = x;
        this.y = y;
        this.width = isSpecial ? 8 : 4;
        this.height = isSpecial ? 20 : 16;
        this.speed = isSpecial ? 20 : 15;
        this.isSpecial = isSpecial;
        this.player = player;
        this.isTopPlayer = isTopPlayer;
    }

    update() {
        this.y += this.isTopPlayer ? this.speed : -this.speed;
    }

    draw() {
        ctx.save();
        
        if (this.isSpecial) {
            // Special bullet with enhanced effects
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 20;
            
            // Main bullet
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            
            // Particle trail for special bullets
            if (Math.random() < 0.5) {
                particles.push(new Particle(
                    this.x,
                    this.y + this.height,
                    '#ff00ff',
                    1,
                    1
                ));
            }
        } else {
            // Regular bullet
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            
            ctx.shadowColor = '#0066ff';
            ctx.shadowBlur = 15;
            ctx.fillStyle = 'rgba(0, 102, 255, 0.5)';
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        }
        
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x - this.width/2,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    EASY: {
        enemySpawnChance: 0.02,
        enemySpeed: 2,
        scoreMultiplier: 1,
        color: '#00ff00'
    },
    MEDIUM: {
        enemySpawnChance: 0.03,
        enemySpeed: 3,
        scoreMultiplier: 2,
        color: '#ffa500'
    },
    HARD: {
        enemySpawnChance: 0.04,
        enemySpeed: 4,
        scoreMultiplier: 3,
        color: '#ff0000'
    }
};

// Particle class for explosions and effects
class Particle {
    constructor(x, y, color, speed = 3, size = 2) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.alpha = 1;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = speed * (Math.random() + 0.5);
        this.decay = 0.02;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.alpha -= this.decay;
        return this.alpha > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Star class for background
class Star {
    constructor() {
        this.reset();
        this.y = Math.random() * GAME_HEIGHT;
    }

    reset() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = 0;
        this.speed = Math.random() * 2 + 1;
        this.size = Math.random() * 2 + 1;
        this.brightness = Math.random() * 0.5 + 0.5;
    }

    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) {
            this.reset();
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Add PowerUp class after other classes
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 2;
        this.angle = 0;
    }

    update() {
        this.y += this.speed;
        this.angle += 0.05;
        return this.y < GAME_HEIGHT;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);

        // Draw power-up star shape with glowing effect
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#00ffff';
        
        // Draw star shape
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5;
            const x = Math.cos(angle) * this.width/2;
            const y = Math.sin(angle) * this.height/2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Game functions
function initGame() {
    // Cancel any existing game loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    if (isMultiplayer) {
        // Top player (Player 2)
        player2 = new Player(GAME_WIDTH / 2 - 25, 50, {
            left: 'a',
            right: 'd',
            shoot: 'w'
        }, true);

        // Bottom player (Player 1)
        player = new Player(GAME_WIDTH / 2 - 25, GAME_HEIGHT - 100, {
            left: 'ArrowLeft',
            right: 'ArrowRight',
            shoot: 'ArrowUp'
        }, false);
    } else {
        player = new Player(GAME_WIDTH / 2 - 25, GAME_HEIGHT - 100, {
            left: 'ArrowLeft',
            right: 'ArrowRight',
            shoot: 'ArrowUp'
        });
        player2 = null;
    }

    enemies = [];
    projectiles = [];
    particles = [];
    powerups = [];
    score = 0;
    player2Score = 0;
    gameOver = false;
    gameStarted = true;
    hasSpecialBullets = false;
    specialBulletTimer = 0;
    lastFrameTime = performance.now();
    initStars();
    
    // Hide menu
    const menuScreen = document.getElementById('menuScreen');
    if (menuScreen) {
        menuScreen.style.display = 'none';
    }

    // Show canvas
    canvas.style.display = 'block';
    
    // Play background music
    if (sounds.background) {
        try {
            sounds.background.currentTime = 0;
            sounds.background.loop = true;
            playSound('background');
        } catch (error) {
            console.error('Error playing background music:', error);
        }
    }

    // Start the game loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Update keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameStarted || gameOver) return;

    if (player) {
        if (e.key === player.controls.left) player.dx = -PLAYER_SPEED;
        if (e.key === player.controls.right) player.dx = PLAYER_SPEED;
        if (e.key === player.controls.shoot) player.shoot();
    }

    if (player2) {
        if (e.key === player2.controls.left) player2.dx = -PLAYER_SPEED;
        if (e.key === player2.controls.right) player2.dx = PLAYER_SPEED;
        if (e.key === player2.controls.shoot) player2.shoot();
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameStarted || gameOver) return;

    if (player) {
        if (e.key === player.controls.left && player.dx < 0) player.dx = 0;
        if (e.key === player.controls.right && player.dx > 0) player.dx = 0;
    }

    if (player2) {
        if (e.key === player2.controls.left && player2.dx < 0) player2.dx = 0;
        if (e.key === player2.controls.right && player2.dx > 0) player2.dx = 0;
    }
});

// Add back button listener
document.getElementById('backButton').addEventListener('click', () => {
    const difficultyButtons = document.getElementById('difficultyButtons');
    const singlePlayerBtn = document.getElementById('singlePlayer');
    const multiplayerBtn = document.getElementById('multiplayer');
    const gameTitle = document.getElementById('gameTitle');
    
    // Hide difficulty buttons
    difficultyButtons.style.display = 'none';
    
    // Show main menu buttons and title
    singlePlayerBtn.style.display = 'block';
    multiplayerBtn.style.display = 'block';
    gameTitle.style.display = 'block';
});

// Add single player button listener
document.getElementById('singlePlayer').addEventListener('click', () => {
    const difficultyButtons = document.getElementById('difficultyButtons');
    const singlePlayerBtn = document.getElementById('singlePlayer');
    const multiplayerBtn = document.getElementById('multiplayer');
    const gameTitle = document.getElementById('gameTitle');
    
    // Hide main menu buttons
    singlePlayerBtn.style.display = 'none';
    multiplayerBtn.style.display = 'none';
    
    // Show difficulty buttons
    difficultyButtons.style.display = 'flex';
});

// Update difficulty button listeners
document.getElementById('easy').addEventListener('click', () => {
    isMultiplayer = false;
    difficulty = 'EASY';
    score = 0;
    document.getElementById('difficultyButtons').style.display = 'none';
    initGame();
    startShooting();
});

document.getElementById('medium').addEventListener('click', () => {
    isMultiplayer = false;
    difficulty = 'MEDIUM';
    score = 0;
    document.getElementById('difficultyButtons').style.display = 'none';
    initGame();
    startShooting();
});

document.getElementById('hard').addEventListener('click', () => {
    isMultiplayer = false;
    difficulty = 'HARD';
    score = 0;
    document.getElementById('difficultyButtons').style.display = 'none';
    initGame();
    startShooting();
});

// Update multiplayer button listener
document.getElementById('multiplayer').addEventListener('click', () => {
    isMultiplayer = true;
    difficulty = 'MEDIUM';
    score = 0;
    player2Score = 0;
    document.getElementById('difficultyButtons').style.display = 'none';
    initGame();
    startShooting();
});

// Add touch controls after the keyboard controls
let touchStartX = 0;
let touchStartY = 0;
let activePlayer = null;
let touchIdentifiers = new Map(); // Store touch identifiers for each player

canvas.addEventListener('touchstart', (e) => {
    if (!gameStarted || gameOver) return;
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const gameY = touchY * (GAME_HEIGHT / canvas.clientHeight);

        // Determine which player to control based on touch position
        let playerForTouch = null;
        if (isMultiplayer) {
            if (gameY < GAME_HEIGHT / 2) {
                playerForTouch = player2; // Top half controls Player 2
            } else {
                playerForTouch = player; // Bottom half controls Player 1
            }
        } else {
            playerForTouch = player;
        }

        if (playerForTouch) {
            touchIdentifiers.set(touch.identifier, {
                player: playerForTouch,
                startX: touchX,
                lastX: touchX
            });
            isMoving = true;
            startShooting();
        }
    });
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!gameStarted || gameOver) return;
    e.preventDefault();

    Array.from(e.changedTouches).forEach(touch => {
        const touchData = touchIdentifiers.get(touch.identifier);
        if (touchData) {
            const rect = canvas.getBoundingClientRect();
            const currentX = touch.clientX - rect.left;
            const deltaX = currentX - touchData.lastX;
            
            // Update player position
            touchData.player.x += deltaX * (GAME_WIDTH / canvas.clientWidth);
            if (touchData.player.x < 0) touchData.player.x = 0;
            if (touchData.player.x > GAME_WIDTH - touchData.player.width) {
                touchData.player.x = GAME_WIDTH - touchData.player.width;
            }

            // Update last X position
            touchData.lastX = currentX;
        }
    });
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (!gameStarted || gameOver) return;
    e.preventDefault();

    Array.from(e.changedTouches).forEach(touch => {
        touchIdentifiers.delete(touch.identifier);
    });

    if (touchIdentifiers.size === 0) {
        isMoving = false;
        stopShooting();
    }
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
    if (!gameStarted || gameOver) return;
    e.preventDefault();

    Array.from(e.changedTouches).forEach(touch => {
        touchIdentifiers.delete(touch.identifier);
    });

    if (touchIdentifiers.size === 0) {
        isMoving = false;
        stopShooting();
    }
}, { passive: false });

// Update startShooting function to handle multiple players
function startShooting() {
    isShooting = true;
    if (shootInterval) clearInterval(shootInterval);
    shootInterval = setInterval(() => {
        if (!gameOver && gameStarted) {
            touchIdentifiers.forEach(touchData => {
                touchData.player.shoot();
            });
        }
    }, SHOOT_DELAY);
}

function stopShooting() {
    isShooting = false;
    if (shootInterval) {
        clearInterval(shootInterval);
        shootInterval = null;
    }
}

// Function to create explosion effect
function createExplosion(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle(x, y, color));
    }
    screenShake = {
        amount: SCREEN_SHAKE_AMOUNT,
        duration: SCREEN_SHAKE_DURATION
    };
}

// Initialize stars
function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push(new Star());
    }
}

function checkCollisions() {
    if (isMultiplayer) {
        // Check projectile collisions with players in multiplayer
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            
            // Check if bottom player's projectile hits top player
            if (!projectile.isTopPlayer && player2.isAlive && 
                isColliding(projectile.getBounds(), player2.getBounds())) {
                player2.takeDamage(projectile.isSpecial ? 20 : 10);
                projectiles.splice(i, 1);
                continue;
            }
            
            // Check if top player's projectile hits bottom player
            if (projectile.isTopPlayer && player.isAlive && 
                isColliding(projectile.getBounds(), player.getBounds())) {
                player.takeDamage(projectile.isSpecial ? 20 : 10);
                projectiles.splice(i, 1);
                continue;
            }
        }

        // Check if either player has fallen off screen
        if (!player.isAlive && player.y > GAME_HEIGHT) {
            gameOver = true;
        }
        if (!player2.isAlive && player2.y > GAME_HEIGHT) {
            gameOver = true;
        }
    } else {
        // Check projectile collisions with enemies
        for (let i = projectiles.length - 1; i >= 0; i--) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (isColliding(projectiles[i].getBounds(), enemies[j].getBounds())) {
                    createExplosion(
                        enemies[j].x + enemies[j].width/2,
                        enemies[j].y + enemies[j].height/2,
                        projectiles[i].isSpecial ? '#ff00ff' : DIFFICULTY_SETTINGS[difficulty].color
                    );
                    
                    score += 10 * DIFFICULTY_SETTINGS[difficulty].scoreMultiplier;
                    
                    enemies.splice(j, 1);
                    projectiles.splice(i, 1);
                    playSound('explosion');
                    break;
                }
            }
        }

        // Check enemy collisions with player
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (player && isColliding(player.getBounds(), enemies[i].getBounds())) {
                handlePlayerCollision(player, enemies[i]);
            }
        }
    }
}

function handlePlayerCollision(player, enemy) {
    createExplosion(
        player.x + player.width/2,
        player.y + player.height/2,
        '#ffffff'
    );
    gameOver = true;
    playSound('gameOver');
}

function activatePowerup(player, powerup) {
    hasSpecialBullets = true;
    specialBulletTimer = POWERUP_DURATION;
    createExplosion(
        powerup.x + powerup.width/2,
        powerup.y + powerup.height/2,
        '#00ffff'
    );
    powerups.splice(powerups.indexOf(powerup), 1);
    playSound('shoot');
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    if (!gameStarted || gameOver) return;

    try {
        if (hasSpecialBullets) {
            specialBulletTimer -= deltaTime;
            if (specialBulletTimer <= 0) {
                hasSpecialBullets = false;
                specialBulletTimer = 0;
            }
        }

        if (screenShake.duration > 0) {
            screenShake.duration -= deltaTime;
        }

        if (player) player.update();
        if (player2) player2.update();
        
        projectiles = projectiles.filter(projectile => {
            if (projectile && typeof projectile.update === 'function') {
                projectile.update();
                return projectile.y + projectile.height > 0 && projectile.y < GAME_HEIGHT;
            }
            return false;
        });

        // Only handle enemies in single player mode
        if (!isMultiplayer) {
            enemies = enemies.filter(enemy => {
                if (enemy && typeof enemy.update === 'function') {
                    enemy.update();
                    return enemy.y < GAME_HEIGHT;
                }
                return false;
            });

            if (Math.random() < DIFFICULTY_SETTINGS[difficulty].enemySpawnChance) {
                const x = Math.random() * (GAME_WIDTH - 40);
                enemies.push(new Enemy(x, -40, DIFFICULTY_SETTINGS[difficulty].enemySpeed));
            }
        }

        particles = particles.filter(particle => {
            if (particle && typeof particle.update === 'function') {
                return particle.update();
            }
            return false;
        });

        stars.forEach(star => {
            if (star && typeof star.update === 'function') {
                star.update();
            }
        });

        // Spawn powerups
        if (Math.random() < POWERUP_SPAWN_CHANCE) {
            const x = Math.random() * (GAME_WIDTH - 30);
            powerups.push(new PowerUp(x, -30));
        }

        checkCollisions();
    } catch (error) {
        console.error('Error in update loop:', error);
    }
}

function draw() {
    try {
        ctx.fillStyle = '#000033';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw stars
        stars.forEach(star => {
            if (star && typeof star.draw === 'function') {
                star.draw();
            }
        });

        if (!gameStarted) return;

        // Draw particles
        particles.forEach(particle => {
            if (particle && typeof particle.draw === 'function') {
                particle.draw();
            }
        });

        // Draw game objects
        projectiles.forEach(projectile => {
            if (projectile && typeof projectile.draw === 'function') {
                projectile.draw();
            }
        });

        // Only draw enemies in single player mode
        if (!isMultiplayer) {
            enemies.forEach(enemy => {
                if (enemy && typeof enemy.draw === 'function') {
                    enemy.draw();
                }
            });
        }

        if (player && typeof player.draw === 'function') {
            player.draw();
        }

        if (player2 && typeof player2.draw === 'function') {
            player2.draw();
        }

        // Draw score in single player mode
        if (!isMultiplayer) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Score: ${score}`, 10, 30);
        }

        if (hasSpecialBullets) {
            const timeLeft = Math.ceil(specialBulletTimer / 1000);
            ctx.fillStyle = '#ff00ff';
            ctx.fillText(`Special Bullets: ${timeLeft}s`, 10, 60);
        }

        if (gameOver) {
            // Create a more appealing gradient background with lighter colors
            const gradient = ctx.createRadialGradient(
                GAME_WIDTH/2, GAME_HEIGHT/2, 0,
                GAME_WIDTH/2, GAME_HEIGHT/2, GAME_HEIGHT
            );
            gradient.addColorStop(0, 'rgba(0, 153, 255, 0.1)');  // Light blue center
            gradient.addColorStop(0.5, 'rgba(0, 51, 102, 0.2)'); // Medium blue middle
            gradient.addColorStop(1, 'rgba(0, 0, 51, 0.3)');     // Dark blue edge
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            
            // Add outer glow effect
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40);
            
            // Enhanced text effects
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            
            if (isMultiplayer) {
                // Game Over text with gradient
                const gameOverGradient = ctx.createLinearGradient(
                    GAME_WIDTH/2 - 100, GAME_HEIGHT/2 - 80,
                    GAME_WIDTH/2 + 100, GAME_HEIGHT/2 - 80
                );
                gameOverGradient.addColorStop(0, '#4df');
                gameOverGradient.addColorStop(0.5, '#fff');
                gameOverGradient.addColorStop(1, '#4df');
                ctx.fillStyle = gameOverGradient;
                ctx.fillText('Game Over!', GAME_WIDTH/2, GAME_HEIGHT/2 - 80);
                
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#ffffff';
                let winner = "It's a Tie!";
                if (!player.isAlive && player2.isAlive) winner = "Player 2 Wins!";
                if (player.isAlive && !player2.isAlive) winner = "Player 1 Wins!";
                ctx.fillText(winner, GAME_WIDTH/2, GAME_HEIGHT/2);
            } else {
                // Game Over text with gradient
                const gameOverGradient = ctx.createLinearGradient(
                    GAME_WIDTH/2 - 100, GAME_HEIGHT/2 - 50,
                    GAME_WIDTH/2 + 100, GAME_HEIGHT/2 - 50
                );
                gameOverGradient.addColorStop(0, '#4df');
                gameOverGradient.addColorStop(0.5, '#fff');
                gameOverGradient.addColorStop(1, '#4df');
                ctx.fillStyle = gameOverGradient;
                ctx.fillText('Game Over!', GAME_WIDTH/2, GAME_HEIGHT/2 - 50);
                
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`Final Score: ${score}`, GAME_WIDTH/2, GAME_HEIGHT/2 + 10);
            }
            
            // Enhanced pulsing effect for "Click to Play Again"
            const pulseAmount = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
            ctx.globalAlpha = pulseAmount;
            ctx.fillStyle = '#4df';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 15;
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Click to Play Again', GAME_WIDTH/2, GAME_HEIGHT/2 + 100);
            
            // Reset canvas properties
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }
    } catch (error) {
        console.error('Error in draw loop:', error);
    }
}

function gameLoop(currentTime) {
    try {
        update(currentTime);
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error('Error in game loop:', error);
        // Restart the game loop if it crashes
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

// Update click handler for game over screen
canvas.addEventListener('click', () => {
    if (gameOver) {
        const menuScreen = document.getElementById('menuScreen');
        const singlePlayerBtn = document.getElementById('singlePlayer');
        const multiplayerBtn = document.getElementById('multiplayer');
        const difficultyButtons = document.getElementById('difficultyButtons');
        const gameTitle = document.getElementById('gameTitle');
        
        if (menuScreen) {
            menuScreen.style.display = 'flex';
            // Show main menu buttons and title
            singlePlayerBtn.style.display = 'block';
            multiplayerBtn.style.display = 'block';
            gameTitle.style.display = 'block';
            // Hide difficulty buttons
            difficultyButtons.style.display = 'none';
        }
        gameOver = false;
        gameStarted = false;
    }
});

// Start game loop
gameLoop(); 

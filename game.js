// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 8;

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let difficulty = null;

// Game objects
let player;
let enemies = [];
let projectiles = [];
let stars = [];

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    EASY: {
        enemySpawnChance: 0.01,
        enemySpeed: 2,
        scoreMultiplier: 1,
        color: '#00ff00'
    },
    MEDIUM: {
        enemySpawnChance: 0.02,
        enemySpeed: 3,
        scoreMultiplier: 2,
        color: '#ffa500'
    },
    HARD: {
        enemySpawnChance: 0.03,
        enemySpeed: 4,
        scoreMultiplier: 3,
        color: '#ff0000'
    }
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Load images
const playerImage = new Image();
const enemyImage = new Image();
const projectileImage = new Image();
playerImage.src = 'space.jpg';
enemyImage.src = 'enemy.jpg';
projectileImage.src = 'bullet.jpg';

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
        sounds[sound].currentTime = 0;
        sounds[sound].play().catch(e => console.log("Audio play failed:", e));
    }
}

// Touch controls
let touchX = null;
let isShooting = false;
let lastShootTime = 0;
const SHOOT_DELAY = 250; // Minimum time between shots in milliseconds

// Particle system for explosions
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.life = 1.0; // Full life
        this.fadeSpeed = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.life -= this.fadeSpeed;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(${this.color}, ${this.life})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

let particles = [];

// Game objects classes
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 60;
        this.dx = 0;
    }

    update() {
        this.x += this.dx;
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;
    }

    draw() {
        if (playerImage.complete) {
            ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x, this.y, this.width, this.height);
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
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        if (enemyImage.complete) {
            ctx.drawImage(enemyImage, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = difficulty ? DIFFICULTY_SETTINGS[difficulty].color : '#ff0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
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

    explode() {
        const colorString = difficulty ? DIFFICULTY_SETTINGS[difficulty].color : '#ff0000';
        const rgb = this.hexToRgb(colorString);
        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(
                this.x + this.width/2,
                this.y + this.height/2,
                `${rgb.r}, ${rgb.g}, ${rgb.b}`
            ));
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r: 255, g: 0, b: 0};
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 20;
        this.speed = 15;
    }

    update() {
        this.y -= this.speed;
    }

    draw() {
        if (projectileImage.complete) {
            ctx.drawImage(projectileImage, this.x - this.width/2, this.y, this.width, this.height);
            
            // Add glowing trail effect
            ctx.save();
            ctx.globalAlpha = 0.5;
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.2 - (i * 0.05);
                ctx.drawImage(projectileImage, 
                    this.x - this.width/2,
                    this.y + (i * 10),
                    this.width,
                    this.height
                );
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        }
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

class Star {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.speed = Math.random() * 2 + 1;
        this.brightness = Math.random();
    }

    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) {
            this.reset();
            this.y = 0;
        }
        this.brightness = Math.max(0.2, Math.abs(Math.sin(Date.now() * 0.003 + this.x * 0.1)));
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.fillRect(this.x, this.y, this.speed, this.speed);
    }
}

// Initialize stars
for (let i = 0; i < 100; i++) {
    stars.push(new Star());
}

// Game functions
function initGame() {
    player = new Player(GAME_WIDTH / 2 - 30, GAME_HEIGHT - 100);
    enemies = [];
    projectiles = [];
    score = 0;
    gameOver = false;
    gameStarted = true;
    document.getElementById('menuScreen').style.display = 'none';
    playSound('background');
}

function checkCollisions() {
    projectiles.forEach((projectile, pIndex) => {
        enemies.forEach((enemy, eIndex) => {
            if (isColliding(projectile.getBounds(), enemy.getBounds())) {
                enemy.explode();
                playSound('explosion');
                projectiles.splice(pIndex, 1);
                enemies.splice(eIndex, 1);
                score += 10 * DIFFICULTY_SETTINGS[difficulty].scoreMultiplier;
            }
        });
    });

    enemies.forEach(enemy => {
        if (isColliding(player.getBounds(), enemy.getBounds())) {
            enemy.explode();
            playSound('gameOver');
            gameOver = true;
        }
    });
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update() {
    if (!gameStarted || gameOver) return;

    // Update game objects
    updatePlayerPosition();
    stars.forEach(star => star.update());
    projectiles = projectiles.filter(p => p.y > 0);
    projectiles.forEach(p => p.update());
    enemies = enemies.filter(e => e.y < GAME_HEIGHT);
    enemies.forEach(e => e.update());

    // Spawn enemies
    if (Math.random() < DIFFICULTY_SETTINGS[difficulty].enemySpawnChance) {
        enemies.push(new Enemy(
            Math.random() * (GAME_WIDTH - 40),
            0,
            DIFFICULTY_SETTINGS[difficulty].enemySpeed
        ));
    }

    checkCollisions();

    // Check for game over
    if (enemies.some(e => e.y > GAME_HEIGHT)) {
        gameOver = true;
    }

    // Update particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.update());

    // Auto-shoot if touch is active
    if (isShooting && Date.now() - lastShootTime > SHOOT_DELAY) {
        projectiles.push(new Projectile(player.x + player.width/2, player.y));
        playSound('shoot');
        lastShootTime = Date.now();
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw stars
    stars.forEach(star => star.draw());

    if (gameStarted) {
        // Draw game objects
        player.draw();
        enemies.forEach(e => e.draw());
        projectiles.forEach(p => p.draw());

        // Draw score
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${score}`, 10, 30);
        ctx.fillText(`Difficulty: ${difficulty}`, 10, 60);

        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            
            ctx.fillStyle = '#fff';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Game Over!', GAME_WIDTH/2, GAME_HEIGHT/2);
            ctx.font = '24px Arial';
            ctx.fillText(`Final Score: ${score}`, GAME_WIDTH/2, GAME_HEIGHT/2 + 50);
            ctx.fillText('Click to play again', GAME_WIDTH/2, GAME_HEIGHT/2 + 100);
            ctx.textAlign = 'left';
        }
    }

    // Draw particles
    particles.forEach(p => p.draw(ctx));
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Event listeners
document.getElementById('easy').addEventListener('click', () => {
    difficulty = 'EASY';
    initGame();
});

document.getElementById('medium').addEventListener('click', () => {
    difficulty = 'MEDIUM';
    initGame();
});

document.getElementById('hard').addEventListener('click', () => {
    difficulty = 'HARD';
    initGame();
});

canvas.addEventListener('mousemove', (e) => {
    if (!gameStarted || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    player.dx = (x - player.x - player.width/2) * 0.1;
});

canvas.addEventListener('click', (e) => {
    if (gameOver) {
        document.getElementById('menuScreen').style.display = 'flex';
        gameStarted = false;
        return;
    }
    if (!gameStarted) return;
    
    projectiles.push(new Projectile(
        player.x + player.width/2,
        player.y
    ));
});

// Update touch event listeners for better mobile control
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    player.x = touchX - player.width/2;
    isShooting = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    player.x = touchX - player.width/2;
});

canvas.addEventListener('touchend', () => {
    touchX = null;
    isShooting = false;
});

// Update player movement to be more responsive on mobile
function updatePlayerPosition() {
    if (touchX !== null) {
        player.x = touchX - player.width/2;
        // Keep player within canvas bounds
        if (player.x < 0) player.x = 0;
        if (player.x > GAME_WIDTH - player.width) player.x = GAME_WIDTH - player.width;
    }
}

// Sound toggle button
document.getElementById('soundToggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
    if (!soundEnabled) {
        Object.values(sounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    } else if (gameStarted && !gameOver) {
        playSound('background');
    }
});

// Start game loop
gameLoop(); 

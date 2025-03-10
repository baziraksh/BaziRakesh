// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 8;
const SHOOT_DELAY = 200; // Slightly faster shooting

// Visual effects constants
const PARTICLE_COUNT = 15;
const STAR_COUNT = 100;
const SCREEN_SHAKE_AMOUNT = 5;
const SCREEN_SHAKE_DURATION = 200;

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let difficulty = null;
let lastShootTime = 0;
let isMoving = false;
let screenShake = { amount: 0, duration: 0 };

// Load images
const playerImage = new Image();
const enemyImage = new Image();
playerImage.src = 'space.jpg';
enemyImage.src = 'enemy.jpg';

// Game objects
let player;
let enemies = [];
let projectiles = [];
let stars = [];
let particles = [];

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
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.dx = 0;
    }

    update() {
        this.x += this.dx;
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;
    }

    draw() {
        ctx.save();
        
        // Apply screen shake
        if (screenShake.duration > 0) {
            ctx.translate(
                Math.random() * screenShake.amount - screenShake.amount/2,
                Math.random() * screenShake.amount - screenShake.amount/2
            );
        }
        
        if (playerImage.complete) {
            ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
            
            // Enhanced thruster effect when moving
            if (isMoving) {
                const gradient = ctx.createLinearGradient(
                    this.x + this.width * 0.3,
                    this.y + this.height,
                    this.x + this.width * 0.5,
                    this.y + this.height + 30
                );
                gradient.addColorStop(0, '#ff6600');
                gradient.addColorStop(1, 'rgba(255, 102, 0, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(this.x + this.width * 0.3, this.y + this.height);
                ctx.lineTo(this.x + this.width * 0.5, this.y + this.height + 30);
                ctx.lineTo(this.x + this.width * 0.7, this.y + this.height);
                ctx.closePath();
                ctx.fill();
                
                // Add thruster particles
                if (Math.random() < 0.3) {
                    particles.push(new Particle(
                        this.x + this.width * 0.5,
                        this.y + this.height,
                        '#ff6600',
                        2,
                        1
                    ));
                }
            }
        } else {
            // Fallback shape
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height);
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
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 16;
        this.speed = 15;
    }

    update() {
        this.y -= this.speed;
    }

    draw() {
        // Draw bullet with enhanced glow effect
        ctx.save();
        
        // Main bullet
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        
        // Inner glow
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        
        // Outer glow
        ctx.shadowColor = '#0066ff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(0, 102, 255, 0.5)';
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        
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

// Game functions
function initGame() {
    player = new Player(GAME_WIDTH / 2 - 25, GAME_HEIGHT - 100);
    enemies = [];
    projectiles = [];
    particles = [];
    score = 0;
    gameOver = false;
    gameStarted = true;
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
        sounds.background.currentTime = 0;
        sounds.background.loop = true;
        playSound('background');
    }
}

// Controls
canvas.addEventListener('mousemove', (e) => {
    if (!gameStarted || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const oldX = player.x;
    player.x = x - player.width/2;
    
    // Auto-fire while moving
    isMoving = Math.abs(oldX - player.x) > 1;
    if (isMoving && Date.now() - lastShootTime > SHOOT_DELAY) {
        projectiles.push(new Projectile(player.x + player.width/2, player.y));
        playSound('shoot');
        lastShootTime = Date.now();
    }
});

canvas.addEventListener('mouseout', () => {
    isMoving = false;
});

canvas.addEventListener('click', (e) => {
    if (gameOver) {
        // Reset game state
        gameOver = false;
        gameStarted = false;
        score = 0;
        
        // Show menu
        const menuScreen = document.getElementById('menuScreen');
        if (menuScreen) {
            menuScreen.style.display = 'flex';
        }
        
        // Stop background music
        if (sounds.background) {
            sounds.background.pause();
            sounds.background.currentTime = 0;
        }
        return;
    }
    
    if (!gameStarted) return;
    
    // Manual shooting
    projectiles.push(new Projectile(player.x + player.width/2, player.y));
    playSound('shoot');
    lastShootTime = Date.now();
});

// Touch controls
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (gameOver) {
        // Reset game state
        gameOver = false;
        gameStarted = false;
        score = 0;
        
        // Show menu
        const menuScreen = document.getElementById('menuScreen');
        if (menuScreen) {
            menuScreen.style.display = 'flex';
        }
        return;
    }
    
    if (!gameStarted || gameOver) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    player.x = x - player.width/2;
    isMoving = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const oldX = player.x;
    player.x = x - player.width/2;
    
    // Auto-fire while moving
    isMoving = Math.abs(oldX - player.x) > 1;
    if (isMoving && Date.now() - lastShootTime > SHOOT_DELAY) {
        projectiles.push(new Projectile(player.x + player.width/2, player.y));
        playSound('shoot');
        lastShootTime = Date.now();
    }
});

canvas.addEventListener('touchend', () => {
    isMoving = false;
});

// Difficulty button listeners
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
    for (let i = projectiles.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(projectiles[i].getBounds(), enemies[j].getBounds())) {
                // Create explosion at enemy position
                createExplosion(
                    enemies[j].x + enemies[j].width/2,
                    enemies[j].y + enemies[j].height/2,
                    DIFFICULTY_SETTINGS[difficulty].color
                );
                
                // Remove enemy and projectile
                enemies.splice(j, 1);
                projectiles.splice(i, 1);
                score += 10 * DIFFICULTY_SETTINGS[difficulty].scoreMultiplier;
                playSound('explosion');
                break;
            }
        }
    }

    // Check for collisions between player and enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (isColliding(player.getBounds(), enemies[i].getBounds())) {
            createExplosion(
                player.x + player.width/2,
                player.y + player.height/2,
                '#ffffff'
            );
            gameOver = true;
            playSound('gameOver');
            break;
        }
    }
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update() {
    if (!gameStarted || gameOver) return;

    // Update screen shake
    if (screenShake.duration > 0) {
        screenShake.duration -= 16; // Assuming 60fps
    }

    // Update game objects
    player.update();
    
    // Update projectiles
    projectiles = projectiles.filter(projectile => {
        projectile.update();
        return projectile.y + projectile.height > 0;
    });

    // Update enemies
    enemies = enemies.filter(enemy => {
        enemy.update();
        return enemy.y < GAME_HEIGHT;
    });

    // Update particles
    particles = particles.filter(particle => particle.update());

    // Update stars
    stars.forEach(star => star.update());

    // Spawn enemies
    if (Math.random() < DIFFICULTY_SETTINGS[difficulty].enemySpawnChance) {
        const x = Math.random() * (GAME_WIDTH - 40);
        enemies.push(new Enemy(x, -40, DIFFICULTY_SETTINGS[difficulty].enemySpeed));
    }

    checkCollisions();
}

function draw() {
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw stars
    stars.forEach(star => star.draw());

    if (!gameStarted) return;

    // Draw particles behind everything else
    particles.forEach(particle => particle.draw());

    // Draw game objects
    projectiles.forEach(projectile => projectile.draw());
    enemies.forEach(enemy => enemy.draw());
    player.draw();

    // Draw score
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', GAME_WIDTH/2, GAME_HEIGHT/2 - 50);
        
        ctx.font = '24px Arial';
        ctx.fillText(`Final Score: ${score}`, GAME_WIDTH/2, GAME_HEIGHT/2 + 10);
        ctx.fillText('Click to Play Again', GAME_WIDTH/2, GAME_HEIGHT/2 + 50);
        
        ctx.textAlign = 'left';
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop(); 

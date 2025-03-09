// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 8;
const SHOOT_DELAY = 200; // Slightly faster shooting

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let difficulty = null;
let lastShootTime = 0;
let isMoving = false;

// Game objects
let player;
let enemies = [];
let projectiles = [];
let stars = [];

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
        this.width = 50;  // Slightly smaller ship
        this.height = 50;
        this.dx = 0;
    }

    update() {
        this.x += this.dx;
        // Keep player within bounds
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;
    }

    draw() {
        // Draw player ship as a triangle with thrusters
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y);  // Top point
        ctx.lineTo(this.x + this.width, this.y + this.height);  // Bottom right
        ctx.lineTo(this.x, this.y + this.height);  // Bottom left
        ctx.closePath();
        ctx.fill();

        // Add white outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add thruster effect when moving
        if (isMoving) {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width * 0.3, this.y + this.height);
            ctx.lineTo(this.x + this.width * 0.5, this.y + this.height + 15);
            ctx.lineTo(this.x + this.width * 0.7, this.y + this.height);
            ctx.closePath();
            ctx.fill();
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
        this.angle = 0;  // For rotation
    }

    update() {
        this.y += this.speed;
        this.angle += 0.1;  // Rotate enemy
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);
        
        // Draw enemy as a colored diamond
        ctx.fillStyle = difficulty ? DIFFICULTY_SETTINGS[difficulty].color : '#ff0000';
        ctx.beginPath();
        ctx.moveTo(0, -this.height/2);  // Top
        ctx.lineTo(this.width/2, 0);    // Right
        ctx.lineTo(0, this.height/2);   // Bottom
        ctx.lineTo(-this.width/2, 0);   // Left
        ctx.closePath();
        ctx.fill();

        // Add glow effect
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
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

// Game functions
function initGame() {
    player = new Player(GAME_WIDTH / 2 - 25, GAME_HEIGHT - 100);
    enemies = [];
    projectiles = [];
    score = 0;
    gameOver = false;
    gameStarted = true;
    
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

function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(projectiles[i].getBounds(), enemies[j].getBounds())) {
                projectiles.splice(i, 1);
                enemies.splice(j, 1);
                score += 10 * DIFFICULTY_SETTINGS[difficulty].scoreMultiplier;
                playSound('explosion');
                break;
            }
        }
    }

    if (enemies.some(enemy => isColliding(player.getBounds(), enemy.getBounds()))) {
        playSound('gameOver');
        gameOver = true;
        if (sounds.background) {
            sounds.background.pause();
            sounds.background.currentTime = 0;
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

    player.update();
    
    // Auto-fire while moving
    if (isMoving && Date.now() - lastShootTime > SHOOT_DELAY) {
        projectiles.push(new Projectile(player.x + player.width/2, player.y));
        playSound('shoot');
        lastShootTime = Date.now();
    }

    // Update projectiles and remove ones that are off screen
    projectiles = projectiles.filter(p => p.y > -p.height);
    projectiles.forEach(p => p.update());

    // Update enemies and remove ones that are off screen
    enemies = enemies.filter(e => e.y < GAME_HEIGHT);
    enemies.forEach(e => e.update());

    // Spawn new enemies
    if (Math.random() < DIFFICULTY_SETTINGS[difficulty].enemySpawnChance) {
        enemies.push(new Enemy(
            Math.random() * (GAME_WIDTH - 40),
            -40,  // Start above the screen
            DIFFICULTY_SETTINGS[difficulty].enemySpeed
        ));
    }

    checkCollisions();

    // Game over if enemy reaches bottom
    if (enemies.some(e => e.y > GAME_HEIGHT)) {
        playSound('gameOver');
        gameOver = true;
        if (sounds.background) {
            sounds.background.pause();
            sounds.background.currentTime = 0;
        }
    }
}

function draw() {
    // Clear screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

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

        // Draw game over screen
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
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop(); 

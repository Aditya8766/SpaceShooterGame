import { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // start, playing, gameOver
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const gameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new ArchadeGame(canvas, {
      onScoreChange: setScore,
      onLevelChange: setLevel,
      onLivesChange: setLives,
      onGameOver: () => setGameState('gameOver'),
      onGameStart: () => setGameState('playing'),
    });

    gameRef.current = game;
    return () => game.destroy();
  }, []);

  const startGame = () => {
    gameRef.current?.start();
    setScore(0);
    setLevel(1);
    setLives(3);
  };

  const restartGame = () => {
    gameRef.current?.reset();
    startGame();
  };

  return (
    <div className="game-container">
      <canvas ref={canvasRef}></canvas>

      {gameState === 'start' && (
        <div className="start-screen">
          <div className="start-content">
            <h1>LASER STRIKE</h1>
            <p>Destroy enemies and survive as long as you can!</p>
            <div className="controls-info">
              <p>📱 Use arrow keys or WASD to move</p>
              <p>🎮 Click/Tap to shoot</p>
              <p>⚡ More enemies = More points!</p>
            </div>
            <button onClick={startGame}>START GAME</button>
          </div>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="game-over-screen">
          <div className="game-over-content">
            <h1>GAME OVER</h1>
            <p>Final Score: {score}</p>
            <p>Level Reached: {level}</p>
            <button onClick={restartGame}>PLAY AGAIN</button>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="hud">
          <div className="score-display">Score: {score}</div>
          <div className="level-display">Level: {level}</div>
          <div className="lives-display">Lives: {lives}</div>
        </div>
      )}
    </div>
  );
}

// Game Engine
class ArchadeGame {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.resizeCanvas();

    this.player = null;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.stars = [];

    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.gameRunning = false;
    this.enemySpawnRate = 2;
    this.lastEnemySpawn = 0;

    this.keys = {};
    this.mousePos = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStartPos = { x: 0, y: 0 };

    this.setupEventListeners();
    this.initStars();
    this.gameLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('keydown', (e) => (this.keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
    
    // Mouse events
    window.addEventListener('mousemove', (e) => {
      this.mousePos = { x: e.clientX, y: e.clientY };
      if (this.isDragging && this.gameRunning && this.player) {
        this.player.x = e.clientX;
        this.player.y = e.clientY;
      }
    });
    
    window.addEventListener('mousedown', (e) => {
      if (this.gameRunning && this.player) {
        const dx = e.clientX - this.player.x;
        const dy = e.clientY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.player.radius + 20) {
          this.isDragging = true;
          this.dragStartPos = { x: e.clientX, y: e.clientY };
        }
      }
    });
    
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    window.addEventListener('click', () => {
      if (this.gameRunning && this.player && !this.isDragging) {
        this.bullets.push(new Bullet(this.player.x, this.player.y, this.player.angle));
      }
    });
    
    // Touch events
    window.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.mousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (this.gameRunning && this.player) {
        const dx = e.touches[0].clientX - this.player.x;
        const dy = e.touches[0].clientY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.player.radius + 20) {
          this.isDragging = true;
          this.dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
          // Tap to shoot if not on player
          this.bullets.push(new Bullet(this.player.x, this.player.y, this.player.angle));
        }
      }
    });
    
    window.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        this.mousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (this.isDragging && this.gameRunning && this.player) {
          this.player.x = e.touches[0].clientX;
          this.player.y = e.touches[0].clientY;
          // Auto-aim towards touch position
          this.player.aimAt(this.mousePos.x, this.mousePos.y);
        }
      }
    });
    
    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  initStars() {
    this.stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      radius: Math.random() * 1.5,
      opacity: Math.random() * 0.5 + 0.5,
    }));
  }

  start() {
    if (this.gameRunning) return;
    this.gameRunning = true;
    this.callbacks.onGameStart?.();

    this.player = new Player(this.canvas.width / 2, this.canvas.height - 80);
  }

  reset() {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.enemySpawnRate = 2;
    this.lastEnemySpawn = 0;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.gameRunning = false;
  }

  update() {
    if (!this.gameRunning) return;

    // Update player
    this.player.update(this.keys, this.canvas.width, this.canvas.height);
    this.player.aimAt(this.mousePos.x, this.mousePos.y);

    // Spawn enemies
    if (Date.now() - this.lastEnemySpawn > this.enemySpawnRate * 1000) {
      this.spawnEnemy();
      this.lastEnemySpawn = Date.now();
    }

    // Update bullets
    this.bullets = this.bullets.filter((bullet) => {
      bullet.update();
      return bullet.x > 0 && bullet.x < this.canvas.width && bullet.y > 0 && bullet.y < this.canvas.height;
    });

    // Update enemies
    this.enemies = this.enemies.filter((enemy) => {
      enemy.update(this.canvas.width, this.canvas.height);
      return enemy.health > 0;
    });

    // Check collisions
    this.checkCollisions();

    // Update particles
    this.particles = this.particles.filter((p) => {
      p.update();
      return p.life > 0;
    });

    // Update difficulty
    this.updateDifficulty();

    // Check game over
    if (this.lives <= 0) {
      this.gameRunning = false;
      this.callbacks.onGameOver?.();
    }
  }

  spawnEnemy() {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const x = side === 'left' ? -40 : this.canvas.width + 40;
    const y = Math.random() * (this.canvas.height * 0.7);

    this.enemies.push(
      new Enemy(x, y, this.level, this.canvas.width, this.canvas.height)
    );
  }

  checkCollisions() {
    // Bullet vs Enemy
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (this.bullets[i].collidesWith(this.enemies[j])) {
          this.enemies[j].takeDamage();
          this.bullets.splice(i, 1);

          if (this.enemies[j].health <= 0) {
            this.score += this.enemies[j].points;
            this.createExplosion(this.enemies[j].x, this.enemies[j].y);
          }
          break;
        }
      }
    }

    // Enemy vs Player
    for (const enemy of this.enemies) {
      if (this.player.collidesWith(enemy)) {
        this.lives--;
        this.createExplosion(this.player.x, this.player.y, 'red');
        this.enemies.splice(this.enemies.indexOf(enemy), 1);
      }
    }

    // Update HUD
    this.callbacks.onScoreChange?.(this.score);
    this.callbacks.onLivesChange?.(this.lives);
    this.callbacks.onLevelChange?.(this.level);
  }

  updateDifficulty() {
    const newLevel = Math.floor(this.score / 500) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.enemySpawnRate = Math.max(0.5, 2 - (this.level - 1) * 0.2);
    }
  }

  createExplosion(x, y, color = '#00ff88') {
    const particleCount = Math.random() * 10 + 15;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw stars
    this.ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      this.ctx.globalAlpha = star.opacity;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    // Draw game objects
    if (this.gameRunning) {
      this.player.draw(this.ctx);

      for (const bullet of this.bullets) {
        bullet.draw(this.ctx);
      }

      for (const enemy of this.enemies) {
        enemy.draw(this.ctx);
      }

      for (const particle of this.particles) {
        particle.draw(this.ctx);
      }
    }
  }

  gameLoop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.gameLoop);
  };

  destroy() {
    // Cleanup
  }
}

// Player Class
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.vx = 0;
    this.vy = 0;
    this.speed = 5;
    this.angle = 0;
    this.shootCooldown = 0;
  }

  update(keys, canvasWidth, canvasHeight) {
    // Movement
    this.vx = 0;
    this.vy = 0;

    if (keys['arrowup'] || keys['w']) this.vy -= this.speed;
    if (keys['arrowdown'] || keys['s']) this.vy += this.speed;
    if (keys['arrowleft'] || keys['a']) this.vx -= this.speed;
    if (keys['arrowright'] || keys['d']) this.vx += this.speed;

    this.x += this.vx;
    this.y += this.vy;

    // Boundaries
    this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));

    if (this.shootCooldown > 0) this.shootCooldown--;
  }

  aimAt(x, y) {
    this.angle = Math.atan2(y - this.y, x - this.x);
  }

  shoot() {
    // No longer needed - bullets created directly on click/tap
  }

  draw(ctx) {
    // Draw player ship
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Draw triangle ship
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-15, -10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 10);
    ctx.closePath();
    ctx.fill();

    // Draw glow
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Draw shield circle
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  collidesWith(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + enemy.radius;
  }
}

// Enemy Class
class Enemy {
  constructor(x, y, level, canvasWidth, canvasHeight) {
    this.x = x;
    this.y = y;
    this.radius = 15 + level;
    this.health = 1 + Math.floor(level / 2);
    this.maxHealth = this.health;
    this.speed = 1.5 + level * 0.3;
    this.points = 10 * level;
    this.angle = Math.atan2(canvasHeight / 2 - y, canvasWidth / 2 - x);
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update(canvasWidth, canvasHeight) {
    // Move towards center
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  takeDamage() {
    this.health--;
  }

  draw(ctx) {
    // Draw enemy
    ctx.fillStyle = `hsl(${this.health / this.maxHealth * 120}, 100%, 50%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw glow
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Health bar
    if (this.maxHealth > 1) {
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(this.x - this.radius, this.y + this.radius + 5, this.radius * 2, 3);

      ctx.fillStyle = '#00ff88';
      ctx.fillRect(
        this.x - this.radius,
        this.y + this.radius + 5,
        (this.health / this.maxHealth) * this.radius * 2,
        3
      );
    }
  }
}

// Bullet Class
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 8;
    this.vy = Math.sin(angle) * 8;
    this.radius = 3;
    this.life = 100;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx) {
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  collidesWith(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + enemy.radius;
  }
}

// Particle Class
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.life = 1;
    this.color = color;
    this.decay = Math.random() * 0.02 + 0.01;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

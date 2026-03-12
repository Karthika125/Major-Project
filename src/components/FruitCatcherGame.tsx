// FruitCatcherGame.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './FruitCatcherGame.module.css';

interface FruitCatcherGameProps {
  onClose: () => void;
  onDiscountEarned: (percent: number) => void;
}

interface Fruit {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  emoji: string;
  color: string;
  rotation: number;
  rotSpeed: number;
  isBomb: boolean;
}

const FRUIT_EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥝', '🍍'];
const BOMB_EMOJI = '💣';
const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 480;
const BASKET_WIDTH = 90;
const BASKET_HEIGHT = 50;
const BASKET_SPEED = 8;
const BASE_FRUIT_SPEED = 2.2;
const MAX_FRUIT_SPEED = 6.5;
const SPAWN_INTERVAL_MS = 1200;
const MIN_SPAWN_INTERVAL_MS = 500;
const GAME_DURATION_S = 35;

interface Explosion { x: number; y: number; frame: number; color: string; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

interface GameState {
  fruits: Fruit[];
  basketX: number;
  keys: { left: boolean; right: boolean };
  caught: number;
  missed: number;
  score: number;
  lives: number;
  gameOver: boolean;
  started: boolean;
  frameId: number;
  lastSpawn: number;
  spawnInterval: number;
  fruitIdCounter: number;
  timeLeft: number;
  lastTimerTick: number;
  explosions: Explosion[];
  particles: Particle[];
}

function getDiscountPercent(caught: number): number {
  if (caught <= 0) return 0;
  if (caught <= 2) return 10;
  if (caught <= 4) return 20;
  if (caught <= 6) return 30;
  if (caught <= 9) return 40;
  return 50;
}

export const FruitCatcherGame: React.FC<FruitCatcherGameProps> = ({ onClose, onDiscountEarned }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>({
    fruits: [],
    basketX: CANVAS_WIDTH / 2 - BASKET_WIDTH / 2,
    keys: { left: false, right: false },
    caught: 0,
    missed: 0,
    score: 0,
    lives: 3,
    gameOver: false,
    started: false,
    frameId: 0,
    lastSpawn: 0,
    spawnInterval: SPAWN_INTERVAL_MS,
    fruitIdCounter: 0,
    timeLeft: GAME_DURATION_S,
    lastTimerTick: 0,
    explosions: [],
    particles: [],
  });
  const [uiState, setUiState] = useState({
    caught: 0,
    lives: 3,
    score: 0,
    timeLeft: GAME_DURATION_S,
    gameOver: false,
    started: false,
    discount: 0,
    phase: 'idle' as 'idle' | 'playing' | 'gameover',
  });

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.fruits = [];
    s.basketX = CANVAS_WIDTH / 2 - BASKET_WIDTH / 2;
    s.keys = { left: false, right: false };
    s.caught = 0;
    s.missed = 0;
    s.score = 0;
    s.lives = 3;
    s.gameOver = false;
    s.started = true;
    s.lastSpawn = 0;
    s.spawnInterval = SPAWN_INTERVAL_MS;
    s.fruitIdCounter = 0;
    s.timeLeft = GAME_DURATION_S;
    s.lastTimerTick = performance.now();
    s.explosions = [];
    s.particles = [];
    setUiState(prev => ({ ...prev, caught: 0, lives: 3, score: 0, timeLeft: GAME_DURATION_S, gameOver: false, started: true, discount: 0, phase: 'playing' }));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') stateRef.current.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') stateRef.current.keys.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') stateRef.current.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') stateRef.current.keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const spawnFruit = (now: number) => {
      const s = stateRef.current;
      if (now - s.lastSpawn < s.spawnInterval) return;
      s.lastSpawn = now;
      // Difficulty: speed up over time
      const elapsed = GAME_DURATION_S - s.timeLeft;
      const speedFactor = Math.min(1, elapsed / 20);
      const speed = BASE_FRUIT_SPEED + speedFactor * (MAX_FRUIT_SPEED - BASE_FRUIT_SPEED);
      // Bomb chance increases with time
      const bombChance = 0.12 + speedFactor * 0.2;
      const isBomb = Math.random() < bombChance;
      const emoji = isBomb ? BOMB_EMOJI : FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
      const radius = isBomb ? 22 : 20 + Math.random() * 10;
      s.fruits.push({
        id: s.fruitIdCounter++,
        x: radius + Math.random() * (CANVAS_WIDTH - 2 * radius),
        y: -radius,
        radius,
        speed: speed + Math.random() * 1.2,
        emoji,
        color: isBomb ? '#ff4444' : `hsl(${Math.random() * 360}, 80%, 55%)`,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        isBomb,
      });
      // Update spawn interval
      s.spawnInterval = Math.max(MIN_SPAWN_INTERVAL_MS, SPAWN_INTERVAL_MS - elapsed * 18);
    };

    const drawBackground = () => {
      // Dark gradient sky
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, '#0d0221');
      grad.addColorStop(0.5, '#1a0535');
      grad.addColorStop(1, '#0f1a35');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const stars = [[30, 40], [80, 80], [160, 20], [220, 60], [300, 30], [380, 70], [440, 25], [500, 55], [60, 140], [400, 120]];
      stars.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawBasket = (x: number) => {
      const y = CANVAS_HEIGHT - BASKET_HEIGHT - 10;
      // Shadow
      ctx.save();
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 20;

      // Basket body
      const grad = ctx.createLinearGradient(x, y, x + BASKET_WIDTH, y + BASKET_HEIGHT);
      grad.addColorStop(0, '#7c3aed');
      grad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + BASKET_WIDTH - 8, y);
      ctx.lineTo(x + BASKET_WIDTH, y + BASKET_HEIGHT);
      ctx.lineTo(x, y + BASKET_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Basket weave lines
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + (BASKET_HEIGHT / 4) * i);
        ctx.lineTo(x + BASKET_WIDTH, y + (BASKET_HEIGHT / 4) * i);
        ctx.stroke();
      }
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (BASKET_WIDTH / 4) * i, y);
        ctx.lineTo(x + (BASKET_WIDTH / 4) * i, y + BASKET_HEIGHT);
        ctx.stroke();
      }

      // Top rim
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(x - 4, y - 6, BASKET_WIDTH + 8, 10);
      ctx.beginPath();
      ctx.arc(x - 4, y - 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + BASKET_WIDTH + 4, y - 1, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawFruit = (fruit: Fruit) => {
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      if (fruit.isBomb) {
        // Glow for bomb
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 16;
      } else {
        ctx.shadowColor = fruit.color;
        ctx.shadowBlur = 10;
      }
      ctx.font = `${fruit.radius * 1.75}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.emoji, 0, 0);
      ctx.restore();
    };

    const drawExplosion = (exp: { x: number; y: number; frame: number; color: string }) => {
      const alpha = 1 - exp.frame / 18;
      const r = exp.frame * 3.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = exp.color;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = exp.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawParticles = () => {
      const s = stateRef.current;
      s.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawHUD = () => {
      const s = stateRef.current;
      // Top bar bg
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 48);

      // Timer
      const timerColor = s.timeLeft <= 10 ? '#ff4444' : '#a3e635';
      ctx.fillStyle = timerColor;
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱ ${s.timeLeft}s`, CANVAS_WIDTH / 2, 30);

      // Lives
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f472b6';
      ctx.font = '20px serif';
      ctx.fillText('❤️'.repeat(s.lives), 12, 32);

      // Caught / Score
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.fillText(`🍎 ${s.caught}   🏆 ${s.score}`, CANVAS_WIDTH - 12, 30);
    };

    const drawIdleScreen = () => {
      drawBackground();
      ctx.save();
      ctx.textAlign = 'center';

      const grd = ctx.createLinearGradient(0, 140, CANVAS_WIDTH, 220);
      grd.addColorStop(0, '#a855f7');
      grd.addColorStop(1, '#38bdf8');
      ctx.fillStyle = grd;
      ctx.font = 'bold 38px "Segoe UI", sans-serif';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 25;
      ctx.fillText('🍎 Fruit Catcher!', CANVAS_WIDTH / 2, 175);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '16px "Segoe UI", sans-serif';
      ctx.fillText('Catch fruits ← → to earn discounts!', CANVAS_WIDTH / 2, 222);
      ctx.fillText('Avoid 💣 bombs — they cost you a life!', CANVAS_WIDTH / 2, 248);

      ctx.fillStyle = '#a3e635';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText('🍎×1-2 → 10%  |  🍎×3-4 → 20%  |  🍎×5-6 → 30%', CANVAS_WIDTH / 2, 290);
      ctx.fillText('🍎×7-9 → 40%  |  🍎×10+ → 50% discount!', CANVAS_WIDTH / 2, 312);

      ctx.restore();
    };

    const drawGameOverScreen = () => {
      const s = stateRef.current;
      drawBackground();
      ctx.save();
      ctx.textAlign = 'center';

      const grd = ctx.createLinearGradient(0, 120, CANVAS_WIDTH, 200);
      grd.addColorStop(0, '#f59e0b');
      grd.addColorStop(1, '#ef4444');
      ctx.fillStyle = grd;
      ctx.font = 'bold 38px "Segoe UI", sans-serif';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 25;
      ctx.fillText('🎉 Game Over!', CANVAS_WIDTH / 2, 165);

      const discount = getDiscountPercent(s.caught);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillText(`Fruits Caught: ${s.caught}  |  Score: ${s.score}`, CANVAS_WIDTH / 2, 215);

      if (discount > 0) {
        const dGrd = ctx.createLinearGradient(0, 240, CANVAS_WIDTH, 290);
        dGrd.addColorStop(0, '#a855f7');
        dGrd.addColorStop(1, '#38bdf8');
        ctx.fillStyle = dGrd;
        ctx.font = 'bold 32px "Segoe UI", sans-serif';
        ctx.shadowColor = '#a3e635';
        ctx.shadowBlur = 20;
        ctx.fillText(`🎁 You earned ${discount}% discount!`, CANVAS_WIDTH / 2, 270);
      } else {
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.fillText('No fruits caught — no discount this time!', CANVAS_WIDTH / 2, 265);
      }

      ctx.restore();
    };

    let lastFrame = 0;
    const loop = (now: number) => {
      const s = stateRef.current;
      s.frameId = requestAnimationFrame(loop);

      if (!s.started) {
        drawIdleScreen();
        return;
      }
      if (s.gameOver) {
        drawGameOverScreen();
        return;
      }

      const dt = Math.min(now - lastFrame, 50);
      lastFrame = now;

      // Timer countdown
      if (now - s.lastTimerTick >= 1000) {
        s.timeLeft = Math.max(0, s.timeLeft - 1);
        s.lastTimerTick = now;
        if (s.timeLeft <= 0) {
          s.gameOver = true;
          const disc = getDiscountPercent(s.caught);
          setUiState(prev => ({ ...prev, gameOver: true, phase: 'gameover', discount: disc, caught: s.caught, score: s.score }));
          if (disc > 0) onDiscountEarned(disc);
          return;
        }
      }

      // Move basket
      if (s.keys.left) s.basketX = Math.max(0, s.basketX - BASKET_SPEED);
      if (s.keys.right) s.basketX = Math.min(CANVAS_WIDTH - BASKET_WIDTH, s.basketX + BASKET_SPEED);

      // Spawn
      spawnFruit(now);

      // Move fruits
      const basketY = CANVAS_HEIGHT - BASKET_HEIGHT - 10;
      const toRemove: number[] = [];
      for (const fruit of s.fruits) {
        fruit.y += fruit.speed * (dt / 16);
        fruit.rotation += fruit.rotSpeed;

        // Check catch
        if (
          fruit.y + fruit.radius >= basketY &&
          fruit.y - fruit.radius < basketY + BASKET_HEIGHT &&
          fruit.x + fruit.radius > s.basketX + 6 &&
          fruit.x - fruit.radius < s.basketX + BASKET_WIDTH - 6
        ) {
          toRemove.push(fruit.id);
          // Spawn particles
          for (let i = 0; i < 10; i++) {
            s.particles.push({
              x: fruit.x, y: fruit.y,
              vx: (Math.random() - 0.5) * 5,
              vy: -Math.random() * 6 - 1,
              life: 1,
              color: fruit.isBomb ? '#ff4444' : fruit.color,
            });
          }
          if (fruit.isBomb) {
            s.lives = Math.max(0, s.lives - 1);
            s.explosions.push({ x: fruit.x, y: fruit.y, frame: 0, color: '#ff6600' });
            setUiState(prev => ({ ...prev, lives: s.lives }));
            if (s.lives <= 0) {
              s.gameOver = true;
              const disc = getDiscountPercent(s.caught);
              setUiState(prev => ({ ...prev, gameOver: true, phase: 'gameover', discount: disc, caught: s.caught, score: s.score }));
              if (disc > 0) onDiscountEarned(disc);
            }
          } else {
            s.caught++;
            s.score += Math.ceil(fruit.speed * 10);
            s.explosions.push({ x: fruit.x, y: fruit.y, frame: 0, color: '#a3e635' });
            setUiState(prev => ({ ...prev, caught: s.caught, score: s.score }));
          }
        }

        // Miss
        if (fruit.y - fruit.radius > CANVAS_HEIGHT) {
          toRemove.push(fruit.id);
          if (!fruit.isBomb) {
            s.missed++;
          }
        }
      }
      s.fruits = s.fruits.filter(f => !toRemove.includes(f.id));

      // Update particles
      s.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 0.04;
      });
      s.particles = s.particles.filter(p => p.life > 0);

      // Update explosions
      s.explosions.forEach(e => e.frame++);
      s.explosions = s.explosions.filter(e => e.frame < 18);

      // Draw
      drawBackground();
      drawParticles();
      s.explosions.forEach(drawExplosion);
      s.fruits.forEach(drawFruit);
      drawBasket(s.basketX);
      drawHUD();
    };

    stateRef.current.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(stateRef.current.frameId);
  }, [onDiscountEarned]);

  const discount = getDiscountPercent(uiState.caught);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🎮 Fruit Catcher Mini-Game</span>
          <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
        </div>

        <div className={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className={styles.canvas}
          />

          {/* Mobile/Touch controls */}
          <div className={styles.touchControls}>
            <button
              className={styles.touchBtn}
              onPointerDown={() => { stateRef.current.keys.left = true; }}
              onPointerUp={() => { stateRef.current.keys.left = false; }}
              onPointerLeave={() => { stateRef.current.keys.left = false; }}
            >◀</button>
            <button
              className={styles.touchBtn}
              onPointerDown={() => { stateRef.current.keys.right = true; }}
              onPointerUp={() => { stateRef.current.keys.right = false; }}
              onPointerLeave={() => { stateRef.current.keys.right = false; }}
            >▶</button>
          </div>
        </div>

        <div className={styles.footer}>
          {uiState.phase === 'idle' && (
            <button className={styles.startBtn} onClick={startGame}>
              🚀 Start Game
            </button>
          )}
          {uiState.phase === 'playing' && (
            <div className={styles.liveStats}>
              <span>🍎 Caught: <b>{uiState.caught}</b></span>
              <span>❤️ Lives: <b>{uiState.lives}</b></span>
              <span>⏱ Time: <b>{uiState.timeLeft}s</b></span>
              <span>🏆 Score: <b>{uiState.score}</b></span>
              {uiState.caught >= 3 && (
                <span className={styles.discountBadge}>🎁 {getDiscountPercent(uiState.caught)}% OFF!</span>
              )}
            </div>
          )}
          {uiState.phase === 'gameover' && (
            <div className={styles.gameOverFooter}>
              {uiState.discount > 0 ? (
                <div className={styles.discountResult}>
                  <span className={styles.bigDiscount}>🎁 {uiState.discount}% Discount Unlocked!</span>
                  <span className={styles.subText}>Applied to your next purchase 🛍️</span>
                </div>
              ) : (
                <span className={styles.noDiscount}>No discount this time — try again!</span>
              )}
              <button className={styles.startBtn} onClick={startGame}>🔄 Play Again</button>
            </div>
          )}
        </div>

        <div className={styles.discountLegend}>
          <span>🍎×1-2 → <b>10%</b></span>
          <span>×3-4 → <b>20%</b></span>
          <span>×5-6 → <b>30%</b></span>
          <span>×7-9 → <b>40%</b></span>
          <span>×10+ → <b>50%</b></span>
        </div>
      </div>
    </div>
  );
};

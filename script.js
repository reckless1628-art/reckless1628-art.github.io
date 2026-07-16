const navToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open');
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (navToggle && nav) {
      navToggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    }
  });
});

const matrixCanvas = document.getElementById('matrix-canvas');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (matrixCanvas && !prefersReducedMotion.matches) {
  const ctx = matrixCanvas.getContext('2d');
  const glyphs = '0123456789ABCDEF'.split('');
  const columnSpacing = 20;
  const speed = 400;
  let matrixWidth = 0;
  let matrixHeight = 0;
  let rainColumns = [];
  let lastFrame = 0;

  const resizeMatrix = () => {
    const ratio = window.devicePixelRatio || 1;
    matrixWidth = Math.floor(window.innerWidth);
    matrixHeight = Math.floor(window.innerHeight);
    matrixCanvas.width = Math.floor(matrixWidth * ratio);
    matrixCanvas.height = Math.floor(matrixHeight * ratio);
    matrixCanvas.style.width = `${matrixWidth}px`;
    matrixCanvas.style.height = `${matrixHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const columnCount = Math.max(1, Math.ceil(matrixWidth / columnSpacing));
    rainColumns = Array.from({ length: columnCount }, (_, index) => rainColumns[index] ?? Math.random() * matrixHeight);
  };

  const drawMatrix = (timestamp) => {
    const delta = Math.min(32, timestamp - lastFrame || 16);
    lastFrame = timestamp;

    ctx.fillStyle = 'rgba(2, 6, 3, 0.12)';
    ctx.fillRect(0, 0, matrixWidth, matrixHeight);
    ctx.fillStyle = '#57ff75';
    ctx.font = '18px monospace';

    rainColumns.forEach((y, index) => {
      const glyph = glyphs[(Math.random() * glyphs.length) | 0];
      const x = index * columnSpacing + 24;
      const nextY = (y + (speed * delta) / 1000) % (matrixHeight + 32);
      ctx.fillText(glyph, x, nextY);
      rainColumns[index] = nextY > matrixHeight ? 0 : nextY;
    });

    requestAnimationFrame(drawMatrix);
  };

  resizeMatrix();
  window.addEventListener('resize', resizeMatrix, { passive: true });
  requestAnimationFrame(drawMatrix);
}

const snakeCanvas = document.getElementById('snake-canvas');
const statusValue = document.getElementById('game-status');
const scoreValue = document.getElementById('score-value');
const bestValue = document.getElementById('best-value');
const actionButtons = document.querySelectorAll('[data-action]');
const directionButtons = document.querySelectorAll('[data-dir]');
const runnerCanvas = document.getElementById('runner-canvas');
const runnerStatusValue = document.getElementById('runner-status');
const runnerScoreValue = document.getElementById('runner-score');
const runnerBestValue = document.getElementById('runner-best');
const runnerButtons = document.querySelectorAll('[data-runner-action]');
let activeGame = 'snake';

const setActiveGame = (game) => {
  activeGame = game;
};
const randomInt = (limit) => Math.floor(Math.random() * limit);
const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 800;
const CELL = 20;
const COLS = BOARD_WIDTH / CELL;
const ROWS = BOARD_HEIGHT / CELL;
const SNAKE_STEP_MS = 200;
const ENEMY_STEP_MS = 1000;
const ENEMY_LIFETIME_MS = 10000;
const ENEMY_FIRST_SPAWN_MS = 60000;
const ENEMY_REPEAT_SPAWN_MS = 120000;
const STORAGE_KEY = 'reckless1628_art_snake_high_score';
const RUNNER_STORAGE_KEY = 'reckless1628_art_runner_high_score';

if (snakeCanvas) {
  const ctx = snakeCanvas.getContext('2d');
  const controls = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  let state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    best: Number(localStorage.getItem(STORAGE_KEY) || 0),
    snake: [],
    direction: controls.right,
    queuedDirection: controls.right,
    food: null,
    enemies: [],
    elapsed: 0,
    spawnSchedule: ENEMY_FIRST_SPAWN_MS,
    snakeAccumulator: 0,
    enemyAccumulator: 0,
    lastTimestamp: 0,
  };

  const setStatus = (value) => {
    if (statusValue) {
      statusValue.textContent = value;
    }
  };

  const setScore = () => {
    if (scoreValue) {
      scoreValue.textContent = String(state.score);
    }
    if (bestValue) {
      bestValue.textContent = String(state.best);
    }
  };

  const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y;

  const keyOf = (cell) => `${cell.x}:${cell.y}`;

  const isInside = (cell) => cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS;

  const inverse = (dir) => ({ x: -dir.x, y: -dir.y });

  const isOpposite = (a, b) => a.x === -b.x && a.y === -b.y;

  const occupiedBySnake = new Set();
  const occupiedByEnemies = new Set();

  const rebuildOccupancy = () => {
    occupiedBySnake.clear();
    occupiedByEnemies.clear();
    state.snake.forEach((part) => occupiedBySnake.add(keyOf(part)));
    state.enemies.forEach((enemy) => {
      enemy.body.forEach((part) => occupiedByEnemies.add(keyOf(part)));
    });
  };

  const freeCell = () => {
    const blocked = new Set([...occupiedBySnake, ...occupiedByEnemies, state.food ? keyOf(state.food) : null].filter(Boolean));
    const cells = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = { x, y };
        if (!blocked.has(keyOf(cell))) {
          cells.push(cell);
        }
      }
    }
    return cells.length ? cells[randomInt(cells.length)] : { x: 0, y: 0 };
  };

  const makeFood = () => {
    rebuildOccupancy();
    state.food = freeCell();
  };

  const createSnake = () => ([
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]);

  const createEnemy = () => {
    rebuildOccupancy();
    const head = freeCell();
    const templates = [
      [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }, { x: 0, y: -3 }],
      [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
    ];
    const offsets = templates[randomInt(templates.length)];
    const body = offsets
      .map((offset) => ({ x: head.x + offset.x, y: head.y + offset.y }))
      .filter(isInside);
    const enemy = {
      body,
      age: 0,
      moveAccumulator: 0,
      ttl: ENEMY_LIFETIME_MS,
    };
    return enemy;
  };

  const resetGame = () => {
    state = {
      ...state,
      running: false,
      paused: false,
      gameOver: false,
      score: 0,
      snake: createSnake(),
      direction: controls.right,
      queuedDirection: controls.right,
      enemies: [],
      elapsed: 0,
      spawnSchedule: ENEMY_FIRST_SPAWN_MS,
      snakeAccumulator: 0,
      enemyAccumulator: 0,
      lastTimestamp: 0,
    };
    makeFood();
    setScore();
    setStatus('준비중');
    draw();
  };

  const startGame = () => {
    if (state.gameOver) {
      resetGame();
    }
    state.running = true;
    state.paused = false;
    setStatus('진행중');
  };

  const pauseGame = () => {
    if (!state.running || state.gameOver) {
      return;
    }
    state.paused = !state.paused;
    setStatus(state.paused ? '일시정지' : '진행중');
  };

  const endGame = () => {
    state.running = true;
    state.paused = true;
    state.gameOver = true;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(STORAGE_KEY, String(state.best));
    setScore();
    setStatus('게임 오버');
  };

  const changeDirection = (next) => {
    if (isOpposite(next, state.direction) && state.snake.length > 1) {
      return;
    }
    state.queuedDirection = next;
  };

  const removeEnemy = (index, points) => {
    state.enemies.splice(index, 1);
    state.score += points;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(STORAGE_KEY, String(state.best));
    setScore();
  };

  const handleSnakeEnemyCollision = (head) => {
    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      if (enemy.body.some((part) => sameCell(part, head))) {
        if (state.snake.length >= enemy.body.length) {
          removeEnemy(i, 200);
          return 'removed';
        }
        endGame();
        return 'gameover';
      }
    }
    return 'none';
  };

  const stepSnake = () => {
    state.direction = state.queuedDirection;
    const head = state.snake[0];
    const next = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };

    if (!isInside(next)) {
      endGame();
      return;
    }

    if (state.snake.some((part) => sameCell(part, next))) {
      endGame();
      return;
    }

    const ateFood = sameCell(next, state.food);
    state.snake.unshift(next);

    const collision = handleSnakeEnemyCollision(next);
    if (collision === 'gameover') {
      return;
    }

    if (!ateFood) {
      state.snake.pop();
    } else {
      state.score += 10;
      state.best = Math.max(state.best, state.score);
      setScore();
      makeFood();
    }
  };

  const randomAdjacent = (cell) => {
    const options = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ].filter((candidate) => isInside(candidate) && !sameCell(candidate, state.food));
    if (!options.length) {
      return cell;
    }
    return options[randomInt(options.length)];
  };

  const moveEnemy = (enemy) => {
    const candidates = [
      { x: enemy.body[0].x + 1, y: enemy.body[0].y },
      { x: enemy.body[0].x - 1, y: enemy.body[0].y },
      { x: enemy.body[0].x, y: enemy.body[0].y + 1 },
      { x: enemy.body[0].x, y: enemy.body[0].y - 1 },
    ].filter((candidate) => isInside(candidate) && !sameCell(candidate, state.food));
    const nextHead = candidates.length ? candidates[randomInt(candidates.length)] : enemy.body[0];
    const newBody = [nextHead, ...enemy.body.slice(0, enemy.body.length - 1)];
    return { ...enemy, body: newBody };
  };

  const handleEnemyCollisions = () => {
    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      if (enemy.body.some((part) => sameCell(part, state.snake[0]))) {
        if (state.snake.length >= enemy.body.length) {
          removeEnemy(i, 200);
          i -= 1;
        } else {
          endGame();
          return;
        }
      }
    }
  };

  const stepEnemies = () => {
    state.enemies = state.enemies
      .map((enemy) => ({
        ...enemy,
        age: enemy.age + ENEMY_STEP_MS,
        ttl: enemy.ttl - ENEMY_STEP_MS,
        moveAccumulator: enemy.moveAccumulator + ENEMY_STEP_MS,
      }))
      .map((enemy) => {
        if (enemy.moveAccumulator >= ENEMY_STEP_MS) {
          return {
            ...moveEnemy(enemy),
            age: enemy.age,
            ttl: enemy.ttl,
            moveAccumulator: 0,
          };
        }
        return enemy;
      });

    handleEnemyCollisions();

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.ttl <= 0) {
        state.score += 25;
        state.best = Math.max(state.best, state.score);
        localStorage.setItem(STORAGE_KEY, String(state.best));
        setScore();
        return false;
      }
      return true;
    });
  };

  const maybeSpawnEnemy = () => {
    if (state.elapsed < state.spawnSchedule || state.enemies.length >= 2) {
      return;
    }
    rebuildOccupancy();
    state.enemies.push(createEnemy());
    state.spawnSchedule += ENEMY_REPEAT_SPAWN_MS;
  };

  const drawGrid = () => {
    ctx.fillStyle = 'rgba(1, 4, 2, 0.95)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.strokeStyle = 'rgba(83, 255, 121, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(BOARD_WIDTH, y * CELL + 0.5);
      ctx.stroke();
    }
  };

  const drawCell = (cell, fillStyle, inset = 2) => {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(cell.x * CELL + inset, cell.y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
  };

  const drawSnakeHead = (cell, direction) => {
    drawCell(cell, '#53ff79', 2);

    const centerX = cell.x * CELL + CELL / 2;
    const centerY = cell.y * CELL + CELL / 2;
    const forwardX = direction.x * 3;
    const forwardY = direction.y * 3;
    const sideX = -direction.y * 4;
    const sideY = direction.x * 4;
    const eyes = [
      { x: centerX + forwardX + sideX, y: centerY + forwardY + sideY },
      { x: centerX + forwardX - sideX, y: centerY + forwardY - sideY },
    ];

    eyes.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.fillStyle = '#f3fff4';
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#041506';
      ctx.arc(x + direction.x * 0.7, y + direction.y * 0.7, 0.9, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const draw = () => {
    drawGrid();

    if (state.food) {
      drawCell(state.food, '#ffe36e', 4);
    }

    state.enemies.forEach((enemy) => {
      enemy.body.forEach((part, index) => {
        drawCell(part, index === 0 ? '#ff5e66' : '#b53f4c', 3);
      });
    });

    state.snake.slice(1).forEach((part) => {
      drawCell(part, '#2eb85a', 3);
    });

    if (state.snake[0]) {
      drawSnakeHead(state.snake[0], state.direction);
    }

    if (!state.running) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.fillStyle = '#dfffe4';
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px Trebuchet MS, sans-serif';
      ctx.fillText('READY', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 18);
      ctx.font = '16px Trebuchet MS, sans-serif';
      ctx.fillText('Start로 게임을 시작하세요', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 18);
    } else if (state.paused && !state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.fillStyle = '#ffe36e';
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px Trebuchet MS, sans-serif';
      ctx.fillText('PAUSED', BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
    } else if (state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.fillStyle = '#ff6675';
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px Trebuchet MS, sans-serif';
      ctx.fillText('GAME OVER', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 18);
      ctx.fillStyle = '#dfffe4';
      ctx.font = '16px Trebuchet MS, sans-serif';
      ctx.fillText('Restart로 다시 시작할 수 있습니다', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 18);
    }
  };

  const loop = (timestamp) => {
    if (!state.running) {
      state.lastTimestamp = timestamp;
      draw();
      requestAnimationFrame(loop);
      return;
    }

    if (state.gameOver) {
      draw();
      requestAnimationFrame(loop);
      return;
    }

    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }

    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    if (!state.paused) {
      state.elapsed += delta;
      state.snakeAccumulator += delta;
      state.enemyAccumulator += delta;

      maybeSpawnEnemy();

      while (state.snakeAccumulator >= SNAKE_STEP_MS && !state.gameOver) {
        state.snakeAccumulator -= SNAKE_STEP_MS;
        stepSnake();
      }

      while (state.enemyAccumulator >= ENEMY_STEP_MS && !state.gameOver) {
        state.enemyAccumulator -= ENEMY_STEP_MS;
        stepEnemies();
      }
    }

    draw();
    requestAnimationFrame(loop);
  };

  const handleAction = (action) => {
    if (action === 'start') {
      if (!state.snake.length || state.gameOver) {
        resetGame();
      }
      startGame();
    }
    if (action === 'pause') {
      if (!state.snake.length) {
        resetGame();
      }
      pauseGame();
    }
    if (action === 'restart') {
      resetGame();
      startGame();
    }
  };

  const keyboardMap = {
    ArrowUp: controls.up,
    ArrowDown: controls.down,
    ArrowLeft: controls.left,
    ArrowRight: controls.right,
    w: controls.up,
    W: controls.up,
    a: controls.left,
    A: controls.left,
    s: controls.down,
    S: controls.down,
    d: controls.right,
    D: controls.right,
  };

window.addEventListener('keydown', (event) => {
    if (activeGame === 'runner') {
      return;
    }

    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      handleAction('pause');
      return;
    }

    const nextDirection = keyboardMap[event.key];
    if (nextDirection) {
      event.preventDefault();
      changeDirection(nextDirection);
    }
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveGame('snake');
      handleAction(button.dataset.action);
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveGame('snake');
      const dir = controls[button.dataset.dir];
      if (dir) {
        changeDirection(dir);
      }
    });
  });

  snakeCanvas.addEventListener('pointerdown', () => {
    setActiveGame('snake');
  });
  snakeCanvas.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
  snakeCanvas.addEventListener('pointerdown', (event) => event.preventDefault());

  const drawInitial = () => {
    resetGame();
    draw();
    requestAnimationFrame(loop);
  };

  drawInitial();
}

if (runnerCanvas) {
  const ctx = runnerCanvas.getContext('2d');
  const RUNNER_WIDTH = 900;
  const RUNNER_HEIGHT = 320;
  const GROUND_Y = 260;
  const PLAYER_X = 118;
  const PLAYER_WIDTH = 44;
  const PLAYER_STAND_HEIGHT = 52;
  const PLAYER_DUCK_HEIGHT = 30;
  const JUMP1 = { peak: 58, duration: 520 };
  const JUMP2 = { peak: 92, duration: 760 };
  const DOUBLE_JUMP_WINDOW_MS = 300;
  const RUNNER_START_SPEED = 100;
  const RUNNER_MAX_SPEED = RUNNER_WIDTH / 1.6;
  const RUNNER_START_SPAWN_MS = 3000;
  const RUNNER_MIN_SPAWN_MS = 1500;
  const RUNNER_SPAWN_DROP_MS = 120;
  const RUNNER_SPEED_RAMP_MS = 12000;
  const obstacleKinds = [
    {
      kind: 'jump1',
      label: 'J1',
      color: '#77ff7a',
      width: 32,
      height: 24,
      y: GROUND_Y - 24,
      requiredAction: 'jump1',
      points: 15,
    },
    {
      kind: 'jump2',
      label: 'J2',
      color: '#ffe36e',
      width: 38,
      height: 18,
      y: 170,
      requiredAction: 'jump2',
      points: 20,
    },
    {
      kind: 'stand',
      label: 'S',
      color: '#6ad3ff',
      width: 42,
      height: 16,
      y: 158,
      requiredAction: 'stand',
      points: 16,
    },
    {
      kind: 'duck',
      label: 'D',
      color: '#ff9f6b',
      width: 46,
      height: 12,
      y: 214,
      requiredAction: 'duck',
      points: 18,
    },
  ];

  const runnerControls = {
    jump1: JUMP1,
    jump2: JUMP2,
  };

  let state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    best: Number(localStorage.getItem(RUNNER_STORAGE_KEY) || 0),
    elapsed: 0,
    distance: 0,
    cleared: 0,
    speed: RUNNER_START_SPEED,
    obstacles: [],
    spawnAccumulator: 0,
    spawnJitter: 0,
    nextSpawnDelay: RUNNER_START_SPAWN_MS,
    jump: null,
    ducking: false,
    lastTimestamp: 0,
  };

  const setStatus = (value) => {
    if (runnerStatusValue) {
      runnerStatusValue.textContent = value;
    }
  };

  const setScore = () => {
    if (runnerScoreValue) {
      runnerScoreValue.textContent = String(state.score);
    }
    if (runnerBestValue) {
      runnerBestValue.textContent = String(state.best);
    }
  };

  const syncScore = () => {
    state.score = Math.floor(state.distance / 14) + (state.cleared * 20);
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(RUNNER_STORAGE_KEY, String(state.best));
    setScore();
  };

  const currentRunnerSpeed = () => Math.min(
    RUNNER_MAX_SPEED,
    RUNNER_START_SPEED + ((RUNNER_MAX_SPEED - RUNNER_START_SPEED) * state.elapsed) / RUNNER_SPEED_RAMP_MS,
  );

  const currentSpawnDelay = () => {
    const decaySteps = Math.floor(state.elapsed / 5000);
    const reducedDelay = RUNNER_START_SPAWN_MS - (decaySteps * RUNNER_SPAWN_DROP_MS);
    const jitter = state.spawnJitter || 0;
    return Math.max(RUNNER_MIN_SPAWN_MS, reducedDelay + jitter);
  };

  const rollSpawnJitter = () => randomInt(601) - 300;

  const resetRunner = () => {
    state = {
      ...state,
      running: false,
      paused: false,
      gameOver: false,
      score: 0,
      elapsed: 0,
      distance: 0,
      cleared: 0,
      speed: RUNNER_START_SPEED,
      obstacles: [],
      spawnAccumulator: 0,
      spawnJitter: rollSpawnJitter(),
      nextSpawnDelay: RUNNER_START_SPAWN_MS,
      jump: null,
      ducking: false,
      lastTimestamp: 0,
    };
    setScore();
    setStatus('준비중');
    drawRunner();
  };

  const startRunner = () => {
    if (state.gameOver) {
      resetRunner();
    }
    state.running = true;
    state.paused = false;
    setStatus('진행중');
  };

  const pauseRunner = () => {
    if (!state.running || state.gameOver) {
      return;
    }
    state.paused = !state.paused;
    setStatus(state.paused ? '일시정지' : '진행중');
  };

  const endRunner = () => {
    state.running = true;
    state.paused = true;
    state.gameOver = true;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(RUNNER_STORAGE_KEY, String(state.best));
    setScore();
    setStatus('게임 오버');
  };

  const ensureRunning = () => {
    if (state.gameOver) {
      resetRunner();
      state.running = true;
      setStatus('진행중');
      return;
    }
    if (!state.running) {
      startRunner();
      return;
    }
    if (state.paused) {
      state.paused = false;
      setStatus('진행중');
    }
  };

  const startJump = () => {
    ensureRunning();
    if (state.gameOver) {
      return;
    }

    if (!state.jump) {
      state.ducking = false;
      state.jump = {
        phase: 1,
        elapsed: 0,
        duration: runnerControls.jump1.duration,
        peak: runnerControls.jump1.peak,
      };
      return;
    }

    if (state.jump.phase === 1 && state.jump.elapsed <= DOUBLE_JUMP_WINDOW_MS) {
      state.ducking = false;
      state.jump = {
        phase: 2,
        elapsed: 0,
        duration: runnerControls.jump2.duration,
        peak: runnerControls.jump2.peak,
      };
    }
  };

  const startDuck = () => {
    ensureRunning();
    if (state.gameOver || state.jump) {
      return;
    }
    state.ducking = true;
  };

  const stopDuck = () => {
    if (!state.jump) {
      state.ducking = false;
    }
  };

  const currentJumpOffset = () => {
    if (!state.jump) {
      return 0;
    }
    const progress = Math.min(1, state.jump.elapsed / state.jump.duration);
    return Math.sin(progress * Math.PI) * state.jump.peak;
  };

  const playerBounds = () => {
    const duckHeight = state.ducking ? PLAYER_DUCK_HEIGHT : PLAYER_STAND_HEIGHT;
    const y = GROUND_Y - duckHeight - currentJumpOffset();
    return {
      x: PLAYER_X,
      y,
      width: PLAYER_WIDTH,
      height: duckHeight,
    };
  };

  const obstacleBounds = (obstacle) => ({
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.width,
    height: obstacle.height,
  });

  const rectsOverlap = (a, b) => (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );

  const createObstacle = () => {
    const template = obstacleKinds[randomInt(obstacleKinds.length)];
    return {
      ...template,
      x: RUNNER_WIDTH + 40,
      passed: false,
      resolved: false,
    };
  };

  const drawRoundedBar = (x, y, width, height, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  };

  const drawRunnerGround = () => {
    ctx.fillStyle = 'rgba(1, 4, 2, 0.95)';
    ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, RUNNER_HEIGHT);
    gradient.addColorStop(0, 'rgba(8, 22, 10, 0.98)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);

    ctx.strokeStyle = 'rgba(83, 255, 121, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 0.5);
    ctx.lineTo(RUNNER_WIDTH, GROUND_Y + 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(83, 255, 121, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= RUNNER_WIDTH; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, GROUND_Y - 30);
      ctx.lineTo(x + 0.5, RUNNER_HEIGHT);
      ctx.stroke();
    }
  };

  const drawPlayer = () => {
    const player = playerBounds();
    const isDuck = state.ducking && !state.jump;
    ctx.fillStyle = isDuck ? '#ffe36e' : '#53ff79';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    if (!isDuck) {
      ctx.fillStyle = '#f3fff4';
      ctx.beginPath();
      ctx.arc(player.x + 12, player.y + 14, 2.1, 0, Math.PI * 2);
      ctx.arc(player.x + 24, player.y + 14, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#041506';
      ctx.fillRect(player.x + 10, player.y + 14, 16, 3);
    }
  };

  const drawObstacle = (obstacle) => {
    const alpha = obstacle.resolved ? 0.45 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawRoundedBar(obstacle.x, obstacle.y, obstacle.width, obstacle.height, obstacle.color);
    ctx.fillStyle = '#041506';
    ctx.font = 'bold 14px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obstacle.label, obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 5);
    ctx.restore();
  };

  const drawRunner = () => {
    drawRunnerGround();

    drawPlayer();

    state.obstacles.forEach(drawObstacle);

    if (!state.running) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
      ctx.fillStyle = '#dfffe4';
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Trebuchet MS, sans-serif';
      ctx.fillText('READY', RUNNER_WIDTH / 2, RUNNER_HEIGHT / 2 - 18);
      ctx.font = '16px Trebuchet MS, sans-serif';
      ctx.fillText('ArrowUp로 점프, ArrowDown으로 숙이기', RUNNER_WIDTH / 2, RUNNER_HEIGHT / 2 + 18);
    } else if (state.paused && !state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
      ctx.fillStyle = '#ffe36e';
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Trebuchet MS, sans-serif';
      ctx.fillText('PAUSED', RUNNER_WIDTH / 2, RUNNER_HEIGHT / 2);
    } else if (state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
      ctx.fillStyle = '#ff6675';
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Trebuchet MS, sans-serif';
      ctx.fillText('GAME OVER', RUNNER_WIDTH / 2, RUNNER_HEIGHT / 2 - 18);
      ctx.fillStyle = '#dfffe4';
      ctx.font = '16px Trebuchet MS, sans-serif';
      ctx.fillText('Restart로 다시 시작할 수 있습니다', RUNNER_WIDTH / 2, RUNNER_HEIGHT / 2 + 18);
    }
  };

  const spawnRunnerObstacle = () => {
    if (state.obstacles.length >= 4) {
      return;
    }
    state.obstacles.push(createObstacle());
  };

  const updateRunnerObstacles = (delta) => {
    state.speed = currentRunnerSpeed();
    state.obstacles = state.obstacles
      .map((obstacle) => ({
        ...obstacle,
        x: obstacle.x - (state.speed * delta) / 1000,
      }))
      .filter((obstacle) => obstacle.x + obstacle.width > -20);

    const player = playerBounds();

    state.obstacles.forEach((obstacle) => {
      if (obstacle.resolved) {
        return;
      }
      if (!rectsOverlap(player, obstacleBounds(obstacle))) {
        return;
      }

      const safe =
        (obstacle.requiredAction === 'jump1' && state.jump) ||
        (obstacle.requiredAction === 'jump2' && state.jump && state.jump.phase === 2) ||
        (obstacle.requiredAction === 'stand' && !state.jump && !state.ducking) ||
        (obstacle.requiredAction === 'duck' && state.ducking && !state.jump);

      if (safe) {
        obstacle.resolved = true;
        state.cleared += 1;
        state.distance += obstacle.points * 2;
        syncScore();
      } else {
        endRunner();
      }
    });
  };

  const stepJump = (delta) => {
    if (!state.jump) {
      return;
    }
    state.jump.elapsed += delta;
    if (state.jump.elapsed >= state.jump.duration) {
      state.jump = null;
    }
  };

  const loopRunner = (timestamp) => {
    if (!state.running) {
      state.lastTimestamp = timestamp;
      drawRunner();
      requestAnimationFrame(loopRunner);
      return;
    }

    if (state.gameOver) {
      drawRunner();
      requestAnimationFrame(loopRunner);
      return;
    }

    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }

    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    if (!state.paused) {
      state.elapsed += delta;
      state.spawnAccumulator += delta;
      state.speed = currentRunnerSpeed();
      state.nextSpawnDelay = currentSpawnDelay();

      while (state.spawnAccumulator >= state.nextSpawnDelay) {
        state.spawnAccumulator -= state.nextSpawnDelay;
        spawnRunnerObstacle();
        state.spawnJitter = rollSpawnJitter();
        state.nextSpawnDelay = currentSpawnDelay();
      }

      state.distance += state.speed * delta / 1000;
      stepJump(delta);
      updateRunnerObstacles(delta);
      syncScore();
    }

    drawRunner();
    requestAnimationFrame(loopRunner);
  };

  const handleRunnerAction = (action) => {
    setActiveGame('runner');
    if (action === 'start') {
      if (!state.running || state.gameOver) {
        resetRunner();
      }
      startRunner();
      return;
    }

    if (action === 'pause') {
      if (!state.running) {
        resetRunner();
      }
      pauseRunner();
      return;
    }

    if (action === 'restart') {
      resetRunner();
      startRunner();
      return;
    }

    if (action === 'jump1') {
      startJump();
      return;
    }

    if (action === 'jump2') {
      startJump();
      return;
    }

    if (action === 'duck') {
      startDuck();
    }
  };

  const runnerKeyDown = (event) => {
    if (activeGame === 'snake') {
      return;
    }

    if (event.repeat) {
      return;
    }

    if (event.code === 'ArrowUp' || event.key === 'ArrowUp') {
      event.preventDefault();
      startJump();
      return;
    }

    if (event.code === 'ArrowDown' || event.key === 'ArrowDown') {
      event.preventDefault();
      startDuck();
    }
  };

  const runnerKeyUp = (event) => {
    if (event.code === 'ArrowDown' || event.key === 'ArrowDown') {
      stopDuck();
    }
  };

  runnerButtons.forEach((button) => {
    const action = button.dataset.runnerAction;
    button.addEventListener('pointerdown', () => {
      setActiveGame('runner');
    });
    if (action === 'duck') {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        handleRunnerAction('duck');
      });
      button.addEventListener('pointerup', () => {
        stopDuck();
      });
      button.addEventListener('pointerleave', () => {
        stopDuck();
      });
      button.addEventListener('pointercancel', () => {
        stopDuck();
      });
      button.addEventListener('click', (event) => {
        event.preventDefault();
      });
      return;
    }

    button.addEventListener('click', () => {
      handleRunnerAction(action);
    });
  });

  window.addEventListener('keydown', runnerKeyDown);
  window.addEventListener('keyup', runnerKeyUp);

  runnerCanvas.addEventListener('pointerdown', () => {
    setActiveGame('runner');
  });

  const drawRunnerInitial = () => {
    resetRunner();
    drawRunner();
    requestAnimationFrame(loopRunner);
  };

  drawRunnerInitial();
}

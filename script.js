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
  const columnSpacing = 100;
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
const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 800;
const CELL = 20;
const COLS = BOARD_WIDTH / CELL;
const ROWS = BOARD_HEIGHT / CELL;
const SNAKE_STEP_MS = 500;
const ENEMY_STEP_MS = 1000;
const ENEMY_LIFETIME_MS = 10000;
const ENEMY_FIRST_SPAWN_MS = 60000;
const ENEMY_REPEAT_SPAWN_MS = 120000;
const STORAGE_KEY = 'reckless1628_art_snake_high_score';

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

  const randomInt = (limit) => Math.floor(Math.random() * limit);

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

    state.snake.forEach((part, index) => {
      drawCell(part, index === 0 ? '#53ff79' : '#2eb85a', index === 0 ? 2 : 3);
    });

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
      handleAction(button.dataset.action);
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const dir = controls[button.dataset.dir];
      if (dir) {
        changeDirection(dir);
      }
    });
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

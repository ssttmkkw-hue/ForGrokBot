(() => {
  const LOGICAL_W = 480;
  const LOGICAL_H = 640;
  const MAX_LEVEL = 5;
  const LIVES = 3;
  const STEP = 1 / 120;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const overlay = document.getElementById("overlay");
  const eyebrowEl = document.getElementById("eyebrow");
  const titleEl = document.getElementById("title");
  const messageEl = document.getElementById("message");
  const extraEl = document.getElementById("extra");
  const restartBtn = document.getElementById("restart");
  const pauseBtn = document.getElementById("pause");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");

  const ROW_COLORS = ["#ff4d6d", "#ff8a3d", "#ffc857", "#2ec4b6", "#4cc9f0", "#7b6cff", "#f72585"];

  const keys = { left: false, right: false };
  const stars = Array.from({ length: 48 }, () => ({
    x: Math.random() * LOGICAL_W,
    y: Math.random() * LOGICAL_H,
    r: Math.random() * 1.3 + 0.3,
    p: Math.random() * Math.PI * 2,
    s: 0.6 + Math.random() * 1.4,
  }));

  const state = {
    mode: "menu",
    pausedFrom: "playing",
    score: 0,
    lives: LIVES,
    level: 1,
    serveReason: "start",
    control: "pointer",
    pointerX: LOGICAL_W / 2,
    bricks: [],
    particles: [],
  };

  const paddle = { x: 0, y: LOGICAL_H - 32, w: 108, h: 14, speed: 560 };
  const ball = { x: 0, y: 0, r: 8, vx: 0, vy: 0, speed: 0 };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ballSpeed(level) {
    return 320 * (1 + (level - 1) * 0.15);
  }

  function aliveCount() {
    let count = 0;
    for (const brick of state.bricks) if (brick.alive) count += 1;
    return count;
  }

  function buildBricks(level) {
    const rows = 3 + level;
    const cols = 8;
    const gap = 6;
    const side = 18;
    const top = 28;
    const brickH = 22;
    const brickW = (LOGICAL_W - side * 2 - gap * (cols - 1)) / cols;
    const bricks = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (level === 4 && (row + col) % 5 === 0) continue;
        if (level === 5 && row === 2 && (col === 0 || col === cols - 1)) continue;
        bricks.push({
          x: side + col * (brickW + gap),
          y: top + row * (brickH + gap),
          w: brickW,
          h: brickH,
          color: ROW_COLORS[row % ROW_COLORS.length],
          alive: true,
          points: (rows - row) * 10,
        });
      }
    }
    return bricks;
  }

  function resetPaddle() {
    paddle.w = state.level >= 4 ? 92 : 108;
    paddle.x = clamp(state.pointerX - paddle.w / 2, 0, LOGICAL_W - paddle.w);
  }

  function stickBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
    ball.vx = 0;
    ball.vy = 0;
    ball.speed = ballSpeed(state.level);
  }

  function freshGame() {
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.serveReason = "start";
    state.particles = [];
    state.bricks = buildBricks(1);
    resetPaddle();
    stickBall();
  }

  function showOverlay(eyebrow, title, message, extra, withRestart) {
    eyebrowEl.textContent = eyebrow || "";
    titleEl.textContent = title;
    messageEl.textContent = message;
    extraEl.textContent = extra || "";
    restartBtn.hidden = !withRestart;
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    restartBtn.hidden = true;
  }

  function showMenu() {
    state.mode = "menu";
    freshGame();
    showOverlay(
      "休闲小游戏",
      "打砖块",
      "点击或按空格开始",
      "鼠标、触摸或方向键移动挡板 · P 暂停 · 共 5 关",
      false
    );
  }

  function launch() {
    resetPaddle();
    const speed = ballSpeed(state.level);
    const angle = (Math.random() - 0.5) * 0.7;
    ball.speed = speed;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    state.mode = "playing";
    hideOverlay();
  }

  function begin() {
    freshGame();
    launch();
  }

  function loseLife() {
    state.lives -= 1;
    livesEl.classList.remove("hit");
    void livesEl.offsetWidth;
    livesEl.classList.add("hit");
    state.particles = [];
    if (state.lives <= 0) {
      state.mode = "gameover";
      showOverlay(
        "生命已用尽",
        "游戏结束",
        "点击或按空格重新开始",
        `得分 ${state.score} · 到达第 ${state.level} 关`,
        true
      );
      return;
    }
    state.serveReason = "life";
    state.mode = "ready";
    resetPaddle();
    stickBall();
  }

  function advanceLevel() {
    if (state.level >= MAX_LEVEL) {
      state.mode = "win";
      showOverlay(
        "全部通关",
        "恭喜通关",
        "点击或按空格重新开始",
        `得分 ${state.score}`,
        true
      );
      return;
    }
    state.level += 1;
    state.bricks = buildBricks(state.level);
    state.serveReason = "level";
    state.mode = "ready";
    state.particles = [];
    resetPaddle();
    stickBall();
  }

  function togglePause() {
    if (state.mode === "playing" || state.mode === "ready") {
      state.pausedFrom = state.mode;
      state.mode = "paused";
      showOverlay("休息一下", "已暂停", "按 P 或空格继续", "挡板暂时停住", false);
      return;
    }
    if (state.mode === "paused") {
      state.mode = state.pausedFrom;
      hideOverlay();
    }
  }

  function onPrimaryAction() {
    if (state.mode === "menu") begin();
    else if (state.mode === "ready") launch();
    else if (state.mode === "playing" || state.mode === "paused") togglePause();
    else if (state.mode === "gameover" || state.mode === "win") begin();
  }

  function syncPaddle(dt) {
    if (state.control === "keys") {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      paddle.x = clamp(paddle.x + dir * paddle.speed * dt, 0, LOGICAL_W - paddle.w);
      return;
    }
    paddle.x = clamp(state.pointerX - paddle.w / 2, 0, LOGICAL_W - paddle.w);
  }

  function hitsBrick(brick) {
    const nearestX = clamp(ball.x, brick.x, brick.x + brick.w);
    const nearestY = clamp(ball.y, brick.y, brick.y + brick.h);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    return dx * dx + dy * dy <= ball.r * ball.r;
  }

  function bounceBrick(brick, dt) {
    const prevX = ball.x - ball.vx * dt;
    const prevY = ball.y - ball.vy * dt;
    const fromLeft = prevX + ball.r <= brick.x + 0.75;
    const fromRight = prevX - ball.r >= brick.x + brick.w - 0.75;
    const fromTop = prevY + ball.r <= brick.y + 0.75;
    const fromBottom = prevY - ball.r >= brick.y + brick.h - 0.75;

    if (fromLeft) ball.vx = -Math.abs(ball.vx);
    else if (fromRight) ball.vx = Math.abs(ball.vx);
    if (fromTop) ball.vy = -Math.abs(ball.vy);
    else if (fromBottom) ball.vy = Math.abs(ball.vy);

    if (!fromLeft && !fromRight && !fromTop && !fromBottom) {
      const overlapX = Math.min(Math.abs(ball.x - brick.x), Math.abs(ball.x - (brick.x + brick.w)));
      const overlapY = Math.min(Math.abs(ball.y - brick.y), Math.abs(ball.y - (brick.y + brick.h)));
      if (overlapX < overlapY) ball.vx *= -1;
      else ball.vy *= -1;
    }

    let guard = 0;
    while (hitsBrick(brick) && guard < 10) {
      ball.x += ball.vx === 0 ? 0 : -Math.sign(ball.vx) * 0.7;
      ball.y += ball.vy === 0 ? (fromTop ? -0.7 : 0.7) : -Math.sign(ball.vy) * 0.7;
      guard += 1;
    }
    keepVertical();
  }

  function keepVertical() {
    const speed = ball.speed || Math.hypot(ball.vx, ball.vy) || ballSpeed(state.level);
    const minVy = speed * 0.28;
    if (Math.abs(ball.vy) >= minVy) return;
    const direction = ball.vy < 0 ? -1 : 1;
    ball.vy = direction * minVy;
    const signX = ball.vx < 0 ? -1 : 1;
    ball.vx = signX * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
  }

  function bouncePaddle() {
    const center = paddle.x + paddle.w / 2;
    const offset = clamp((ball.x - center) / (paddle.w / 2), -1, 1);
    const angle = offset * (Math.PI / 3);
    const speed = ball.speed || ballSpeed(state.level);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    ball.y = paddle.y - ball.r - 0.5;
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.2,
        age: 0,
        color,
      });
    }
  }

  function update(dt) {
    if (state.mode === "ready" || state.mode === "playing") syncPaddle(dt);

    if (state.mode === "ready") {
      stickBall();
      return;
    }
    if (state.mode !== "playing") return;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r > LOGICAL_W) {
      ball.x = LOGICAL_W - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    const hitsPaddle =
      ball.vy > 0 &&
      ball.y >= paddle.y - ball.r &&
      ball.y <= paddle.y + paddle.h &&
      ball.x + ball.r >= paddle.x &&
      ball.x - ball.r <= paddle.x + paddle.w;
    if (hitsPaddle) bouncePaddle();

    for (const brick of state.bricks) {
      if (!brick.alive || !hitsBrick(brick)) continue;
      brick.alive = false;
      state.score += brick.points;
      spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
      bounceBrick(brick, dt);
      break;
    }

    if (aliveCount() === 0) {
      advanceLevel();
      return;
    }

    if (ball.y - ball.r > LOGICAL_H) loseLife();

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.age >= particle.life) state.particles.splice(i, 1);
    }
  }

  function roundRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    gradient.addColorStop(0, "#172242");
    gradient.addColorStop(1, "#090d18");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    for (const star of stars) {
      const alpha = 0.25 + (Math.sin(time * 0.001 * star.s + star.p) + 1) * 0.28;
      ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBricks() {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      roundRect(brick.x, brick.y, brick.w, brick.h, 5);
      ctx.fillStyle = brick.color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      roundRect(brick.x + 2, brick.y + 2, brick.w - 4, 5, 3);
      ctx.fill();
    }
  }

  function drawPaddle() {
    const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
    gradient.addColorStop(0, "#e9fbff");
    gradient.addColorStop(1, "#6f8dff");
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function drawBall() {
    ctx.save();
    ctx.shadowColor = "rgba(150, 200, 255, 0.9)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f5f8ff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const t = 1 - particle.age / particle.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.4 * t + 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHint() {
    if (state.mode !== "ready") return;
    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 24, 0.55)";
    roundRect(70, LOGICAL_H / 2 - 36, LOGICAL_W - 140, 72, 14);
    ctx.fill();
    ctx.fillStyle = "#f2f6ff";
    ctx.textAlign = "center";
    ctx.font = "600 22px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif";
    const headline = state.serveReason === "level" ? `第 ${state.level} 关 · 球更快了` : "准备发球";
    ctx.fillText(headline, LOGICAL_W / 2, LOGICAL_H / 2 - 4);
    ctx.fillStyle = "#c5d2ef";
    ctx.font = "16px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif";
    ctx.fillText("点击或按空格发球", LOGICAL_W / 2, LOGICAL_H / 2 + 22);
    ctx.restore();
  }

  function drawHud() {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = String(state.level);
    const hearts = livesEl.children;
    for (let i = 0; i < LIVES; i += 1) hearts[i].classList.toggle("gone", i >= state.lives);
    livesEl.setAttribute("aria-label", `生命 ${Math.max(0, state.lives)}`);
    const canPause = state.mode === "playing" || state.mode === "ready" || state.mode === "paused";
    pauseBtn.classList.toggle("shown", canPause);
    pauseBtn.disabled = !canPause;
    pauseBtn.setAttribute("aria-hidden", canPause ? "false" : "true");
    pauseBtn.textContent = state.mode === "paused" ? "继续" : "暂停";
    pauseBtn.setAttribute("aria-label", state.mode === "paused" ? "继续游戏" : "暂停游戏");
  }

  function draw(time) {
    drawBackground(time);
    drawBricks();
    drawPaddle();
    drawParticles();
    drawBall();
    drawHint();
    drawHud();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(canvas.width / LOGICAL_W, 0, 0, canvas.height / LOGICAL_H, 0, 0);
  }

  function takePointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    state.pointerX = clamp(((event.clientX - rect.left) / rect.width) * LOGICAL_W, 0, LOGICAL_W);
    state.control = "pointer";
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (err) {
        // Ignore pointers the browser will not capture.
      }
    }
    takePointer(event);
    if (state.mode === "ready") launch();
  });

  canvas.addEventListener("pointermove", (event) => {
    let captured = false;
    try {
      captured = canvas.hasPointerCapture(event.pointerId);
    } catch (err) {
      captured = false;
    }
    if (event.pointerType === "mouse" || event.buttons > 0 || captured) takePointer(event);
  });

  pauseBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.mode === "playing" || state.mode === "ready" || state.mode === "paused") togglePause();
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  overlay.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    onPrimaryAction();
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      state.control = "keys";
      if (event.code === "ArrowLeft") keys.left = true;
      if (event.code === "ArrowRight") keys.right = true;
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      onPrimaryAction();
      return;
    }
    if (event.code === "KeyP") {
      event.preventDefault();
      if (state.mode === "playing" || state.mode === "ready" || state.mode === "paused") togglePause();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft") keys.left = false;
    if (event.code === "ArrowRight") keys.right = false;
  });

  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
  });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(stage);
  } else {
    window.addEventListener("resize", resize);
  }

  let last = 0;
  let acc = 0;
  function frame(time) {
    if (!last) last = time;
    const dt = Math.min(0.05, (time - last) / 1000);
    last = time;
    acc = Math.min(0.25, acc + dt);
    let stepped = false;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
      stepped = true;
    }
    if (!stepped && (state.mode === "ready" || state.mode === "playing")) syncPaddle(dt);
    resize();
    draw(time);
    requestAnimationFrame(frame);
  }

  window.__game = {
    get score() {
      return state.score;
    },
    get lives() {
      return state.lives;
    },
    get bricksLeft() {
      return aliveCount();
    },
    get running() {
      return state.mode === "playing";
    },
    get level() {
      return state.level;
    },
    get mode() {
      return state.mode;
    },
    get paddleX() {
      return paddle.x;
    },
    get ballX() {
      return ball.x;
    },
    get ballY() {
      return ball.y;
    },
    get ballVX() {
      return ball.vx;
    },
    get ballVY() {
      return ball.vy;
    },
    get ballSpeed() {
      return ball.speed;
    },
    get brickCenters() {
      const centers = [];
      for (const brick of state.bricks) {
        if (brick.alive) centers.push(brick.x + brick.w / 2);
      }
      return centers;
    },
  };

  showMenu();
  resize();
  requestAnimationFrame(frame);
})();

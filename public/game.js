const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();

const menu = document.getElementById("menu");
const callsignInput = document.getElementById("callsign");
const startButton = document.getElementById("startButton");
const hud = document.getElementById("hud");
const healthEl = document.getElementById("health");
const creditsEl = document.getElementById("credits");
const waveEl = document.getElementById("wave");
const killsEl = document.getElementById("kills");
const statusTextEl = document.getElementById("statusText");

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

let localPlayerId = null;
let lastShotAt = 0;
let world = { width: 2400, height: 1400 };
let state = {
  players: [],
  enemies: [],
  bullets: [],
  base: { x: 1200, y: 700, hp: 1000, radius: 130 },
  wave: 1,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isKeyPressed(code) {
  return Boolean(keys[code]);
}

function getLocalPlayer() {
  return state.players.find((player) => player.id === localPlayerId) || null;
}

function updateHud() {
  const me = getLocalPlayer();
  const hp = me?.hp ?? 0;
  const credits = me?.credits ?? 0;
  const kills = me?.kills ?? 0;

  healthEl.textContent = String(Math.max(0, hp));
  creditsEl.textContent = String(Math.max(0, credits));
  waveEl.textContent = String(state.wave || 1);
  killsEl.textContent = String(kills);

  if (!me) {
    statusTextEl.textContent = "Awaiting deployment";
    return;
  }

  if (state.base.hp <= 0) {
    statusTextEl.textContent = "Defense grid lost";
  } else if (me.hp <= 0) {
    statusTextEl.textContent = "Reinforcement in progress";
  } else if (state.enemies.length > 6) {
    statusTextEl.textContent = "Heavy enemy contact";
  } else {
    statusTextEl.textContent = "Hold the Strait";
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawBackground(cameraX, cameraY) {
  ctx.fillStyle = "#071d2a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  ctx.fillStyle = "#0c283f";
  ctx.fillRect(0, 0, world.width, world.height);

  const gridSize = 80;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x < world.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y < world.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#3f7c86";
  ctx.beginPath();
  ctx.moveTo(210, 340);
  ctx.lineTo(350, 230);
  ctx.lineTo(460, 410);
  ctx.lineTo(330, 520);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(1700, 900);
  ctx.lineTo(1880, 810);
  ctx.lineTo(1960, 980);
  ctx.lineTo(1750, 1080);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBase(cameraX, cameraY) {
  const base = state.base;
  const x = base.x - cameraX;
  const y = base.y - cameraY;

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.arc(0, 0, base.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(114, 219, 255, 0.18)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, base.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(160, 236, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#88f4ff";
  ctx.fillRect(-18, -18, 36, 36);

  ctx.restore();
}

function drawBullets(cameraX, cameraY) {
  for (const bullet of state.bullets) {
    const x = bullet.x - cameraX;
    const y = bullet.y - cameraY;
    ctx.fillStyle = "#ffd76e";
    ctx.beginPath();
    ctx.arc(x, y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies(cameraX, cameraY) {
  for (const enemy of state.enemies) {
    const x = enemy.x - cameraX;
    const y = enemy.y - cameraY;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ff5d7d";
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, enemy.radius);
    ctx.lineTo(0, enemy.radius * 0.7);
    ctx.lineTo(-enemy.radius, enemy.radius);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(-enemy.radius, -enemy.radius - 10, enemy.radius * 2, 5);
    ctx.fillStyle = "#7effb2";
    ctx.fillRect(-enemy.radius, -enemy.radius - 10, (enemy.hp / (35 + state.wave * 8)) * enemy.radius * 2, 5);
    ctx.restore();
  }
}

function drawPlayers(cameraX, cameraY) {
  for (const player of state.players) {
    const x = player.x - cameraX;
    const y = player.y - cameraY;

    const isLocal = player.id === localPlayerId;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.angle);

    ctx.fillStyle = isLocal ? "#7de6ff" : "#8ed2ff";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d7f7ff";
    ctx.fillRect(8, -3, 26, 6);

    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "12px sans-serif";
    ctx.fillText(player.name, x - 30, y - 26);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(x - 20, y + 22, 40, 6);
    ctx.fillStyle = "#6df2a7";
    ctx.fillRect(x - 20, y + 22, 40 * (player.hp / 100), 6);
  }
}

function draw() {
  const me = getLocalPlayer();
  if (!me) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#061c2c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const cameraX = clamp(me.x - canvas.width / 2, 0, world.width - canvas.width);
  const cameraY = clamp(me.y - canvas.height / 2, 0, world.height - canvas.height);

  drawBackground(cameraX, cameraY);
  drawBase(cameraX, cameraY);
  drawBullets(cameraX, cameraY);
  drawEnemies(cameraX, cameraY);
  drawPlayers(cameraX, cameraY);
}

function tick() {
  updateHud();
  draw();
  requestAnimationFrame(tick);
}

function sendInput() {
  const me = getLocalPlayer();
  if (!me) return;

  const input = {
    up: isKeyPressed("w") || isKeyPressed("ArrowUp"),
    down: isKeyPressed("s") || isKeyPressed("ArrowDown"),
    left: isKeyPressed("a") || isKeyPressed("ArrowLeft"),
    right: isKeyPressed("d") || isKeyPressed("ArrowRight"),
  };

  let angle = 0;
  const dx = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
  const dy = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);

  if (dx !== 0 || dy !== 0) {
    angle = Math.atan2(dy, dx);
  }

  socket.emit("player-input", { input, angle });
}

function handleShoot() {
  const now = performance.now();
  if (now - lastShotAt < 180) return;
  lastShotAt = now;
  socket.emit("shoot");
}

window.addEventListener("keydown", (event) => {
  if (event.code in keys) {
    keys[event.code] = true;
    event.preventDefault();
  }

  if (event.code === "Space") {
    event.preventDefault();
    handleShoot();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
  }
});

window.addEventListener("resize", resizeCanvas);

startButton.addEventListener("click", () => {
  const name = callsignInput.value.trim() || "Pilot-Alpha";
  socket.emit("join-game", { name });
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
});

socket.on("joined", ({ playerId, world: worldInfo }) => {
  localPlayerId = playerId;
  world = worldInfo;
});

socket.on("state", (nextState) => {
  state = nextState;
  world = nextState.world || world;
});

resizeCanvas();
setInterval(sendInput, 1000 / 30);
requestAnimationFrame(tick);

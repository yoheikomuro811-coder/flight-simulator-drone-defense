const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const WORLD = { width: 2400, height: 1400 };
const PLAYER_SPEED = 220;
const PLAYER_RADIUS = 20;
const BULLET_SPEED = 440;
const BULLET_RADIUS = 4;
const ENEMY_SPEED = 100;
const ENEMY_RADIUS = 18;

const state = {
  players: {},
  enemies: [],
  bullets: [],
  wave: 1,
  startedAt: Date.now(),
  lastSpawn: 0,
  base: {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    hp: 1000,
    radius: 130,
  },
};

const spawnPoints = [
  { x: 240, y: 220 },
  { x: WORLD.width - 240, y: 220 },
  { x: 240, y: WORLD.height - 240 },
  { x: WORLD.width - 240, y: WORLD.height - 240 },
  { x: WORLD.width / 2, y: 220 },
  { x: WORLD.width / 2, y: WORLD.height - 220 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function makePlayer(id, name) {
  const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  return {
    id,
    name: name || `Pilot-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    hp: 100,
    credits: 250,
    kills: 0,
    cooldown: 0,
    input: { up: false, down: false, left: false, right: false },
    alive: true,
  };
}

function getNearestTarget(enemy) {
  const playerEntries = Object.values(state.players).filter((player) => player.alive);
  if (playerEntries.length > 0) {
    let best = playerEntries[0];
    let bestDistance = Infinity;

    for (const player of playerEntries) {
      const d = distance(player, enemy);
      if (d < bestDistance) {
        bestDistance = d;
        best = player;
      }
    }

    return best;
  }

  return state.base;
}

function createEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = -30;
    y = Math.random() * WORLD.height;
  } else if (edge === 1) {
    x = WORLD.width + 30;
    y = Math.random() * WORLD.height;
  } else if (edge === 2) {
    x = Math.random() * WORLD.width;
    y = -30;
  } else {
    x = Math.random() * WORLD.width;
    y = WORLD.height + 30;
  }

  const enemy = {
    id: `enemy-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    x,
    y,
    radius: ENEMY_RADIUS,
    hp: 35 + state.wave * 8,
    speed: ENEMY_SPEED + state.wave * 10,
    damage: 12 + state.wave * 2,
  };

  state.enemies.push(enemy);
}

function spawnEnemyWave() {
  const spawnCount = Math.min(2 + state.wave, 12);
  if (state.enemies.length < spawnCount) {
    createEnemy();
  }
}

function fireBullet(player) {
  if (!player || player.cooldown > 0) return;

  const angle = player.angle;
  const bullet = {
    id: `bullet-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    ownerId: player.id,
    x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 8),
    y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 8),
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    radius: BULLET_RADIUS,
    life: 1.4,
  };

  state.bullets.push(bullet);
  player.cooldown = 0.25;
}

function updatePlayer(player, dt) {
  if (!player.alive) return;

  let moveX = 0;
  let moveY = 0;

  if (player.input.left) moveX -= 1;
  if (player.input.right) moveX += 1;
  if (player.input.up) moveY -= 1;
  if (player.input.down) moveY += 1;

  const magnitude = Math.hypot(moveX, moveY) || 1;
  moveX = (moveX / magnitude) * PLAYER_SPEED;
  moveY = (moveY / magnitude) * PLAYER_SPEED;

  player.x = clamp(player.x + moveX * dt, 35, WORLD.width - 35);
  player.y = clamp(player.y + moveY * dt, 35, WORLD.height - 35);
  player.cooldown = Math.max(0, player.cooldown - dt);
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.x < -20 ||
      bullet.x > WORLD.width + 20 ||
      bullet.y < -20 ||
      bullet.y > WORLD.height + 20 ||
      bullet.life <= 0
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = state.enemies[enemyIndex];
      const impact = distance(bullet, enemy) < bullet.radius + enemy.radius;

      if (impact) {
        enemy.hp -= 30;
        state.bullets.splice(i, 1);

        if (enemy.hp <= 0) {
          const owner = state.players[bullet.ownerId];
          if (owner) {
            owner.credits += 35 + state.wave * 5;
            owner.kills += 1;
            if (owner.kills % 6 === 0) {
              state.wave += 1;
            }
          }
          state.enemies.splice(enemyIndex, 1);
        }
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    let target = getNearestTarget(enemy);
    let dx = target.x - enemy.x;
    let dy = target.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / length) * enemy.speed * dt;
    enemy.y += (dy / length) * enemy.speed * dt;

    if (distance(enemy, state.base) < state.base.radius + enemy.radius) {
      state.base.hp = Math.max(0, state.base.hp - enemy.damage * dt * 2.2);
    }

    for (const player of Object.values(state.players)) {
      if (!player.alive) continue;
      if (distance(player, enemy) < PLAYER_RADIUS + enemy.radius + 2) {
        player.hp = Math.max(0, player.hp - enemy.damage * dt * 2.8);
        if (player.hp <= 0) {
          player.alive = false;
          player.hp = 0;
          player.x = state.base.x + (Math.random() - 0.5) * 100;
          player.y = state.base.y + (Math.random() - 0.5) * 100;
          setTimeout(() => {
            if (state.players[player.id]) {
              state.players[player.id].alive = true;
              state.players[player.id].hp = 100;
              state.players[player.id].x = state.base.x + (Math.random() - 0.5) * 120;
              state.players[player.id].y = state.base.y + (Math.random() - 0.5) * 120;
            }
          }, 1800);
        }
      }
    }
  }
}

function sendState() {
  const payload = {
    world: WORLD,
    players: Object.values(state.players).map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      angle: player.angle,
      hp: player.hp,
      credits: player.credits,
      kills: player.kills,
      alive: player.alive,
    })),
    enemies: state.enemies,
    bullets: state.bullets,
    base: {
      x: state.base.x,
      y: state.base.y,
      hp: state.base.hp,
      radius: state.base.radius,
    },
    wave: state.wave,
    time: Date.now(),
  };

  io.emit("state", payload);
}

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("join-game", ({ name }) => {
    const player = makePlayer(socket.id, name);
    state.players[socket.id] = player;
    socket.emit("joined", { playerId: socket.id, world: WORLD });
    sendState();
  });

  socket.on("player-input", ({ input, angle }) => {
    const player = state.players[socket.id];
    if (!player) return;

    player.input = { ...player.input, ...input };
    player.angle = angle;
  });

  socket.on("shoot", () => {
    const player = state.players[socket.id];
    if (player && player.alive) {
      fireBullet(player);
    }
  });

  socket.on("disconnect", () => {
    delete state.players[socket.id];
    sendState();
  });
});

setInterval(() => {
  const now = Date.now();
  const dt = 1 / 30;

  if (state.base.hp > 0) {
    const totalPlayers = Object.keys(state.players).length;

    if (now - state.lastSpawn > Math.max(1000, 2200 - state.wave * 100) && totalPlayers > 0) {
      state.lastSpawn = now;
      spawnEnemyWave();
    }

    Object.values(state.players).forEach((player) => updatePlayer(player, dt));
    updateBullets(dt);
    updateEnemies(dt);

    if (state.base.hp <= 0) {
      state.base.hp = 0;
      Object.values(state.players).forEach((player) => {
        player.hp = 0;
        player.alive = false;
      });
    }
  }

  sendState();
}, 1000 / 30);

app.get("/health", (_, res) => {
  res.json({ ok: true, players: Object.keys(state.players).length, wave: state.wave });
});

server.listen(PORT, () => {
  console.log(`Drone defense server running at http://localhost:${PORT}`);
});

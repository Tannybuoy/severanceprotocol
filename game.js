const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 32;
const COLS = canvas.width / TILE;
const ROWS = canvas.height / TILE;

const elements = {
  active: document.getElementById('active-character'),
  objective: document.getElementById('objective-status'),
  ability: document.getElementById('ability-help'),
  feed: document.getElementById('outie-feed'),
};

const typeInfo = {
  hallway: { color: '#eef4f5', solid: false },
  cubicle: { color: '#cfdece', solid: true },
  wall: { color: '#9fb0bd', solid: true },
  breakRoom: { color: '#d4ecf8', solid: false },
  artWall: { color: '#f6e1f2', solid: true },
  lockedDoor: { color: '#ba9e56', solid: true },
  openDoor: { color: '#d8c48b', solid: false },
  hidingSpot: { color: '#d5f1d4', solid: false },
};

function createMap() {
  const map = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 'wall'));

  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      map[y][x] = 'hallway';
    }
  }

  for (let x = 2; x < COLS - 2; x += 3) {
    for (let y = 2; y < ROWS - 2; y++) {
      if (y % 4 !== 0) map[y][x] = 'cubicle';
    }
  }

  for (let y = 3; y < ROWS - 3; y += 4) {
    for (let x = 1; x < COLS - 1; x++) {
      if (x % 5 !== 0) map[y][x] = 'wall';
    }
  }

  for (let y = 12; y < 17; y++) {
    for (let x = 1; x < 6; x++) map[y][x] = 'breakRoom';
  }

  for (let y = 1; y < ROWS - 1; y += 5) {
    const x = COLS - 3;
    map[y][x] = 'artWall';
  }

  map[6][14] = 'lockedDoor';
  map[7][14] = 'lockedDoor';

  return map;
}

const game = {
  map: createMap(),
  keys: {},
  hiddenCodes: [
    { x: 7, y: 10, value: '7301', found: false },
    { x: 21, y: 14, value: '9455', found: false },
  ],
  paintings: [
    { x: COLS - 3, y: 6, clue: 'The file rests where coffee sleeps.', solved: false },
    { x: COLS - 3, y: 16, clue: 'Door code equals largest hidden number.', solved: false },
  ],
  traps: [],
  fileItem: { x: 3, y: 14, collected: false },
  roomUnlocked: false,
  artworkDecoded: false,
  outieTimer: 0,
  messages: [],
  milchickDistractedUntil: 0,
  speedBoostUntil: 0,
};

const characters = [
  {
    name: 'Data Refiner',
    color: '#4f7dda',
    ability: 'Reveal hidden numbers and secret codes nearby.',
    x: 2,
    y: 2,
    active: true,
    removedUntil: 0,
    speed: 4,
  },
  {
    name: 'Prankster',
    color: '#db8a4a',
    ability: 'Place a floor trap that makes Milchick slip.',
    x: 3,
    y: 2,
    active: false,
    removedUntil: 0,
    speed: 4,
  },
  {
    name: 'Artist',
    color: '#9f61cc',
    ability: 'Inspect paintings to reveal clues or secret doors.',
    x: 2,
    y: 3,
    active: false,
    removedUntil: 0,
    speed: 4,
  },
  {
    name: 'Rule Follower',
    color: '#5aa86a',
    ability: 'Recite policy and distract Milchick briefly.',
    x: 3,
    y: 3,
    active: false,
    removedUntil: 0,
    speed: 4,
  },
];

let activeIndex = 0;

const milchick = {
  x: COLS - 6,
  y: ROWS - 4,
  color: '#d53030',
  speed: 2.2,
  slipUntil: 0,
  targetIndex: null,
  patrolNodes: [
    { x: COLS - 6, y: ROWS - 4 },
    { x: COLS - 6, y: 2 },
    { x: 10, y: 2 },
    { x: 10, y: ROWS - 4 },
  ],
  patrolCursor: 0,
};

function logMessage(msg) {
  const text = `${new Date().toLocaleTimeString()} — ${msg}`;
  game.messages.unshift(text);
  game.messages = game.messages.slice(0, 8);
  elements.feed.innerHTML = game.messages.map((m) => `<div>${m}</div>`).join('');
}

function isSolid(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return typeInfo[game.map[y][x]]?.solid ?? true;
}

function setActiveCharacter(index) {
  if (characters[index].removedUntil > performance.now()) return;
  characters.forEach((ch, i) => {
    ch.active = i === index;
  });
  activeIndex = index;
  elements.active.textContent = characters[index].name;
  elements.ability.textContent = `Press Space to ${characters[index].ability.toLowerCase()}`;
}

function moveCharacter(ch, dt) {
  const step = (ch.speed * dt) / 200;
  let dx = 0;
  let dy = 0;

  if (game.keys.ArrowLeft) dx = -step;
  if (game.keys.ArrowRight) dx = step;
  if (game.keys.ArrowUp) dy = -step;
  if (game.keys.ArrowDown) dy = step;

  tryMove(ch, dx, dy);
}

function tryMove(entity, dx, dy) {
  const nx = entity.x + dx;
  const ny = entity.y + dy;
  if (!isSolid(Math.floor(nx), Math.floor(entity.y))) entity.x = nx;
  if (!isSolid(Math.floor(entity.x), Math.floor(ny))) entity.y = ny;
}

function useAbility() {
  const now = performance.now();
  const actor = characters[activeIndex];
  if (actor.removedUntil > now) return;

  if (actor.name === 'Data Refiner') {
    let discoveries = 0;
    game.hiddenCodes.forEach((code) => {
      if (!code.found && Math.hypot(actor.x - code.x, actor.y - code.y) < 4) {
        code.found = true;
        discoveries += 1;
        logMessage(`Data Refiner exposed hidden code ${code.value}.`);
      }
    });
    if (!discoveries) logMessage('Data Refiner found only suspiciously normal spreadsheets.');
  } else if (actor.name === 'Prankster') {
    game.traps.push({ x: Math.floor(actor.x), y: Math.floor(actor.y), expires: now + 12000 });
    logMessage('Prankster placed a banana-peel-level compliance hazard.');
  } else if (actor.name === 'Artist') {
    const nearPainting = game.paintings.find(
      (p) => Math.hypot(actor.x - p.x, actor.y - p.y) < 2.2 && !p.solved,
    );
    if (nearPainting) {
      nearPainting.solved = true;
      logMessage(`Artist decoded painting clue: "${nearPainting.clue}"`);
      if (nearPainting.clue.includes('largest hidden number')) game.artworkDecoded = true;
    } else {
      logMessage('Artist adjusted wall lighting. No clue appeared.');
    }
  } else if (actor.name === 'Rule Follower') {
    game.milchickDistractedUntil = now + 5000;
    logMessage('Rule Follower cited handbook section 14: Milchick is politely distracted.');
  }
}

function getLineOfSight(a, b) {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(a.x + (b.x - a.x) * t);
    const y = Math.floor(a.y + (b.y - a.y) * t);
    if (isSolid(x, y)) return false;
  }
  return true;
}

function findClosestVisibleCharacter() {
  let best = null;
  let bestDist = Infinity;
  characters.forEach((ch, index) => {
    if (ch.removedUntil > performance.now()) return;
    const d = Math.hypot(ch.x - milchick.x, ch.y - milchick.y);
    if (d < 8 && d < bestDist && getLineOfSight(milchick, ch)) {
      best = index;
      bestDist = d;
    }
  });
  return best;
}

function stepToward(entity, targetX, targetY, speed, dt) {
  const angle = Math.atan2(targetY - entity.y, targetX - entity.x);
  const amount = (speed * dt) / 220;
  tryMove(entity, Math.cos(angle) * amount, Math.sin(angle) * amount);
}

function updateMilchick(dt, now) {
  if (now < milchick.slipUntil || now < game.milchickDistractedUntil) return;

  const spotted = findClosestVisibleCharacter();
  if (spotted !== null) milchick.targetIndex = spotted;

  const patrolSpeed = now < game.speedBoostUntil ? milchick.speed * 1.55 : milchick.speed;

  if (milchick.targetIndex !== null) {
    const target = characters[milchick.targetIndex];
    if (target.removedUntil > now) {
      milchick.targetIndex = null;
    } else {
      stepToward(milchick, target.x, target.y, patrolSpeed + 0.9, dt);
      if (Math.hypot(target.x - milchick.x, target.y - milchick.y) < 0.8) {
        target.removedUntil = now + 9000;
        logMessage(`Milchick caught ${target.name}. They are sent to the break room for reflection.`);
        if (target.active) {
          const replacement = characters.findIndex((ch) => ch.removedUntil <= now);
          if (replacement >= 0) setActiveCharacter(replacement);
        }
        milchick.targetIndex = null;
      }
      return;
    }
  }

  const node = milchick.patrolNodes[milchick.patrolCursor];
  stepToward(milchick, node.x, node.y, patrolSpeed, dt);
  if (Math.hypot(node.x - milchick.x, node.y - milchick.y) < 0.6) {
    milchick.patrolCursor = (milchick.patrolCursor + 1) % milchick.patrolNodes.length;
  }
}

function updateObjectives(now) {
  const active = characters[activeIndex];

  if (!game.fileItem.collected && Math.hypot(active.x - game.fileItem.x, active.y - game.fileItem.y) < 1) {
    game.fileItem.collected = true;
    logMessage('Objective complete: confidential file retrieved from sleepy break room copier.');
  }

  if (!game.roomUnlocked && game.artworkDecoded) {
    const largestCode = Math.max(...game.hiddenCodes.filter((c) => c.found).map((c) => Number(c.value)), 0);
    if (largestCode >= 9000) {
      game.roomUnlocked = true;
      game.map[6][14] = 'openDoor';
      game.map[7][14] = 'openDoor';
      logMessage('Locked room unlocked using the decoded artwork number sequence.');
    }
  }

  const done = [game.fileItem.collected, game.roomUnlocked, game.artworkDecoded].filter(Boolean).length;
  elements.objective.textContent = `${done}/3 missions complete — Retrieve file, unlock room, decode artwork.`;

  characters.forEach((ch) => {
    if (ch.removedUntil <= now && ch.removedUntil !== 0) ch.removedUntil = 0;
  });

  game.traps = game.traps.filter((t) => t.expires > now);
  const trap = game.traps.find((t) => Math.hypot(t.x - milchick.x, t.y - milchick.y) < 0.6);
  if (trap) {
    milchick.slipUntil = now + 2500;
    logMessage('Milchick hit a prank trap and slid across polished compliance flooring.');
    trap.expires = 0;
  }
}

function triggerOutieEvent(now) {
  const events = [
    () => {
      game.speedBoostUntil = now + 12000;
      logMessage('Outie Event: Milchick had extra coffee. Patrol speed increased!');
    },
    () => {
      const x = 4 + Math.floor(Math.random() * (COLS - 8));
      const y = 4 + Math.floor(Math.random() * (ROWS - 8));
      if (!isSolid(x, y)) {
        game.hiddenCodes.push({ x, y, value: String(1000 + Math.floor(Math.random() * 8999)), found: false });
        logMessage('Outie Event: A random memo spawned with suspicious numbers.');
      }
    },
    () => {
      game.paintings.forEach((p) => {
        p.solved = false;
        p.clue = Math.random() > 0.5 ? 'Art update: Look near the break room ferns.' : 'Art update: Door dreams in numeric poetry.';
      });
      logMessage('Outie Event: The artwork rotated. Clues have changed.');
    },
    () => {
      const x = 5 + Math.floor(Math.random() * (COLS - 10));
      const y = 5 + Math.floor(Math.random() * (ROWS - 10));
      if (!isSolid(x, y)) {
        game.map[y][x] = 'hidingSpot';
        logMessage('Outie Event: A new hiding spot appeared behind fake ficus plants.');
      }
    },
    () => {
      for (let i = 0; i < 5; i++) {
        const x = 2 + Math.floor(Math.random() * (COLS - 4));
        const y = 2 + Math.floor(Math.random() * (ROWS - 4));
        if (game.map[y][x] === 'hallway') game.map[y][x] = Math.random() > 0.5 ? 'cubicle' : 'hallway';
      }
      logMessage('Outie Event: Furniture was rearranged by anonymous ergonomic zealots.');
    },
  ];

  events[Math.floor(Math.random() * events.length)]();
}

function drawMap() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = game.map[y][x];
      ctx.fillStyle = typeInfo[tile]?.color ?? '#ccc';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);

      if (tile === 'artWall') {
        ctx.fillStyle = '#915a9d';
        ctx.fillRect(x * TILE + 8, y * TILE + 8, 16, 16);
      }
      if (tile === 'lockedDoor') {
        ctx.fillStyle = '#6f5125';
        ctx.fillRect(x * TILE + 10, y * TILE + 10, 12, 12);
      }
      if (tile === 'hidingSpot') {
        ctx.fillStyle = '#5fa072';
        ctx.beginPath();
        ctx.arc(x * TILE + 16, y * TILE + 16, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawCharacter(ch) {
  const now = performance.now();
  if (ch.removedUntil > now) return;
  ctx.fillStyle = ch.color;
  ctx.beginPath();
  ctx.arc(ch.x * TILE + TILE / 2, ch.y * TILE + TILE / 2, 10, 0, Math.PI * 2);
  ctx.fill();

  if (ch.active) {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.strokeRect(ch.x * TILE + 4, ch.y * TILE + 4, TILE - 8, TILE - 8);
  }
}

function drawObjects() {
  if (!game.fileItem.collected) {
    ctx.fillStyle = '#f2d95c';
    ctx.fillRect(game.fileItem.x * TILE + 9, game.fileItem.y * TILE + 9, 14, 14);
  }

  game.hiddenCodes.forEach((c) => {
    if (!c.found) return;
    ctx.fillStyle = '#1a3c6b';
    ctx.font = '12px monospace';
    ctx.fillText(c.value, c.x * TILE + 2, c.y * TILE + 18);
  });

  game.traps.forEach((t) => {
    ctx.fillStyle = '#f09d42';
    ctx.beginPath();
    ctx.moveTo(t.x * TILE + 16, t.y * TILE + 8);
    ctx.lineTo(t.x * TILE + 24, t.y * TILE + 24);
    ctx.lineTo(t.x * TILE + 8, t.y * TILE + 24);
    ctx.closePath();
    ctx.fill();
  });
}

function drawMilchick(now) {
  const pulse = now < milchick.slipUntil ? 7 : 10;
  ctx.fillStyle = milchick.color;
  ctx.beginPath();
  ctx.arc(milchick.x * TILE + TILE / 2, milchick.y * TILE + TILE / 2, pulse, 0, Math.PI * 2);
  ctx.fill();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(40, now - lastTime);
  lastTime = now;

  moveCharacter(characters[activeIndex], dt);
  updateMilchick(dt, now);
  updateObjectives(now);

  game.outieTimer += dt;
  if (game.outieTimer >= 30000) {
    game.outieTimer = 0;
    triggerOutieEvent(now);
  }

  drawMap();
  drawObjects();
  characters.forEach(drawCharacter);
  drawMilchick(now);

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) e.preventDefault();
  game.keys[e.key] = true;

  if (['1', '2', '3', '4'].includes(e.key)) {
    setActiveCharacter(Number(e.key) - 1);
  }
  if (e.key === ' ') {
    e.preventDefault();
    useAbility();
  }
});

window.addEventListener('keyup', (e) => {
  game.keys[e.key] = false;
});

setActiveCharacter(0);
logMessage('Welcome to Severance Protocol. Please enjoy mandatory fun responsibly.');
requestAnimationFrame(loop);

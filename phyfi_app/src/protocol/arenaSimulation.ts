/**
 * Pure Deterministic 2D Arena Simulation Engine with strict X and Y boundaries,
 * obstacle collisions, energy beacons, dash cooldowns, and eventual edge sync.
 */

import {
  INTENT_UP,
  INTENT_DOWN,
  INTENT_LEFT,
  INTENT_RIGHT,
  INTENT_DASH,
  INTENT_PULSE,
} from './phyfiProtocol';

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 540;
export const PLAYER_RADIUS = 18;
export const BASE_SPEED = 240; // px per second
export const DASH_SPEED = 560; // px per second
export const DASH_DURATION = 0.16; // seconds
export const DASH_COOLDOWN = 1.1; // seconds
export const PULSE_RADIUS = 110;
export const PULSE_COOLDOWN = 1.5;

export interface ObstacleRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface DataNodeOrb {
  id: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  respawnTimer: number;
  value: number;
}

export interface PlayerEntity {
  id: 1 | 2;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number;
  intent: number;
  lastTick: number;
  lastUpdatedMs: number;
  dashTimer: number;
  dashCooldownTimer: number;
  pulseTimer: number;
  pulseCooldownTimer: number;
  score: number;
  packetsSent: number;
  packetsReceived: number;
  isCollidingBoundary: boolean;
  isCollidingObstacle: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface ArenaGameState {
  tick: number;
  elapsedSeconds: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  obstacles: ObstacleRect[];
  orbs: DataNodeOrb[];
  players: {
    1: PlayerEntity;
    2: PlayerEntity;
  };
  syncEvents: Array<{
    tick: number;
    actorId: number;
    message: string;
  }>;
}

export const DEFAULT_OBSTACLES: ObstacleRect[] = [
  { id: 'relay-nw', x: 210, y: 120, width: 90, height: 90, label: 'NODE-A1' },
  { id: 'relay-ne', x: 660, y: 120, width: 90, height: 90, label: 'NODE-B2' },
  { id: 'core-center', x: 435, y: 225, width: 90, height: 90, label: 'ACOUSTIC-CORE' },
  { id: 'relay-sw', x: 210, y: 330, width: 90, height: 90, label: 'NODE-C3' },
  { id: 'relay-se', x: 660, y: 330, width: 90, height: 90, label: 'NODE-D4' },
];

export function createInitialArenaState(): ArenaGameState {
  return {
    tick: 0,
    elapsedSeconds: 0,
    bounds: {
      minX: PLAYER_RADIUS + 8,
      maxX: ARENA_WIDTH - PLAYER_RADIUS - 8,
      minY: PLAYER_RADIUS + 8,
      maxY: ARENA_HEIGHT - PLAYER_RADIUS - 8,
    },
    obstacles: DEFAULT_OBSTACLES,
    orbs: [
      { id: 1, x: 120, y: 270, radius: 10, active: true, respawnTimer: 0, value: 10 },
      { id: 2, x: 480, y: 95,  radius: 10, active: true, respawnTimer: 0, value: 15 },
      { id: 3, x: 840, y: 270, radius: 10, active: true, respawnTimer: 0, value: 10 },
      { id: 4, x: 480, y: 445, radius: 10, active: true, respawnTimer: 0, value: 15 },
      { id: 5, x: 345, y: 185, radius: 9,  active: true, respawnTimer: 0, value: 10 },
      { id: 6, x: 615, y: 355, radius: 9,  active: true, respawnTimer: 0, value: 10 },
    ],
    players: {
      1: {
        id: 1,
        name: 'JOGADOR 1 (HOST)',
        x: 110,
        y: 110,
        vx: 0,
        vy: 0,
        facingAngle: 0,
        intent: 0,
        lastTick: 0,
        lastUpdatedMs: 0,
        dashTimer: 0,
        dashCooldownTimer: 0,
        pulseTimer: 0,
        pulseCooldownTimer: 0,
        score: 0,
        packetsSent: 0,
        packetsReceived: 0,
        isCollidingBoundary: false,
        isCollidingObstacle: false,
        trail: [],
      },
      2: {
        id: 2,
        name: 'JOGADOR 2 (CLIENT)',
        x: 850,
        y: 430,
        vx: 0,
        vy: 0,
        facingAngle: Math.PI,
        intent: 0,
        lastTick: 0,
        lastUpdatedMs: 0,
        dashTimer: 0,
        dashCooldownTimer: 0,
        pulseTimer: 0,
        pulseCooldownTimer: 0,
        score: 0,
        packetsSent: 0,
        packetsReceived: 0,
        isCollidingBoundary: false,
        isCollidingObstacle: false,
        trail: [],
      },
    },
    syncEvents: [],
  };
}

/**
 * Applies a 16-bit Phy-Fi / Kine-Fi input intent to a specific player in the arena.
 */
export function applyPlayerIntent(
  state: ArenaGameState,
  playerId: 1 | 2,
  intent: number,
  packetTimestamp: number,
  nowMs: number = Date.now()
): void {
  const player = state.players[playerId];
  if (!player) return;

  player.intent = intent & 0xff;
  player.lastTick = packetTimestamp & 0x0f;
  player.lastUpdatedMs = nowMs;
  player.packetsReceived += 1;

  if ((intent & INTENT_DASH) !== 0 && player.dashCooldownTimer <= 0 && player.dashTimer <= 0) {
    player.dashTimer = DASH_DURATION;
    player.dashCooldownTimer = DASH_COOLDOWN;
  }

  if ((intent & INTENT_PULSE) !== 0 && player.pulseCooldownTimer <= 0) {
    player.pulseTimer = 0.35;
    player.pulseCooldownTimer = PULSE_COOLDOWN;
  }
}

/**
 * Resolves circle vs Axis-Aligned Bounding Box (AABB) collision and pushes the player out.
 */
export function resolveCircleRectCollision(
  px: number,
  py: number,
  radius: number,
  rect: ObstacleRect
): { x: number; y: number; collided: boolean } {
  const closestX = Math.max(rect.x, Math.min(px, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(py, rect.y + rect.height));

  const dx = px - closestX;
  const dy = py - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { x: px, y: py, collided: false };
  }

  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    // Center is inside rectangle: push out to nearest edge
    const leftPen = px - rect.x;
    const rightPen = rect.x + rect.width - px;
    const topPen = py - rect.y;
    const bottomPen = rect.y + rect.height - py;
    const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
    if (minPen === leftPen) return { x: rect.x - radius, y: py, collided: true };
    if (minPen === rightPen) return { x: rect.x + rect.width + radius, y: py, collided: true };
    if (minPen === topPen) return { x: px, y: rect.y - radius, collided: true };
    return { x: px, y: rect.y + rect.height + radius, collided: true };
  }

  const overlap = radius - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: px + nx * overlap,
    y: py + ny * overlap,
    collided: true,
  };
}

/**
 * Steps the deterministic simulation forward by `rawDt` seconds (clamped to <= 0.05s).
 */
export function stepArenaSimulation(state: ArenaGameState, rawDt: number): ArenaGameState {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
  state.tick += 1;
  state.elapsedSeconds += dt;

  const playerIds: Array<1 | 2> = [1, 2];

  for (const pid of playerIds) {
    const p = state.players[pid];

    if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
    if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
    if (p.pulseTimer > 0) p.pulseTimer = Math.max(0, p.pulseTimer - dt);
    if (p.pulseCooldownTimer > 0) p.pulseCooldownTimer = Math.max(0, p.pulseCooldownTimer - dt);

    let dirX = 0;
    let dirY = 0;

    if (p.intent & INTENT_UP) dirY -= 1;
    if (p.intent & INTENT_DOWN) dirY += 1;
    if (p.intent & INTENT_LEFT) dirX -= 1;
    if (p.intent & INTENT_RIGHT) dirX += 1;

    if (dirX !== 0 || dirY !== 0) {
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
      p.facingAngle = Math.atan2(dirY, dirX);
    }

    const activeSpeed = p.dashTimer > 0 ? DASH_SPEED : BASE_SPEED;
    p.vx = dirX * activeSpeed;
    p.vy = dirY * activeSpeed;

    let nextX = p.x + p.vx * dt;
    let nextY = p.y + p.vy * dt;

    // Strict X and Y Map Boundary Clamping
    let hitBound = false;
    if (nextX < state.bounds.minX) {
      nextX = state.bounds.minX;
      hitBound = true;
    } else if (nextX > state.bounds.maxX) {
      nextX = state.bounds.maxX;
      hitBound = true;
    }

    if (nextY < state.bounds.minY) {
      nextY = state.bounds.minY;
      hitBound = true;
    } else if (nextY > state.bounds.maxY) {
      nextY = state.bounds.maxY;
      hitBound = true;
    }
    p.isCollidingBoundary = hitBound;

    // Obstacle Collisions
    let hitObstacle = false;
    for (const obs of state.obstacles) {
      const res = resolveCircleRectCollision(nextX, nextY, PLAYER_RADIUS, obs);
      if (res.collided) {
        nextX = res.x;
        nextY = res.y;
        hitObstacle = true;
      }
    }
    p.isCollidingObstacle = hitObstacle;

    p.x = Math.round(nextX * 100) / 100;
    p.y = Math.round(nextY * 100) / 100;

    if (state.tick % 2 === 0 && (Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1)) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 14) {
        p.trail.shift();
      }
    }

    // Collect Data Node Orbs
    for (const orb of state.orbs) {
      if (!orb.active) continue;
      const dist = Math.hypot(p.x - orb.x, p.y - orb.y);
      const collectRadius = p.pulseTimer > 0 ? PULSE_RADIUS : PLAYER_RADIUS + orb.radius;
      if (dist <= collectRadius) {
        orb.active = false;
        orb.respawnTimer = 4.0;
        p.score += orb.value;
      }
    }
  }

  // Update orb respawn timers
  for (const orb of state.orbs) {
    if (!orb.active) {
      orb.respawnTimer -= dt;
      if (orb.respawnTimer <= 0) {
        orb.active = true;
        orb.respawnTimer = 0;
      }
    }
  }

  // Pulse wave interaction between Player 1 and Player 2
  const p1 = state.players[1];
  const p2 = state.players[2];
  const distBetween = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  if (distBetween > 0 && distBetween < PLAYER_RADIUS * 2) {
    // Gentle elastic separation while preserving Ghost Eventual Consistency
    const overlap = (PLAYER_RADIUS * 2 - distBetween) * 0.5;
    const nx = (p2.x - p1.x) / distBetween;
    const ny = (p2.y - p1.y) / distBetween;
    p1.x = Math.max(state.bounds.minX, Math.min(state.bounds.maxX, p1.x - nx * overlap));
    p1.y = Math.max(state.bounds.minY, Math.min(state.bounds.maxY, p1.y - ny * overlap));
    p2.x = Math.max(state.bounds.minX, Math.min(state.bounds.maxX, p2.x + nx * overlap));
    p2.y = Math.max(state.bounds.minY, Math.min(state.bounds.maxY, p2.y + ny * overlap));
  }

  return state;
}

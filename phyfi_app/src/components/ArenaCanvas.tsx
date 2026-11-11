import React, { useEffect, useRef } from 'react';
import {
  ArenaGameState,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_RADIUS,
  PULSE_RADIUS,
} from '../protocol/arenaSimulation';
import { decodeIntentToKeys } from '../protocol/phyfiProtocol';

interface ArenaCanvasProps {
  gameStateRef: React.MutableRefObject<ArenaGameState>;
  localPlayerSlot: 1 | 2;
  dualTestMode: boolean;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  gameStateRef,
  localPlayerSlot,
  dualTestMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const renderFrame = () => {
      const state = gameStateRef.current;
      ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // 1. Deep Obsidian Telemetry Background
      ctx.fillStyle = '#07090E';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // 2. Coordinate Grid (60px steps)
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= ARENA_WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= ARENA_HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_WIDTH, y);
        ctx.stroke();
      }

      // 3. Strict X and Y Map Boundary Perimeter Frame
      const b = state.bounds;
      const wallLeft = b.minX - PLAYER_RADIUS;
      const wallTop = b.minY - PLAYER_RADIUS;
      const wallWidth = b.maxX - b.minX + PLAYER_RADIUS * 2;
      const wallHeight = b.maxY - b.minY + PLAYER_RADIUS * 2;

      const anyBoundaryHit =
        state.players[1].isCollidingBoundary || state.players[2].isCollidingBoundary;

      ctx.strokeStyle = anyBoundaryHit ? '#F59E0B' : '#06B6D4';
      ctx.lineWidth = 2;
      ctx.strokeRect(wallLeft, wallTop, wallWidth, wallHeight);

      // Corner Axis Calibration Labels
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`ORIGIN (X:${b.minX}, Y:${b.minY})`, wallLeft + 8, wallTop + 14);
      ctx.fillText(
        `BOUND MAX (X:${b.maxX}, Y:${b.maxY})`,
        wallLeft + wallWidth - 175,
        wallTop + wallHeight - 8
      );

      // 4. Obstacles (Acoustic Nodes)
      for (const obs of state.obstacles) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Diagonal technical hatch line
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(obs.label, obs.x + obs.width / 2, obs.y + obs.height / 2 + 3);
        ctx.textAlign = 'left';
      }

      // 5. Collectible Data Node Orbs
      for (const orb of state.orbs) {
        if (!orb.active) {
          // Respawning ring
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }

        const pulseRadius = orb.radius + Math.sin(state.elapsedSeconds * 5 + orb.id) * 2.2;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, pulseRadius + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#07090E';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`+${orb.value}`, orb.x, orb.y + 3);
        ctx.textAlign = 'left';
      }

      // 6. Players (Player 1 Cyan Host, Player 2 Amber Client)
      const drawPlayer = (pid: 1 | 2) => {
        const p = state.players[pid];
        const primaryColor = pid === 1 ? '#06B6D4' : '#F59E0B';
        const glowFill = pid === 1 ? 'rgba(6, 182, 212, 0.18)' : 'rgba(245, 158, 11, 0.18)';
        const isLocal = pid === localPlayerSlot || dualTestMode;

        // Motion trail
        for (let i = 0; i < p.trail.length; i++) {
          const pt = p.trail[i];
          const alpha = ((i + 1) / p.trail.length) * 0.28;
          ctx.fillStyle =
            pid === 1
              ? `rgba(6, 182, 212, ${alpha})`
              : `rgba(245, 158, 11, ${alpha})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, PLAYER_RADIUS * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }

        // Acoustic Pulse Wave (E key)
        if (p.pulseTimer > 0) {
          const progress = 1 - p.pulseTimer / 0.35;
          const r = PLAYER_RADIUS + progress * (PULSE_RADIUS - PLAYER_RADIUS);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Outer Halo
        ctx.fillStyle = glowFill;
        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          p.dashTimer > 0 ? PLAYER_RADIUS + 8 : PLAYER_RADIUS + 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Main Player Body
        ctx.fillStyle = '#0B0E17';
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = isLocal ? 3 : 2;
        ctx.stroke();

        // Direction Vector Nose
        const noseX = p.x + Math.cos(p.facingAngle) * (PLAYER_RADIUS + 6);
        const noseY = p.y + Math.sin(p.facingAngle) * (PLAYER_RADIUS + 6);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(noseX, noseY);
        ctx.stroke();

        // Center Actor ID Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`J${pid}`, p.x, p.y + 4);

        // Live Coordinate & Intent Readout Above Player
        const activeKeys = decodeIntentToKeys(p.intent).join('+') || 'IDLE';
        ctx.fillStyle = primaryColor;
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillText(
          `J${pid} [${Math.round(p.x)},${Math.round(p.y)}] · ${activeKeys}`,
          p.x,
          p.y - PLAYER_RADIUS - 10
        );
        ctx.textAlign = 'left';
      };

      drawPlayer(1);
      drawPlayer(2);

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [gameStateRef, localPlayerSlot, dualTestMode]);

  return (
    <div className="relative flex flex-1 min-h-0 w-full items-center justify-center overflow-hidden border border-slate-800 bg-[#07090E] p-2">
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        data-testid="phyfi-arena-canvas"
        className="block max-h-full max-w-full w-auto h-auto aspect-[16/9] cursor-crosshair"
      />
    </div>
  );
};

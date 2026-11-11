import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const PORT = 3000;

interface RoomClient {
  ws: WebSocket;
  clientId: number;
  role: 'host' | 'client' | 'router' | 'game';
  playerSlot: 1 | 2;
  joinedAt: number;
}

interface RoomState {
  pin: string;
  clients: Map<WebSocket, RoomClient>;
  nextClientId: number;
  lastActivity: number;
}

const rooms = new Map<string, RoomState>();

function broadcastToRoom(room: RoomState, sender: WebSocket | null, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  for (const [clientWs] of room.clients.entries()) {
    if (clientWs !== sender && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(raw);
    }
  }
}

function getRoomSummary(room: RoomState) {
  const members: Array<{ clientId: number; role: string; playerSlot: number }> = [];
  for (const info of room.clients.values()) {
    members.push({
      clientId: info.clientId,
      role: info.role,
      playerSlot: info.playerSlot,
    });
  }
  return {
    pin: room.pin,
    memberCount: members.length,
    members,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);

  // Health & signaling rooms API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      protocol: 'Phy-Fi 16-Bit So-Fi / Kine-Fi / WebRTC Signaler',
    });
  });

  app.get('/api/rooms/:pin', (req, res) => {
    const pin = req.params.pin;
    const room = rooms.get(pin);
    if (!room) {
      res.json({ pin, active: false, memberCount: 0, members: [] });
      return;
    }
    res.json({
      ...getRoomSummary(room),
      active: true,
    });
  });

  // WebSocket Signaling & Relay Server on /ws-signaler
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    if (pathname === '/ws-signaler') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentPin: string | null = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const roomPin = String(msg.room || '').trim();
        if (!roomPin) return;

        let room = rooms.get(roomPin);
        if (!room) {
          room = {
            pin: roomPin,
            clients: new Map(),
            nextClientId: 1,
            lastActivity: Date.now(),
          };
          rooms.set(roomPin, room);
        }
        room.lastActivity = Date.now();

        if (msg.type === 'join') {
          currentPin = roomPin;
          const existing = room.clients.get(ws);
          const clientId = existing ? existing.clientId : room.nextClientId++;
          const role = msg.role || (msg.isHost ? 'host' : 'client');
          const playerSlot: 1 | 2 = msg.playerSlot === 2 ? 2 : 1;

          room.clients.set(ws, {
            ws,
            clientId,
            role,
            playerSlot,
            joinedAt: Date.now(),
          });

          // Acknowledge to the joining peer
          ws.send(
            JSON.stringify({
              type: 'joined_ack',
              room: roomPin,
              clientId,
              role,
              playerSlot,
              summary: getRoomSummary(room),
            })
          );

          // Notify other peers in the room
          broadcastToRoom(room, ws, {
            ...msg,
            type: 'peer_joined',
            room: roomPin,
            clientId,
            role,
            playerSlot,
            summary: getRoomSummary(room),
          });
          return;
        }

        if (msg.type === 'leave' || msg.type === 'shutdown_room') {
          if (msg.type === 'shutdown_room') {
            broadcastToRoom(room, ws, {
              type: 'room_terminated',
              room: roomPin,
              reason: msg.reason || 'Encerramento automático de sessão Phy-Fi.',
            });
          }
          room.clients.delete(ws);
          if (room.clients.size === 0) {
            rooms.delete(roomPin);
          } else {
            broadcastToRoom(room, null, {
              type: 'peer_left',
              room: roomPin,
              summary: getRoomSummary(room),
            });
          }
          return;
        }

        // Relay WebRTC SDP (offer/answer/candidate) and Phy-Fi 16-bit binary/hex packets
        broadcastToRoom(room, ws, {
          ...msg,
          room: roomPin,
        });
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      if (currentPin && rooms.has(currentPin)) {
        const room = rooms.get(currentPin)!;
        const departing = room.clients.get(ws);
        room.clients.delete(ws);

        if (room.clients.size === 0) {
          rooms.delete(currentPin);
        } else {
          broadcastToRoom(room, null, {
            type: 'peer_left',
            room: currentPin,
            clientId: departing?.clientId ?? -1,
            playerSlot: departing?.playerSlot ?? 1,
            summary: getRoomSummary(room),
          });
        }
      }
    });
  });

  // Periodic cleanup of stale rooms (>30 min inactive)
  setInterval(() => {
    const now = Date.now();
    for (const [pin, room] of rooms.entries()) {
      if (room.clients.size === 0 || now - room.lastActivity > 30 * 60 * 1000) {
        rooms.delete(pin);
      }
    }
  }, 60_000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Phy-Fi Server & WebRTC Signaler] Rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();

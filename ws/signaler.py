import asyncio
import json
import os
import websockets

rooms = {}

async def handler(websocket):
    room_id = None
    try:
        async for message in websocket:
            data = json.loads(message)
            room_id = data.get("room")
            if not room_id:
                continue

            if room_id not in rooms:
                rooms[room_id] = set()
            rooms[room_id].add(websocket)

            for client in rooms[room_id]:
                if client != websocket:
                    await client.send(message)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if room_id and room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
            if len(rooms[room_id]) == 0:
                del rooms[room_id]

async def main():
    # O provedor injetará a porta correta aqui. Caso falhe, usa 10000.
    port = int(os.environ.get("PORT", 10000))
    print(f"[UG Signaler] Servidor WebRTC ativo na porta {port}")
    
    # 0.0.0.0 permite acesso externo pelo balanceador de carga do Render
    async with websockets.serve(handler, "0.0.0.0", port):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
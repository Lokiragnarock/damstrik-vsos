from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import List
from .services.simulator import Simulator

app = FastAPI(title="Damstrik V-OS Logic Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Simulator Instance
simulator = Simulator()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.on_event("startup")
async def startup_event():
    # Start the simulation loop in the background
    asyncio.create_task(simulator.run_loop(manager))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming commands from the dashboard (e.g., dispatch confirmation)
            # For now, just echo or log
            print(f"Received command: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def read_root():
    return FileResponse('app/static/index.html')

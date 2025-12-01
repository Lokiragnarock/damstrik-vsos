
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

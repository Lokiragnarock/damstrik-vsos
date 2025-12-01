# Damstrik V-OS Simulator

The **V-OS Zero-Data Simulator** is a real-time logic engine for emergency response visualization. It simulates assets (PCR vans, patrols) moving on a road network and responding to generated events.

## Features
- **Graph-Based Movement**: Assets follow real-world intersections in T. Nagar, Chennai.
- **Real-Time Telemetry**: WebSocket-based state broadcasting.
- **Predictive Heatmaps**: Dynamic risk visualization based on event density.
- **Asset Audit**: Shift tracking and fatigue monitoring.

## Tech Stack
- **Backend**: Python, FastAPI, Uvicorn, WebSockets
- **Frontend**: HTML5, Tailwind CSS, Leaflet.js
- **Simulation**: In-memory graph traversal and state management.

## Local Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Simulator**:
   ```bash
   # Windows
   .\run.bat
   
   # Manual
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Access Dashboard**:
   Open `http://localhost:8000` in your browser.

## Deployment Note
This application uses a **persistent simulation loop** and **WebSockets**. It requires a hosting provider that supports long-running processes (e.g., **Render**, **Railway**, **DigitalOcean**, **Heroku**). 

**It is NOT compatible with standard Vercel/Netlify serverless hosting** because the simulation loop will be terminated by execution time limits.

# Damstrik V-OS Simulator

Read WHAT-IS-REAL.md before touching this app — it's the contract for what is real vs simulated.

A real-time simulation engine for emergency response visualization. Assets (PCR vans, patrols) move on a road network and respond to generated events.

## Features
- Graph-based movement: assets follow real OSM intersections in Koramangala/Madiwala, Bengaluru
- Real-time telemetry over WebSockets
- Heatmap overlay driven by event density
- Asset audit: shift tracking and fatigue display

## Tech Stack
- Backend: Python, FastAPI, Uvicorn, WebSockets
- Frontend: HTML5, Tailwind CSS, Leaflet.js
- Simulation: in-memory graph traversal and state management

## Local Setup

There are two separate frontends in this repo — run whichever one you need.

### Option A: Python backend + HTML5/Leaflet dashboard (real simulation)

This is the one with the actual FastAPI simulation loop over WebSockets.

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the simulator:
   ```bash
   # Windows
   .\run.bat

   # Manual
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. Open `http://localhost:8000` in your browser.

### Option B: React/Vite frontend (standalone client-side demo)

`src/App.jsx` is a separate, self-contained React app — it does **not** connect to the Python backend. It runs its own incident generator entirely in the browser.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the dev server:
   ```bash
   npm run dev
   ```

3. Open the URL Vite prints (default `http://localhost:5173`).

## Deployment Note
The app runs a persistent simulation loop over WebSockets, so it needs a host that supports long-running processes (Render, Railway, DigitalOcean, Heroku). It will not work on Vercel/Netlify serverless — execution time limits kill the loop.

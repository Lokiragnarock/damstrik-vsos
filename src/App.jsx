import React, { useState, useEffect, useRef } from 'react';
import {
    Map as MapIcon,
    Radio,
    Activity,
    CheckCircle,
    Zap,
    Database,
    Siren,
    Car,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- CONFIG ---
// Auto-detect WebSocket URL based on environment
const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:8000/ws'
    : `wss://${window.location.hostname}/api/ws`; // Vercel rewrite handles /api/ws -> backend

// --- COMPONENTS ---

const LeafletMap = ({ assets, events, roadNetwork, heatmapData }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const roadLayerRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            center: [12.9352, 77.6245], // Koramangala
            zoom: 14,
            zoomControl: false,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
        mapInstanceRef.current = map;
        return () => { map.remove(); mapInstanceRef.current = null; };
    }, []);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // 1. Draw Road Network (Static-ish)
        if (roadNetwork && !roadLayerRef.current) {
            roadLayerRef.current = L.layerGroup().addTo(map);
            const { nodes, edges } = roadNetwork;

            // Draw Edges
            Object.entries(edges).forEach(([nodeId, neighbors]) => {
                const start = nodes[nodeId];
                neighbors.forEach(neighborId => {
                    const end = nodes[neighborId];
                    L.polyline([start, end], {
                        color: '#1e293b', // Slate-800
                        weight: 3,
                        opacity: 0.5
                    }).addTo(roadLayerRef.current);
                });
            });

            // Draw Nodes (Intersections)
            Object.values(nodes).forEach(coords => {
                L.circleMarker(coords, {
                    radius: 2,
                    color: '#334155',
                    fillColor: '#0f172a',
                    fillOpacity: 1
                }).addTo(roadLayerRef.current);
            });
        }

        // 2. Update Assets (PCR Vans)
        assets.forEach(asset => {
            const iconHtml = `
                <div class="relative -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-linear">
                    <div class="w-8 h-8 rounded-full border-2 ${asset.status === 'BUSY' ? 'bg-red-900/80 border-red-500 animate-pulse' : 'bg-blue-900/80 border-blue-400'} flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg class="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M14 10l-2-3"/></svg>
                    </div>
                    <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white bg-black/50 px-1 rounded whitespace-nowrap">${asset.asset_id}</div>
                </div>
            `;
            const icon = L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [32, 32] });

            if (markersRef.current[asset.asset_id]) {
                markersRef.current[asset.asset_id].setLatLng([asset.location.lat, asset.location.lng]);
                markersRef.current[asset.asset_id].setIcon(icon);
            } else {
                const marker = L.marker([asset.location.lat, asset.location.lng], { icon }).addTo(map);
                markersRef.current[asset.asset_id] = marker;
            }
        });

        // 3. Update Events
        events.forEach(evt => {
            if (evt.status !== 'ACTIVE') {
                if (markersRef.current[evt.event_id]) {
                    markersRef.current[evt.event_id].remove();
                    delete markersRef.current[evt.event_id];
                }
                return;
            }

            const iconHtml = `
                <div class="relative -translate-x-1/2 -translate-y-1/2">
                    <div class="absolute inset-0 bg-red-500/30 rounded-full animate-ping"></div>
                    <div class="w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg shadow-red-500/50">
                        <svg class="w-3 h-3 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                </div>
            `;
            const icon = L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [24, 24] });

            if (markersRef.current[evt.event_id]) {
                markersRef.current[evt.event_id].setLatLng([evt.location.lat, evt.location.lng]);
            } else {
                const marker = L.marker([evt.location.lat, evt.location.lng], { icon }).addTo(map);
                markersRef.current[evt.event_id] = marker;
            }
        });

    }, [assets, events, roadNetwork]);

    return <div ref={mapRef} className="w-full h-full bg-slate-900" />;
};

function App() {
    const [connected, setConnected] = useState(false);
    const [assets, setAssets] = useState([]);
    const [events, setEvents] = useState([]);
    const [logs, setLogs] = useState([]);
    const [roadNetwork, setRoadNetwork] = useState(null);
    const [activeTab, setActiveTab] = useState('ops');

    useEffect(() => {
        let ws;
        const connect = () => {
            console.log("Connecting to WebSocket:", WS_URL);
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                setConnected(true);
                console.log("Connected to Backend");
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setAssets(data.assets || []);
                    setEvents(data.events || []);
                    setLogs(data.logs || []);
                    if (data.road_network && !roadNetwork) {
                        setRoadNetwork(data.road_network);
                    }
                } catch (e) {
                    console.error("Error parsing WS data", e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                setTimeout(connect, 3000); // Reconnect
            };
        };

        connect();
        return () => ws?.close();
    }, [roadNetwork]); // Re-run only if roadNetwork needs setting (mostly once)

    const activeEvents = events.filter(e => e.status === 'ACTIVE');
    const busyAssets = assets.filter(a => a.status !== 'IDLE');

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* HEADER */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-700 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter text-white leading-none">NAMMA <span className="text-blue-500">100</span></h1>
                            <div className="text-[9px] font-mono text-slate-400 tracking-widest uppercase">Bangalore City Police • CAD System</div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${connected ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-bold ${connected ? 'text-emerald-400' : 'text-red-400'}`}>{connected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}</span>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-hidden relative grid grid-cols-12 gap-0">

                {/* LEFT SIDEBAR: ASSETS */}
                <div className="col-span-3 bg-slate-900/95 border-r border-slate-800 flex flex-col z-20">
                    <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <Car className="w-4 h-4 text-blue-400" /> PCR Units
                        </h2>
                        <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded text-white">{assets.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {assets.map(asset => (
                            <div key={asset.asset_id} className={`p-3 rounded-lg border flex items-center justify-between transition-all ${asset.status === 'BUSY' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${asset.status === 'BUSY' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                    <div>
                                        <div className="text-sm font-bold text-white">{asset.asset_id}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{asset.status}</div>
                                    </div>
                                </div>
                                {asset.status === 'BUSY' && <div className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded">DISPATCHED</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER MAP */}
                <div className="col-span-6 relative bg-slate-950">
                    <LeafletMap assets={assets} events={events} roadNetwork={roadNetwork} />
                </div>

                {/* RIGHT SIDEBAR: EVENTS & LOGS */}
                <div className="col-span-3 bg-slate-900/95 border-l border-slate-800 flex flex-col z-20">
                    {/* ACTIVE EVENTS */}
                    <div className="flex-1 flex flex-col border-b border-slate-800">
                        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                <AlertTriangle className="w-4 h-4 text-red-500" /> Active Incidents
                            </h2>
                            <span className="text-xs font-mono bg-red-900/50 text-red-200 px-2 py-0.5 rounded">{activeEvents.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {activeEvents.length === 0 && (
                                <div className="text-center text-slate-500 text-xs py-10">No active incidents.</div>
                            )}
                            {activeEvents.map(evt => (
                                <div key={evt.event_id} className="p-3 rounded-lg border border-red-500/30 bg-red-900/10 animate-in slide-in-from-right">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-red-400 border border-red-500/50 px-1.5 rounded uppercase">{evt.type}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">Sev: {evt.severity}</span>
                                    </div>
                                    <div className="text-xs text-slate-300 mb-2">Location: {evt.location.lat.toFixed(4)}, {evt.location.lng.toFixed(4)}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/50 p-1.5 rounded">
                                        <Siren className="w-3 h-3 text-blue-400" />
                                        {assets.find(a => a.target_event_id === evt.event_id)?.asset_id ?
                                            `Responding: ${assets.find(a => a.target_event_id === evt.event_id).asset_id}` :
                                            "Dispatching..."}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LOGS */}
                    <div className="h-1/3 flex flex-col bg-slate-950">
                        <div className="p-2 border-b border-slate-800 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Database className="w-3 h-3" /> 100-DIAL FEED
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
                            {logs.slice().reverse().map((log, i) => (
                                <div key={i} className="flex gap-2 text-slate-400">
                                    <span className="text-slate-600 shrink-0">{log.timestamp.split('T')[1].split('.')[0]}</span>
                                    <span className="text-slate-300">{log.raw_data}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default App;

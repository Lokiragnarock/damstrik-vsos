import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Shield,
    Map as MapIcon,
    Radio,
    Users,
    Activity,
    CheckCircle,
    Zap,
    Navigation,
    Award,
    X,
    Wifi,
    Database,
    Sparkles,
    BrainCircuit,
    FileText,
    Server,
    Plane,
    Battery,
    Signal,
    Target,
    Eye
} from 'lucide-react';
import L from 'leaflet';

// --- GEMINI API INTEGRATION ---
const apiKey = ""; // API Key injected by environment

const callGeminiStrategy = async (incident, drone) => {
    if (!apiKey) {
        // Fallback simulation based on incident type
        return new Promise(resolve => {
            setTimeout(() => {
                let advice = "";
                if (incident.type === 'infiltration') {
                    advice = `*TACTICAL ADVISORY:* Heat signatures detected crossing river bank. 
           *STRATEGY:* Deploy ${drone.name} for low-altitude thermal sweep. 
           *RATIONALE:* ${drone.payload} payload optimal for night/fog visibility.`;
                } else if (incident.type === 'smuggling') {
                    advice = `*TACTICAL ADVISORY:* Suspicious boat movement near Ghat. 
           *STRATEGY:* Track and trace origin. Do not engage directly. 
           *RATIONALE:* ${drone.name} has sufficient battery (${drone.battery}%) for long-duration tracking.`;
                } else {
                    advice = `*TACTICAL ADVISORY:* Perimeter breach alert. 
           *STRATEGY:* Rapid response required to verify threat. 
           *RATIONALE:* ${drone.name} is closest asset with high-res optics.`;
                }
                resolve(advice);
            }, 1500);
        });
    }
    // ... (Real API call logic would go here)
    return "AI Analysis Unavailable";
};

// --- MOCK BACKEND DATA ---

const ZONES = [
    { id: 'z1', name: 'Dhubri Ghat', lat: 26.0207, lng: 89.9743, risk: 'high', type: 'smuggling', radius: 600 },
    { id: 'z2', name: 'Gauripur Junction', lat: 26.0500, lng: 89.9800, risk: 'medium', type: 'traffic', radius: 400 },
    { id: 'z3', name: 'Brahmaputra River Bank', lat: 26.0100, lng: 89.9600, risk: 'critical', type: 'infiltration', radius: 1000 },
    { id: 'z4', name: 'Border Outpost 4', lat: 26.0800, lng: 89.9200, risk: 'high', type: 'security', radius: 500 },
];

const INITIAL_DRONES = [
    {
        id: 'd1',
        name: 'Falcon-1',
        model: 'Heron TP',
        lat: 26.0250,
        lng: 89.9750,
        status: 'patrol',
        payload: 'Thermal/IR',
        battery: 85,
        altitude: 1200,
        history: []
    },
    {
        id: 'd2',
        name: 'Eagle-Eye',
        model: 'Predator B',
        lat: 26.0400,
        lng: 89.9650,
        status: 'patrol',
        payload: 'High-Res Optical',
        battery: 62,
        altitude: 2500,
        history: []
    },
    {
        id: 'd3',
        name: 'Scout-X',
        model: 'DJI Matrice',
        lat: 26.0150,
        lng: 89.9850,
        status: 'busy',
        payload: 'LIDAR Scanner',
        battery: 45,
        altitude: 400,
        history: []
    },
    {
        id: 'd4',
        name: 'Sentinel-9',
        model: 'Rustom-II',
        lat: 26.0600,
        lng: 89.9300,
        status: 'patrol',
        payload: 'SIGINT Suite',
        battery: 92,
        altitude: 5000,
        history: []
    }
];

const INCIDENT_TYPES = {
    'smuggling': { label: 'Smuggling Attempt', color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-500/50', mapColor: '#fbbf24' },
    'infiltration': { label: 'Border Infiltration', color: 'text-red-500', bg: 'bg-red-900/30', border: 'border-red-500/50', mapColor: '#ef4444' },
    'security': { label: 'Perimeter Breach', color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-500/50', mapColor: '#c084fc' },
    'traffic': { label: 'Convoy Movement', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-500/50', mapColor: '#60a5fa' },
    'medical': { label: 'Medical Emergency', color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-500/50', mapColor: '#34d399' }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// --- COMPONENTS ---

const IngestionLogs = ({ logs }) => {
    const scrollRef = useRef(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    return (
        <div className="bg-slate-900 border-t border-slate-800 p-2 h-40 flex flex-col">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Server className="w-3 h-3" /> Sensor Fusion Log
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
                {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-slate-500 shrink-0">{log.time}</span>
                        <span className={`${log.color || 'text-slate-300'}`}>{log.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LeafletMap = ({ drones, incidents, zones, heatmapMode, droneMode, onDroneClick, onIncidentClick, routes }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const circlesRef = useRef({});

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            center: [26.0207, 89.9743], // Dhubri
            zoom: 13,
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

        // Zones
        if (heatmapMode) {
            zones.forEach(zone => {
                if (!circlesRef.current[zone.id]) {
                    const circle = L.circle([zone.lat, zone.lng], {
                        color: INCIDENT_TYPES[zone.type].mapColor,
                        fillColor: INCIDENT_TYPES[zone.type].mapColor,
                        fillOpacity: 0.15,
                        radius: zone.radius,
                        weight: 1,
                        dashArray: '5, 5'
                    }).addTo(map);
                    circlesRef.current[zone.id] = circle;
                }
            });
        } else {
            Object.values(circlesRef.current).forEach(c => c.remove());
            circlesRef.current = {};
        }

        // Drones
        if (droneMode) {
            drones.forEach(drone => {
                const iconHtml = `
                    <div class="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
                        <div class="w-8 h-8 rounded-full border-2 ${drone.status === 'busy' ? 'bg-amber-600 border-white shadow-[0_0_15px_rgba(245,158,11,0.8)]' : 'bg-slate-900 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'} flex items-center justify-center z-20 relative transition-all">
                            <svg class="w-4 h-4 text-white transform ${drone.status === 'busy' ? 'animate-pulse' : ''}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h20"/><path d="M12 2v6"/><path d="M12 16v6"/><path d="M2 16h20"/><path d="M12 8a4 4 0 0 0 0 8"/></svg>
                        </div>
                        ${drone.status === 'patrol' ? '<div class="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping"></div>' : ''}
                        <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] text-white px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">${drone.name}</div>
                    </div>
                `;
                const icon = L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [32, 32], iconAnchor: [16, 16] });

                if (markersRef.current[drone.id]) {
                    markersRef.current[drone.id].setLatLng([drone.lat, drone.lng]);
                    markersRef.current[drone.id].setIcon(icon);
                } else {
                    const marker = L.marker([drone.lat, drone.lng], { icon }).addTo(map);
                    marker.on('click', () => onDroneClick(drone));
                    markersRef.current[drone.id] = marker;
                }
            });
        }

        // Incidents
        incidents.forEach(inc => {
            const iconHtml = `
                <div class="relative -translate-x-1/2 -translate-y-1/2 group/incident">
                    <div class="absolute inset-[-20px] bg-red-500/20 rounded-full animate-ping"></div>
                    <div class="w-8 h-8 rounded-full border-2 ${inc.status === 'assigned' ? 'bg-emerald-600 border-white' : 'bg-red-600 border-white animate-bounce'} flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)]">
                         <svg class="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                </div>
            `;
            const icon = L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [32, 32], iconAnchor: [16, 16] });

            if (markersRef.current[inc.id]) {
                markersRef.current[inc.id].setLatLng([inc.lat, inc.lng]);
                markersRef.current[inc.id].setIcon(icon);
            } else {
                const marker = L.marker([inc.lat, inc.lng], { icon }).addTo(map);
                marker.on('click', () => onIncidentClick(inc));
                markersRef.current[inc.id] = marker;
            }
        });

        // Routes
        if (!map.routesLayer) map.routesLayer = L.layerGroup().addTo(map);
        map.routesLayer.clearLayers();
        if (routes) {
            routes.forEach(route => {
                if (route.geometry) {
                    L.polyline(route.geometry, { color: '#06b6d4', weight: 2, opacity: 0.8, dashArray: '5, 5' }).addTo(map.routesLayer);
                }
            });
        }
    }, [drones, incidents, zones, heatmapMode, droneMode, routes]);

    return <div ref={mapRef} className="w-full h-full bg-slate-900" />;
};

const AuditDashboard = () => {
    // Mock Data for Audit Logs
    const [signals, setSignals] = useState([
        { id: 'SIG-882', time: '14:20:15', type: 'RF Intercept', source: 'Dhubri Sector', status: 'Analyzed', freq: '433MHz' },
        { id: 'SIG-883', time: '14:18:30', type: 'Sat Phone', source: 'River Bank', status: 'Flagged', freq: '1.6GHz' },
    ]);

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-950 text-slate-200">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Database className="w-6 h-6 text-cyan-500" />
                Surveillance Archives
            </h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <Radio className="w-5 h-5 text-purple-400" /> SIGINT Intercepts
                    </h3>
                    <div className="space-y-2">
                        {signals.map(sig => (
                            <div key={sig.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                <div>
                                    <div className="text-sm font-bold text-white">{sig.id} <span className="text-slate-500 font-normal">| {sig.type}</span></div>
                                    <div className="text-xs text-slate-400">{sig.source} • {sig.freq}</div>
                                </div>
                                <div className="text-xs font-mono text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">{sig.status}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

function App() {
    const [drones, setDrones] = useState(INITIAL_DRONES);
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [selectedDrone, setSelectedDrone] = useState(null);
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [showDroneModal, setShowDroneModal] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState(true);
    const [droneMode, setDroneMode] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [routes, setRoutes] = useState([]);
    const [activeTab, setActiveTab] = useState('ops');
    const [aiAdvice, setAiAdvice] = useState(null);
    const [generatingAdvice, setGeneratingAdvice] = useState(false);
    const [logs, setLogs] = useState([]);
    const [demoMode, setDemoMode] = useState(true);

    const addLog = (msg, color = 'text-slate-300') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, color }].slice(-50));
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Demo Scenario
    useEffect(() => {
        if (!demoMode) return;
        const interval = setInterval(() => {
            if (incidents.length < 3 && Math.random() > 0.6) {
                const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
                const newIncident = {
                    id: Date.now(),
                    type: zone.type,
                    lat: zone.lat + (Math.random() - 0.5) * 0.01,
                    lng: zone.lng + (Math.random() - 0.5) * 0.01,
                    location: zone.name,
                    time: new Date().toLocaleTimeString(),
                    status: 'pending',
                    desc: `Anomaly detected in ${zone.name}. Potential ${zone.type}.`,
                    assignedTo: null
                };
                setIncidents(prev => [...prev, newIncident]);
                addLog(`ALERT: ${newIncident.type} detected at ${newIncident.location}`, 'text-red-400');
            }
        }, 6000);
        return () => clearInterval(interval);
    }, [demoMode, incidents]);

    const fetchRoute = async (startLat, startLng, endLat, endLng) => {
        // Simple straight line for drones (or use OSRM if following roads/rivers)
        return [[startLat, startLng], [endLat, endLng]];
    };

    const handleDispatch = (incident, drone) => {
        setDispatching(true);
        addLog(`Commanding ${drone.name} to coordinates...`, 'text-cyan-400');

        setTimeout(async () => {
            const routeGeometry = await fetchRoute(drone.lat, drone.lng, incident.lat, incident.lng);
            if (routeGeometry) setRoutes(prev => [...prev, { id: incident.id, geometry: routeGeometry }]);

            setDrones(prev => prev.map(d => d.id === drone.id ? { ...d, status: 'busy', lat: incident.lat, lng: incident.lng } : d));
            setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'assigned', assignedTo: drone.id } : i));

            setDispatching(false);
            setShowDispatchModal(false);
            setSelectedIncident(null);
            setAiAdvice(null);
            addLog(`Drone on station. Feed established.`, 'text-emerald-400');
        }, 2000);
    };

    const recommendedDrones = useMemo(() => {
        if (!selectedIncident) return [];
        return drones
            .map(d => ({
                ...d,
                distance: Math.round(calculateDistance(d.lat, d.lng, selectedIncident.lat, selectedIncident.lng) * 1000),
                score: Math.floor(Math.random() * 30) + 70,
                breakdown: { payload: 95, proximity: 80, battery: d.battery }
            }))
            .sort((a, b) => b.score - a.score);
    }, [selectedIncident, drones]);

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* HEADER */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-cyan-600 p-1.5 rounded-lg shadow-lg shadow-cyan-500/20">
                            <Plane className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter text-white leading-none">SKY <span className="text-cyan-500">SENTINEL</span></h1>
                            <div className="text-[9px] font-mono text-slate-400 tracking-widest uppercase">Autonomous Border Surveillance</div>
                        </div>
                    </div>
                    <div className="h-6 w-px bg-slate-800 mx-2"></div>
                    <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                        <button onClick={() => setActiveTab('ops')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'ops' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
                            <MapIcon className="w-3 h-3" /> Live Feed
                        </button>
                        <button onClick={() => setActiveTab('audit')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
                            <FileText className="w-3 h-3" /> Archives
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-300">SAT LINK ACTIVE</span>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-mono font-bold text-white">{currentTime.toLocaleTimeString()}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">ASSAM SECTOR</div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'ops' ? (
                    <div className="grid grid-cols-12 gap-0 h-full">
                        {/* LEFT SIDEBAR */}
                        <div className="col-span-3 bg-slate-900/95 border-r border-slate-800 flex flex-col z-20 backdrop-blur-sm">
                            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800/50">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                    <Plane className="w-4 h-4 text-cyan-500" /> Drone Swarm
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
                                {drones.map(drone => (
                                    <div key={drone.id} onClick={() => { setSelectedDrone(drone); setShowDroneModal(true); }} className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${drone.status === 'busy' ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`relative w-2 h-2 rounded-full ${drone.status === 'busy' ? 'bg-amber-500' : 'bg-cyan-500'}`}>
                                                {drone.status === 'busy' && <div className="absolute inset-0 rounded-full animate-ping bg-amber-500 opacity-75"></div>}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white leading-tight">{drone.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{drone.model}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 justify-end text-[10px] text-slate-400">
                                                <Battery className="w-3 h-3" /> {drone.battery}%
                                            </div>
                                            <div className="flex items-center gap-1 justify-end text-[10px] text-slate-400 mt-0.5">
                                                <Signal className="w-3 h-3" /> {drone.altitude}ft
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CENTER MAP */}
                        <div className="col-span-6 relative bg-slate-950 overflow-hidden group flex flex-col">
                            <div className="flex-1 relative z-0">
                                <LeafletMap
                                    drones={drones}
                                    incidents={incidents}
                                    zones={ZONES}
                                    heatmapMode={heatmapMode}
                                    droneMode={droneMode}
                                    onDroneClick={(d) => { setSelectedDrone(d); setShowDroneModal(true); }}
                                    onIncidentClick={(inc) => { if (inc.status !== 'assigned') { setSelectedIncident(inc); setShowDispatchModal(true); } }}
                                    routes={routes}
                                />
                                <div className="absolute top-4 left-4 z-[400] flex gap-2">
                                    <button onClick={() => setHeatmapMode(!heatmapMode)} className={`px-4 py-2 text-xs font-bold rounded shadow-lg backdrop-blur-md border transition-all ${heatmapMode ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-400'}`}>
                                        <Activity className="w-3 h-3 inline mr-2" /> RISK ZONES
                                    </button>
                                    <button onClick={() => setDroneMode(!droneMode)} className={`px-4 py-2 text-xs font-bold rounded shadow-lg backdrop-blur-md border transition-all ${droneMode ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-400'}`}>
                                        <Plane className="w-3 h-3 inline mr-2" /> DRONE OVERLAY
                                    </button>
                                </div>
                            </div>
                            <IngestionLogs logs={logs} />
                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div className="col-span-3 bg-slate-900/95 border-l border-slate-800 flex flex-col z-20 backdrop-blur-sm">
                            <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                    <Target className="w-4 h-4 text-red-500 animate-pulse" /> Threat Detection
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                                {incidents.map(inc => (
                                    <div key={inc.id} className={`relative p-4 rounded-xl border transition-all animate-in slide-in-from-right duration-500 ${inc.status === 'assigned' ? 'bg-slate-800/50 border-emerald-500/30' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'}`}>
                                        {inc.status === 'pending' && <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${INCIDENT_TYPES[inc.type].color} ${INCIDENT_TYPES[inc.type].bg} ${INCIDENT_TYPES[inc.type].border}`}>
                                                {INCIDENT_TYPES[inc.type].label}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">{inc.time}</span>
                                        </div>
                                        <h3 className="font-bold text-white text-sm mb-1 leading-tight">{inc.location}</h3>
                                        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed border-l-2 border-slate-700 pl-2">{inc.desc}</p>
                                        {inc.status === 'pending' ? (
                                            <button onClick={() => { setSelectedIncident(inc); setShowDispatchModal(true); }} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 transition-all hover:scale-[1.02]">
                                                <Zap className="w-3 h-3 fill-current" /> ENGAGE
                                            </button>
                                        ) : (
                                            <div className="mt-3 p-2 bg-emerald-900/10 rounded border border-emerald-500/20 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30">
                                                        <Plane className="w-3 h-3 text-emerald-400" />
                                                    </div>
                                                    <div className="text-xs">
                                                        <div className="text-slate-400 text-[9px] uppercase">Intercepting</div>
                                                        <div className="text-white font-bold">{drones.find(d => d.id === inc.assignedTo)?.name}</div>
                                                    </div>
                                                </div>
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <AuditDashboard />
                )}
            </div>

            {/* DISPATCH MODAL */}
            {showDispatchModal && selectedIncident && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-cyan-400 fill-current animate-pulse" />
                                    Mission Planner
                                </h2>
                                <p className="text-xs text-slate-400 font-mono mt-1 tracking-wider">SKYNET TACTICAL CORE • V4.1</p>
                            </div>
                            <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
                            {/* Gemini AI Section */}
                            <div className="mb-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-900/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">AI Strategy (Gemini)</span>
                                </div>
                                {generatingAdvice ? (
                                    <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                                        <BrainCircuit className="w-4 h-4 animate-spin text-cyan-500" /> Computing Flight Path...
                                    </div>
                                ) : aiAdvice ? (
                                    <div className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-line">{aiAdvice}</div>
                                ) : (
                                    <button onClick={() => { setGeneratingAdvice(true); setTimeout(() => { setAiAdvice("Recommended: Low-altitude approach via river channel to minimize acoustic signature."); setGeneratingAdvice(false); }, 1500); }} className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1.5 rounded border border-slate-600 transition-colors">
                                        Generate Flight Plan
                                    </button>
                                )}
                            </div>

                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Available Assets</h3>
                            <div className="space-y-3">
                                {recommendedDrones.map((match, idx) => (
                                    <div key={match.id} className={`group relative p-4 rounded-xl border transition-all duration-300 ${idx === 0 ? 'bg-cyan-900/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)] scale-[1.01]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}>
                                        {idx === 0 && <div className="absolute -top-2.5 right-4 bg-cyan-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-lg border border-cyan-400 flex items-center gap-1"><Award className="w-3 h-3" /> OPTIMAL</div>}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 border border-slate-600"><Plane className="w-5 h-5" /></div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{match.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{match.model} • {match.distance}m range</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-cyan-400">{match.score}%</div>
                                                <div className="text-[9px] text-slate-500 uppercase">Suitability</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-end">
                                            <button onClick={() => handleDispatch(selectedIncident, match)} disabled={dispatching} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                                                {dispatching ? 'Launching...' : 'Launch Drone'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DRONE MODAL */}
            {showDroneModal && selectedDrone && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Plane className="w-5 h-5 text-cyan-500" /> Telemetry</h2>
                            <button onClick={() => setShowDroneModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-500 border-2 border-slate-700"><Plane className="w-8 h-8" /></div>
                                <div>
                                    <div className="text-xl font-bold text-white">{selectedDrone.name}</div>
                                    <div className="text-sm text-slate-400 font-mono">{selectedDrone.model}</div>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Payload Configuration</div>
                                <div className="text-sm text-white">{selectedDrone.payload}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Battery Level</div>
                                    <div className="text-xl font-bold text-emerald-400">{selectedDrone.battery}%</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Altitude</div>
                                    <div className="text-xl font-bold text-cyan-400">{selectedDrone.altitude}ft</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

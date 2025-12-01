console.log("App.js is executing...");
const { useState, useEffect, useMemo, useCallback, useRef } = React;
console.log("React globals loaded:", { useState, useEffect });

// Fallback for missing LucideReact icons
if (!window.LucideReact || Object.keys(window.LucideReact).length === 0) {
    console.warn("LucideReact not found or empty. Using placeholders.");
    window.LucideReact = new Proxy({}, {
        get: (target, prop) => {
            return (props) => React.createElement('span', { ...props, style: { ...props.style, display: 'inline-block', border: '1px dashed #666', padding: '2px', fontSize: '10px', color: 'cyan' } }, prop.toString());
        }
    });
}

const { createRoot } = ReactDOM;
const {
    Shield,
    Map: MapIcon,
    Radio,
    Users,
    Bell,
    Search,
    Activity,
    Clock,
    CheckCircle,
    AlertTriangle,
    Zap,
    Navigation,
    Battery,
    Award,
    ChevronRight,
    X,
    Target,
    Wifi,
    Database,
    Play,
    Pause,
    Sparkles,
    BrainCircuit,
    CloudRain,
    TrendingUp,
    FileText,
    PhoneCall,
    Mic,
    Server
} = LucideReact;

// --- GEMINI API INTEGRATION ---
const apiKey = ""; // API Key injected by environment

const callGeminiStrategy = async (incident, officer) => {
    if (!apiKey) {
        // Fallback simulation based on incident type
        return new Promise(resolve => {
            setTimeout(() => {
                let advice = "";
                if (incident.type === 'theft') {
                    advice = `*TACTICAL ADVISORY:* Suspect likely mobile on two-wheeler. 
           *STRATEGY:* Cut off escape routes at 80ft Road Junction. 
           *RATIONALE:* ${officer.name} selected for interception speed (${officer.vehicle}).`;
                } else if (incident.type === 'public_order') {
                    advice = `*TACTICAL ADVISORY:* Crowd gathering potential high. 
           *STRATEGY:* De-escalation protocol. Do not engage alone. 
           *RATIONALE:* ${officer.name} has 'Crowd Control' skill and is nearby.`;
                } else {
                    advice = `*TACTICAL ADVISORY:* Routine patrol gap detected. 
           *STRATEGY:* High visibility presence required in Sector 4. 
           *RATIONALE:* ${officer.name} is the closest available unit to fill the gap.`;
                }
                resolve(advice);
            }, 1500);
        });
    }

    const prompt = `
    You are a police tactical AI advisor. Analyze this incident: "${incident.desc}" at location "${incident.location}" (Risk: ${incident.priority}).
    The top recommended officer is ${officer.name} (Badge: ${officer.badge}).
    Officer Stats - Skills: ${officer.skill.join(', ')}, Fatigue: ${officer.fatigue}%, Distance: ${officer.distance}m.
    
    Provide a concise tactical assessment in this format:
    *TACTICAL ADVISORY:* [1 sentence on threat analysis]
    *STRATEGY:* [1 sentence on immediate action]
    *RATIONALE:* [1 sentence on why this officer fits]
  `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI Analysis Unavailable";
    } catch (error) {
        console.error("Gemini API Failed:", error);
        return "Tactical uplink offline. Proceed with standard SOP.";
    }
};

// --- MOCK BACKEND DATA ---

const ZONES = [
    { id: 'z1', name: 'Koramangala 5th Block', lat: 12.934, lng: 77.62, risk: 'high', type: 'theft', radius: 300 },
    { id: 'z2', name: 'SG Palya (Christ Univ)', lat: 12.938, lng: 77.60, risk: 'medium', type: 'public_order', radius: 250 },
    { id: 'z3', name: 'Sony Signal', lat: 12.945, lng: 77.625, risk: 'low', type: 'traffic', radius: 200 },
    { id: 'z4', name: 'Madiwala Market', lat: 12.922, lng: 77.618, risk: 'high', type: 'assault', radius: 350 },
];

const INITIAL_OFFICERS = [
    {
        id: 'o1',
        name: 'ASI Rajesh Kumar',
        badge: 'KA-05-221',
        skill: ['Theft', 'Burglary'],
        fatigue: 15,
        status: 'patrol',
        lat: 12.936, lng: 77.615,
        vehicle: 'Cheetah',
        history: '15 Years Service • 94% Clearance Rate',
        specialization_desc: 'Expert in property crimes and urban pursuit tactics.'
    },
    {
        id: 'o2',
        name: 'PC Priya Sharma',
        badge: 'KA-05-889',
        skill: ['Women Safety', 'Mediation'],
        fatigue: 45,
        status: 'patrol',
        lat: 12.939, lng: 77.605,
        vehicle: 'Hoysala',
        history: '8 Years Service • 88% Clearance Rate',
        specialization_desc: 'Certified crisis negotiator and women safety specialist.'
    },
    {
        id: 'o3',
        name: 'HC Vikram Singh',
        badge: 'KA-01-112',
        skill: ['Cyber', 'Fraud'],
        fatigue: 10,
        status: 'station',
        lat: 12.930, lng: 77.610,
        vehicle: 'Desk',
        history: '12 Years Service • 91% Clearance Rate',
        specialization_desc: 'Digital forensics expert. Handles financial fraud cases.'
    },
    {
        id: 'o4',
        name: 'PC Arun Gowda',
        badge: 'KA-05-334',
        skill: ['Public Order', 'Crowd Control'],
        fatigue: 80,
        status: 'patrol',
        lat: 12.925, lng: 77.620,
        vehicle: 'Cheetah',
        history: '5 Years Service • 85% Clearance Rate',
        specialization_desc: 'Riot control trained. Strong community presence.'
    },
    {
        id: 'o5',
        name: 'PSI Anjali Reddy',
        badge: 'KA-05-990',
        skill: ['Narcotics', 'Investigation'],
        fatigue: 30,
        status: 'patrol',
        lat: 12.942, lng: 77.618,
        vehicle: 'Hoysala',
        history: '10 Years Service • 96% Clearance Rate',
        specialization_desc: 'Lead investigator for organized crime and narcotics.'
    },
];

const CRIME_TYPES = {
    theft: { label: 'Theft / Snatch', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500', mapColor: '#a855f7' },
    assault: { label: 'Violent Assault', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500', mapColor: '#ef4444' },
    cyber: { label: 'Cyber Fraud', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500', mapColor: '#f97316' },
    women_safety: { label: 'Women Safety', color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500', mapColor: '#ec4899' },
    public_order: { label: 'Public Nuisance', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', mapColor: '#3b82f6' },
    murder: { label: 'Homicide', color: 'text-green-500', bg: 'bg-green-500/20', border: 'border-green-500', mapColor: '#22c55e' },
    traffic: { label: 'Traffic Congestion', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', mapColor: '#eab308' },
    predictive: { label: 'AI Forecast', color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500', mapColor: '#22d3ee' },
};

// --- LOGIC HELPERS ---

// Haversine distance for lat/lng
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const calculateFitScore = (officer, incident) => {
    const dist = calculateDistance(officer.lat, officer.lng, incident.lat, incident.lng);
    const proximityScore = Math.max(0, 100 - (dist / 1000) * 20); // Decay over km

    const requiredSkills = {
        'theft': ['Theft', 'Burglary', 'Public Order'],
        'assault': ['Public Order', 'Crowd Control'],
        'cyber': ['Cyber', 'Fraud'],
        'women_safety': ['Women Safety', 'Mediation'],
        'public_order': ['Public Order'],
        'murder': ['Investigation', 'Forensics'],
        'traffic': ['Public Order', 'Crowd Control'],
        'predictive': ['Patrol', 'Public Order', 'Theft'] // Generic patrol skills
    };

    const hasSkill = requiredSkills[incident.type]?.some(r => officer.skill.includes(r));
    const skillScore = hasSkill ? 100 : 20;
    const fatigueScore = 100 - officer.fatigue;
    const totalScore = (proximityScore * 0.4) + (skillScore * 0.4) + (fatigueScore * 0.2);

    return {
        score: Math.round(totalScore),
        breakdown: { proximity: Math.round(proximityScore), skill: skillScore, fatigue: fatigueScore },
        distance: Math.round(dist) // meters
    };
};

// --- VISUAL COMPONENTS ---

const IngestionLogs = ({ logs }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="bg-slate-900 border-t border-slate-800 p-2 h-40 flex flex-col">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Server className="w-3 h-3" /> System Ingestion Log
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
                {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-slate-500 shrink-0">{log.time}</span>
                        <span className={`${log.color || 'text-slate-300'}`}>{log.msg}</span>
                    </div>
                ))}
                {logs.length === 0 && <div className="text-slate-600 italic">System ready. Listening for streams...</div>}
            </div>
        </div>
    );
};

// --- LEAFLET MAP COMPONENT ---
const LeafletMap = ({ officers, incidents, zones, heatmapMode, patrolCarMode, onOfficerClick, onIncidentClick }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const circlesRef = useRef({});

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            center: [12.935, 77.615],
            zoom: 14,
            zoomControl: false,
            attributionControl: false
        });

        // Dark Matter Tile Layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update Markers & Zones
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear removed markers logic could be added here, but for now we just update/add
        // A robust implementation would diff the lists. For simplicity, we'll clear and redraw if lists change length significantly,
        // or just update positions.

        // --- ZONES ---
        if (heatmapMode) {
            zones.forEach(zone => {
                if (!circlesRef.current[zone.id]) {
                    const circle = L.circle([zone.lat, zone.lng], {
                        color: CRIME_TYPES[zone.type].mapColor,
                        fillColor: CRIME_TYPES[zone.type].mapColor,
                        fillOpacity: 0.2,
                        radius: zone.radius,
                        weight: 1
                    }).addTo(map);
                    circlesRef.current[zone.id] = circle;
                }
            });
        } else {
            Object.values(circlesRef.current).forEach(c => c.remove());
            circlesRef.current = {};
        }

        // --- OFFICERS ---
        if (patrolCarMode) {
            officers.forEach(officer => {
                const iconHtml = `
                    <div class="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer">
                        <div class="w-8 h-8 rounded-full border-2 ${officer.status === 'busy' ? 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.8)]' : 'bg-slate-900 border-blue-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]'} flex items-center justify-center z-20 relative transition-all">
                            <svg class="w-4 h-4 text-white transform ${officer.status === 'busy' ? 'rotate-0 animate-bounce' : 'rotate-45'}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                        </div>
                        ${officer.status === 'patrol' ? '<div class="absolute inset-0 rounded-full border border-blue-500/30 animate-ping"></div>' : ''}
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: 'bg-transparent',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                if (markersRef.current[officer.id]) {
                    markersRef.current[officer.id].setLatLng([officer.lat, officer.lng]);
                    markersRef.current[officer.id].setIcon(icon);
                } else {
                    const marker = L.marker([officer.lat, officer.lng], { icon }).addTo(map);
                    marker.on('click', () => onOfficerClick(officer));
                    markersRef.current[officer.id] = marker;
                }
            });
        } else {
            // Remove officer markers if mode off
            // (Implementation omitted for brevity, assuming mode stays on usually)
        }

        // --- INCIDENTS ---
        incidents.forEach(inc => {
            const iconHtml = `
                <div class="relative -translate-x-1/2 -translate-y-1/2 group/incident">
                    <div class="absolute inset-[-20px] bg-red-500/20 rounded-full animate-ping"></div>
                    <div class="absolute inset-[-10px] bg-red-500/30 rounded-full animate-pulse"></div>
                    <div class="w-10 h-10 rounded-full border-2 ${inc.status === 'assigned' ? 'bg-green-600 border-white' : 'bg-red-600 border-white animate-bounce'} flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)]">
                         ${inc.status === 'assigned' ?
                    '<svg class="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' :
                    '<svg class="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
                    </div>
                </div>
            `;

            const icon = L.divIcon({
                html: iconHtml,
                className: 'bg-transparent',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            if (markersRef.current[inc.id]) {
                markersRef.current[inc.id].setLatLng([inc.lat || inc.x, inc.lng || inc.y]); // Fallback if still using x/y
                markersRef.current[inc.id].setIcon(icon);
            } else {
                // Ensure incident has lat/lng. If coming from demo, it might need mapping
                // For demo, we'll map the x/y percent to rough lat/lng if missing
                let lat = inc.lat;
                let lng = inc.lng;

                if (!lat) {
                    // Rough mapping from 0-100% to map bounds
                    // Center 12.935, 77.615. Range approx +/- 0.02
                    lat = 12.955 - (inc.y / 100) * 0.04;
                    lng = 77.595 + (inc.x / 100) * 0.04;
                    inc.lat = lat;
                    inc.lng = lng;
                }

                const marker = L.marker([lat, lng], { icon }).addTo(map);
                marker.on('click', () => onIncidentClick(inc));
                markersRef.current[inc.id] = marker;
            }
        });

        // --- ROUTES ---
        // Clear existing routes
        // (In a real app, we'd diff this, but for now we clear and redraw)
        // We need a ref for routes to clear them efficiently
        if (!map.routesLayer) {
            map.routesLayer = L.layerGroup().addTo(map);
        }
        map.routesLayer.clearLayers();

        if (routes) {
            routes.forEach(route => {
                if (route.geometry) {
                    L.polyline(route.geometry, {
                        color: '#3b82f6', // blue-500
                        weight: 4,
                        opacity: 0.7,
                        dashArray: '10, 10',
                        lineCap: 'round'
                    }).addTo(map.routesLayer);
                }
            });
        }

    }, [officers, incidents, zones, heatmapMode, patrolCarMode, routes]);

    return <div ref={mapRef} className="w-full h-full bg-slate-900" />;
};


// --- AUDIT DASHBOARD COMPONENT ---

const AuditDashboard = () => {
    // Mock Data for Audit Logs
    const [firs, setFirs] = useState([
        { id: 'FIR-2024-001', time: '10:15 AM', type: 'Theft', station: 'Koramangala PS', status: 'Registered', source: 'Online Portal' },
        { id: 'FIR-2024-002', time: '09:45 AM', type: 'Cyber Fraud', station: 'CEN Station', status: 'Pending Review', source: 'Kiosk' },
        { id: 'FIR-2024-003', time: '08:30 AM', type: 'Assault', station: 'Madiwala PS', status: 'Registered', source: 'In-Person' },
    ]);

    const [calls, setCalls] = useState([
        { id: 'CALL-998', time: '10:28 AM', duration: '45s', priority: 'High', location: 'SG Palya', status: 'Dispatched' },
        { id: 'CALL-997', time: '10:12 AM', duration: '1m 20s', priority: 'Medium', location: 'Sony Signal', status: 'Resolved' },
        { id: 'CALL-996', time: '09:55 AM', duration: '30s', priority: 'Low', location: 'Forum Mall', status: 'Ignored (Spam)' },
    ]);

    const [cctvLogs, setCctvLogs] = useState([
        { id: 'CAM-04', time: '10:29:15', event: 'Crowd Gathering', confidence: '88%', location: 'Sony Signal Junction' },
        { id: 'CAM-12', time: '10:28:40', event: 'Traffic Violation', confidence: '95%', location: 'Koramangala 80ft Rd' },
        { id: 'CAM-01', time: '10:25:10', event: 'Suspicious Object', confidence: '72%', location: 'Madiwala Market' },
    ]);

    // Simulate Data Stream
    useEffect(() => {
        const interval = setInterval(() => {
            const rand = Math.random();
            if (rand > 0.7) {
                // New Call
                const newCall = {
                    id: `CALL-${Math.floor(Math.random() * 1000)}`,
                    time: new Date().toLocaleTimeString(),
                    duration: '0s',
                    priority: Math.random() > 0.5 ? 'High' : 'Medium',
                    location: ZONES[Math.floor(Math.random() * ZONES.length)].name,
                    status: 'Incoming'
                };
                setCalls(prev => [newCall, ...prev].slice(0, 5));
            } else if (rand > 0.4) {
                // New CCTV Log
                const newLog = {
                    id: `CAM-${Math.floor(Math.random() * 50)}`,
                    time: new Date().toLocaleTimeString(),
                    event: ['Crowd Gathering', 'Traffic Violation', 'Suspicious Object'][Math.floor(Math.random() * 3)],
                    confidence: `${Math.floor(Math.random() * 20) + 80}%`,
                    location: ZONES[Math.floor(Math.random() * ZONES.length)].name
                };
                setCctvLogs(prev => [newLog, ...prev].slice(0, 5));
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-950 text-slate-200">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Database className="w-6 h-6 text-blue-500" />
                Data Ingestion Audit Log
            </h2>

            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* CITIZEN CHANNELS */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" /> Citizen Channels
                    </h3>

                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Online FIRs</h4>
                        <div className="space-y-2">
                            {firs.map(fir => (
                                <div key={fir.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                    <div>
                                        <div className="text-sm font-bold text-white">{fir.id} <span className="text-slate-500 font-normal">| {fir.type}</span></div>
                                        <div className="text-xs text-slate-400">{fir.station} • {fir.source}</div>
                                    </div>
                                    <div className="text-xs font-mono text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">{fir.status}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emergency Calls (112)</h4>
                        <div className="space-y-2">
                            {calls.map(call => (
                                <div key={call.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                    <div>
                                        <div className="text-sm font-bold text-white">{call.id} <span className="text-slate-500 font-normal">| {call.location}</span></div>
                                        <div className="text-xs text-slate-400">{call.time} • Duration: {call.duration}</div>
                                    </div>
                                    <div className={`text-xs font-bold px-2 py-1 rounded ${call.priority === 'High' ? 'bg-red-900/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>{call.priority}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI & SENSOR GRID */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-cyan-400" /> AI & Sensor Grid
                    </h3>

                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CCTV Analytics Stream</h4>
                        <div className="space-y-2">
                            {cctvLogs.map(log => (
                                <div key={log.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center border border-slate-600">
                                            <Activity className="w-4 h-4 text-cyan-500" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{log.event}</div>
                                            <div className="text-xs text-slate-400">{log.location}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-mono text-slate-300">{log.time}</div>
                                        <div className="text-[10px] text-cyan-400">{log.confidence} Conf.</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IoT / Traffic Sensors</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between">
                                <div className="text-xs text-slate-400">Traffic Density<br />(Sony Signal)</div>
                                <div className="text-xl font-bold text-red-400">92%</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between">
                                <div className="text-xs text-slate-400">AQI Level<br />(Madiwala)</div>
                                <div className="text-xl font-bold text-yellow-400">145</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FIELD OPS SUMMARY */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" /> Field Operations Status
                </h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-white">12</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Active Units</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-green-400">8</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Patrolling</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-blue-400">3</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Responding</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-yellow-400">1</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Station/Break</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

function App() {
    const [officers, setOfficers] = useState(INITIAL_OFFICERS);
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [selectedOfficer, setSelectedOfficer] = useState(null);
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [showOfficerModal, setShowOfficerModal] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState(true);
    const [patrolCarMode, setPatrolCarMode] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [movingOfficerId, setMovingOfficerId] = useState(null);
    const [routes, setRoutes] = useState([]);

    // AI State
    const [aiAdvice, setAiAdvice] = useState(null);
    const [generatingAdvice, setGeneratingAdvice] = useState(false);

    // Ingestion Logs State
    const [logs, setLogs] = useState([]);

    // VC Demo Mode State
    const [demoMode, setDemoMode] = useState(true);
    const [demoStage, setDemoStage] = useState('scanning');
    const [scenarioIndex, setScenarioIndex] = useState(0); // 0: Call, 1: Predictive, 2: Officer Request

    const [activeTab, setActiveTab] = useState('ops');

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Helper to add logs
    const addLog = useCallback((message, color = 'text-slate-400') => {
        setLogs(prev => [{ id: Date.now(), message, color, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    }, []);

    // OSRM Route Fetching
    const fetchRoute = async (start, end) => {
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]); // Convert to [lat, lng]
            }
        } catch (error) {
            console.error("Error fetching route:", error);
        }
        return null;
    };

    // Dispatch Logic
    const handleDispatch = useCallback(async (officerId) => {
        setDispatching(true);
        addLog(`Command confirmed. Syncing directives to unit device...`, 'text-yellow-400');

        const officer = officers.find(o => o.id === officerId);
        const incident = incidents.find(i => i.status !== 'assigned');

        if (officer && incident) {
            // Update statuses
            setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
            setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'assigned', assignedTo: officerId } : i));

            // Fetch route
            const routeGeometry = await fetchRoute(officer, incident);
            if (routeGeometry) {
                setRoutes(prev => [...prev, { id: incident.id, geometry: routeGeometry }]);
            }

            // Animate (simplified for now, just move to location after delay)
            setTimeout(() => {
                setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, lat: incident.lat, lng: incident.lng } : o));
                setMovingOfficerId(null);
                addLog(`Unit ${officer.name} arrived at location.`, 'text-green-400');
                setDispatching(false);
                setShowDispatchModal(false);
                setSelectedIncident(null);
                setAiAdvice(null);
                addLog(`Unit dispatched successfully. Route uploaded.`, 'text-green-400');
            }, 2000);
        } else {
            setDispatching(false);
        }
    }, [addLog, officers, incidents]);

    // Officer Click
    const handleOfficerClick = (officer) => {
        setSelectedOfficer(officer);
        setShowOfficerModal(true);
    };

    // AI Analysis
    const triggerAiAnalysis = (incident, officer) => {
        setGeneratingAdvice(true);
        setTimeout(() => {
            setAiAdvice(`**TACTICAL RECOMMENDATION**\n\n**Strategy**: Rapid containment via ${officer.vehicle}.\n**Route**: Minimize exposure to traffic congestion at Sony Signal.\n**Caution**: Suspect likely armed. Maintain 20m perimeter.`);
            setGeneratingAdvice(false);
        }, 1500);
    };

    // Demo Scenario Generator
    useEffect(() => {
        if (!demoMode) return;

        const interval = setInterval(() => {
            if (incidents.length < 3 && Math.random() > 0.7) {
                const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
                const newIncident = {
                    id: Date.now(),
                    type: zone.type,
                    lat: zone.lat + (Math.random() - 0.5) * 0.005,
                    lng: zone.lng + (Math.random() - 0.5) * 0.005,
                    location: zone.name,
                    time: new Date().toLocaleTimeString(),
                    status: 'pending',
                    desc: `Reported ${zone.type} in progress. multiple calls received.`,
                    assignedTo: null
                };
                setIncidents(prev => [...prev, newIncident]);
                addLog(`New Incident Detected: ${newIncident.type} at ${newIncident.location}`, 'text-red-400');
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [demoMode, incidents, addLog]);

    // Recommended Officers Calculation
    const recommendedOfficers = useMemo(() => {
        if (!selectedIncident) return [];
        return officers
            .map(o => ({
                ...o,
                distance: Math.round(calculateDistance(o.lat, o.lng, selectedIncident.lat, selectedIncident.lng) * 111000), // approx meters
                score: Math.floor(Math.random() * 30) + 70, // Mock score
                breakdown: { skill: 100, proximity: 80, fatigue: 100 - o.fatigue }
            }))
            .sort((a, b) => b.score - a.score);
    }, [selectedIncident, officers]);


    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* HEADER */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter text-white leading-none">DAMSTRIK <span className="text-blue-500">RPRT</span></h1>
                            <div className="text-[9px] font-mono text-slate-400 tracking-widest uppercase">Real-time Police Response & Tracking</div>
                        </div>
                    </div>
                    <div className="h-6 w-px bg-slate-800 mx-2"></div>
                    <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                        <button
                            onClick={() => setActiveTab('ops')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'ops' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <MapIcon className="w-3 h-3" /> Live Operations
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <FileText className="w-3 h-3" /> Audit Logs
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-300">LIVE FEED</span>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-mono font-bold text-white">{currentTime.toLocaleTimeString()}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">{currentTime.toLocaleDateString()}</div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT GRID */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'ops' ? (
                    <div className="grid grid-cols-12 gap-0 h-full">
                        {/* LEFT SIDEBAR */}
                        <div className="col-span-3 bg-slate-900/95 border-r border-slate-800 flex flex-col z-20 backdrop-blur-sm">
                            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800/50">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                    <Radio className="w-4 h-4 text-blue-500" />
                                    Active Units
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
                                {officers.map(officer => (
                                    <div
                                        key={officer.id}
                                        onClick={() => handleOfficerClick(officer)}
                                        className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${officer.status === 'busy' ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`relative w-2 h-2 rounded-full ${officer.status === 'busy' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                                                {officer.status === 'busy' && <div className="absolute inset-0 rounded-full animate-ping bg-blue-500 opacity-75"></div>}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white leading-tight">{officer.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{officer.skill[0]} Specialist</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[10px] font-bold uppercase ${officer.status === 'busy' ? 'text-blue-400' : 'text-slate-500'}`}>{officer.status}</div>
                                            <div className={`text-[10px] font-mono mt-0.5 ${officer.fatigue > 50 ? 'text-yellow-500' : 'text-emerald-500'}`}>{officer.fatigue}% FTG</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Field Ops Summary */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-800 p-2 rounded text-center">
                                        <div className="text-lg font-bold text-white">{officers.filter(o => o.status === 'patrol').length}</div>
                                        <div className="text-[9px] text-slate-400 uppercase">Patrolling</div>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded text-center">
                                        <div className="text-lg font-bold text-blue-400">{officers.filter(o => o.status === 'busy').length}</div>
                                        <div className="text-[9px] text-slate-400 uppercase">Responding</div>
                                    </div>
                                </div>
                            </div>
                            className={`px-4 py-2 text-xs font-bold rounded shadow-lg backdrop-blur-md border transition-all ${heatmapMode ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/20' : 'bg-slate-900/80 border-slate-700 text-slate-400'}`}
                                    >
                            <Activity className="w-3 h-3 inline mr-2" />
                            PREDICTIVE ZONES
                        </button>
                        <button
                            onClick={() => setPatrolCarMode(!patrolCarMode)}
                            className={`px-4 py-2 text-xs font-bold rounded shadow-lg backdrop-blur-md border transition-all ${patrolCarMode ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/20' : 'bg-slate-900/80 border-slate-700 text-slate-400'}`}
                        >
                            <Navigation className="w-3 h-3 inline mr-2" />
                            PATROL CARS
                        </button>
                    </div>
                            </div>

            {/* Ingestion Logs */}
            <IngestionLogs logs={logs} />
        </div>

                        {/* RIGHT SIDEBAR */ }
    <div className="col-span-3 bg-slate-900/95 border-l border-slate-800 flex flex-col z-20 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                Intelligence Feed
            </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {incidents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                        <Wifi className="w-16 h-16 relative z-10 animate-pulse" />
                    </div>
                    <p className="text-xs font-mono tracking-widest">SCANNING NETWORK...</p>
                </div>
            ) : (
                incidents.map(inc => (
                    <div key={inc.id} className={`relative p-4 rounded-xl border transition-all animate-in slide-in-from-right duration-500 ${inc.status === 'assigned' ? 'bg-slate-800/50 border-emerald-500/30' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'}`}>
                        {inc.status === 'pending' && <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}

                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${CRIME_TYPES[inc.type].color} ${CRIME_TYPES[inc.type].bg} ${CRIME_TYPES[inc.type].border}`}>
                                {CRIME_TYPES[inc.type].label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{inc.time}</span>
                        </div>

                        <h3 className="font-bold text-white text-sm mb-1 leading-tight">{inc.location}</h3>
                        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed border-l-2 border-slate-700 pl-2">{inc.desc}</p>

                        {inc.status === 'pending' ? (
                            <button
                                onClick={() => {
                                    setSelectedIncident(inc);
                                    setShowDispatchModal(true);
                                }}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02]"
                            >
                                <Zap className="w-3 h-3 fill-current" />
                                Initiate Protocol
                            </button>
                        ) : (
                            <div className="mt-3 p-2 bg-emerald-900/10 rounded border border-emerald-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30">
                                        <Navigation className="w-3 h-3 text-emerald-400" />
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-slate-400 text-[9px] uppercase">Responding Unit</div>
                                        <div className="text-white font-bold">{officers.find(o => o.id === inc.assignedTo)?.name.split(' ').slice(1).join(' ')}</div>
                                    </div>
                                </div>
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    </div>
                    </div >
                ) : (
        <AuditDashboard />
    )
}
            </div >

    {/* DISPATCH MODAL */ }
{
    showDispatchModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-400 fill-current animate-pulse" />
                            AI Response Recommendation
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-1 tracking-wider">GENESIS ONTOLOGY ENGINE • V2.4</p>
                    </div>
                    {!demoMode && (
                        <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>

                {/* AI Breakdown */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
                    {/* Gemini AI Section */}
                    <div className="mb-6 p-4 rounded-xl border border-blue-500/30 bg-blue-900/10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Tactical Analysis (Gemini 2.5)</span>
                        </div>
                        {generatingAdvice ? (
                            <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                                <BrainCircuit className="w-4 h-4 animate-spin text-blue-500" />
                                Running Strategic Assessment...
                            </div>
                        ) : aiAdvice ? (
                            <div className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-line">
                                {aiAdvice}
                            </div>
                        ) : (
                            <button
                                onClick={() => triggerAiAnalysis(selectedIncident, recommendedOfficers[0])}
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1.5 rounded border border-slate-600 transition-colors"
                            >
                                Generate Tactical Strategy
                            </button>
                        )}
                    </div>

                    <div className="mb-6 grid grid-cols-3 gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Incident Profile</div>
                            <div className={`text-sm font-bold ${CRIME_TYPES[selectedIncident.type].color}`}>{CRIME_TYPES[selectedIncident.type].label}</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Location Risk</div>
                            <div className="text-sm font-bold text-red-400">High Density Zone</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Required Asset</div>
                            <div className="text-sm font-bold text-white">Patrol + CCTV Link</div>
                        </div>
                    </div>

                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Available Units (Ranked by AI)</h3>

                    <div className="space-y-3">
                        {recommendedOfficers.map((match, idx) => (
                            <div key={match.id} className={`group relative p-4 rounded-xl border transition-all duration-300 ${idx === 0 ? 'bg-blue-900/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] scale-[1.01]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}>
                                {idx === 0 && (
                                    <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-lg border border-blue-400 flex items-center gap-1">
                                        <Award className="w-3 h-3" /> BEST FIT
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-5">
                                        <div className="relative w-14 h-14 flex items-center justify-center">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="28" cy="28" r="24" stroke="#1e293b" strokeWidth="4" fill="none" />
                                                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none"
                                                    strokeDasharray={150}
                                                    strokeDashoffset={150 - (150 * match.score) / 100}
                                                    className={`${match.score > 80 ? 'text-emerald-500' : 'text-yellow-500'} transition-all duration-1000`}
                                                />
                                            </svg>
                                            <span className="absolute text-sm font-bold text-white">{match.score}</span>
                                        </div>

                                        <div>
                                            <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">{match.name}</h4>
                                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                                <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {match.distance}m away</span>
                                                <span className="flex items-center gap-1"><Battery className="w-3 h-3" /> {match.fatigue}% Fatigue</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDispatch(match.id)}
                                        disabled={dispatching || (demoMode && idx !== 0)}
                                        className={`px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${dispatching && idx === 0 ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-blue-600'}`}
                                    >
                                        {dispatching && idx === 0 ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Syncing...
                                            </>
                                        ) : (
                                            <>Dispatch Unit <ChevronRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

{/* OFFICER DETAIL MODAL */ }
{
    showOfficerModal && selectedOfficer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600">
                            <span className="text-xl font-bold text-white">{selectedOfficer.name.charAt(0)}</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{selectedOfficer.name}</h2>
                            <p className="text-xs text-slate-400">{selectedOfficer.badge} • {selectedOfficer.vehicle}</p>
                        </div>
                    </div>
                    <button onClick={() => setShowOfficerModal(false)} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Service History</div>
                            <div className="text-sm font-semibold text-white">{selectedOfficer.history}</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Fatigue</div>
                            <div className={`text-sm font-semibold ${selectedOfficer.fatigue > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{selectedOfficer.fatigue}%</div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><Award className="w-4 h-4 text-blue-400" /> Specialization</h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedOfficer.skill.map(s => (
                                <span key={s} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-900/50">{s}</span>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded border border-slate-800">
                            {selectedOfficer.specialization_desc}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
        </div >
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

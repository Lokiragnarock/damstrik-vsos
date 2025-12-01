import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Shield, Map as MapIcon, Radio, Users, Bell, Search, Activity, Clock, CheckCircle, AlertTriangle, Zap, Navigation, Battery, Award, ChevronRight, X, Target, Wifi, Database, Play, Pause, Sparkles, BrainCircuit, CloudRain, TrendingUp, FileText, PhoneCall, Mic, Server
} from 'lucide-react';

// --- GEMINI API INTEGRATION ---
const apiKey = ""; // API Key injected by environment

const callGeminiStrategy = async (incident, officer) => {
    if (!apiKey) {
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

// --- ROAD NETWORK GRAPH (Bangalore - Koramangala/Madiwala Layout) ---
// Nodes represent major intersections. Edges represent roads.
const ROAD_NODES = {
    'SonySignal': { lat: 12.9450, lng: 77.6250, id: 'SonySignal', name: 'Sony World Signal' },
    'ChristUniv': { lat: 12.9360, lng: 77.6050, id: 'ChristUniv', name: 'Christ University' },
    'MadiwalaMkt': { lat: 12.9220, lng: 77.6180, id: 'MadiwalaMkt', name: 'Madiwala Market' },
    'Koramangala5th': { lat: 12.9340, lng: 77.6200, id: 'Koramangala5th', name: 'Koramangala 5th Block' },
    'ForumMall': { lat: 12.9350, lng: 77.6100, id: 'ForumMall', name: 'Forum Mall' },
    'StJohns': { lat: 12.9300, lng: 77.6200, id: 'StJohns', name: 'St. Johns Signal' }, // Central Hub
    'DairyCircle': { lat: 12.9380, lng: 77.6000, id: 'DairyCircle', name: 'Dairy Circle' },
    'BTMJunction': { lat: 12.9150, lng: 77.6100, id: 'BTMJunction', name: 'BTM Junction' },
    'Indiranagar100ft': { lat: 12.9600, lng: 77.6400, id: 'Indiranagar100ft', name: 'Indiranagar 100ft' },
    'WiproPark': { lat: 12.9320, lng: 77.6300, id: 'WiproPark', name: 'Wipro Park' },
    'Koramangala80ft': { lat: 12.9400, lng: 77.6200, id: 'Koramangala80ft', name: '80ft Road' },
    'JyotiNivas': { lat: 12.9330, lng: 77.6150, id: 'JyotiNivas', name: 'Jyoti Nivas College' },
    'CheckPost': { lat: 12.9250, lng: 77.6250, id: 'CheckPost', name: 'Check Post' }
};

const ROAD_EDGES = [
    ['SonySignal', 'StJohns'],
    ['SonySignal', 'Indiranagar100ft'],
    ['ChristUniv', 'StJohns'],
    ['ChristUniv', 'DairyCircle'],
    ['ChristUniv', 'BTMJunction'],
    ['MadiwalaMkt', 'StJohns'],
    ['MadiwalaMkt', 'BTMJunction'],
    ['Koramangala5th', 'StJohns'],
    ['Koramangala5th', 'ForumMall'],
    ['DairyCircle', 'ForumMall'],
    ['StJohns', 'Indiranagar100ft'] // Ring Road connection
];

// Build Adjacency List
const ADJ_LIST = {};
Object.keys(ROAD_NODES).forEach(id => ADJ_LIST[id] = []);
ROAD_EDGES.forEach(([a, b]) => {
    ADJ_LIST[a].push(b);
    ADJ_LIST[b].push(a);
});

// Helper: Find nearest road node to any point
const getNearestNode = (lat, lng) => {
    let min = Infinity;
    let nearest = null;
    Object.values(ROAD_NODES).forEach(node => {
        const d = Math.sqrt((node.lat - lat) ** 2 + (node.lng - lng) ** 2);
        if (d < min) {
            min = d;
            nearest = node;
        }
    });
    return nearest;
};

const calculateDistance = (lat1, lng1, lat2, lng2) => Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));

// A* Pathfinding
const findPath = (startNodeId, endNodeId) => {
    const openSet = [startNodeId];
    const cameFrom = {};
    const gScore = {};
    const fScore = {};

    Object.keys(ROAD_NODES).forEach(id => {
        gScore[id] = Infinity;
        fScore[id] = Infinity;
    });

    gScore[startNodeId] = 0;
    fScore[startNodeId] = calculateDistance(ROAD_NODES[startNodeId].lat, ROAD_NODES[startNodeId].lng, ROAD_NODES[endNodeId].lat, ROAD_NODES[endNodeId].lng);

    while (openSet.length > 0) {
        // Get node with lowest fScore
        let current = openSet.reduce((a, b) => fScore[a] < fScore[b] ? a : b);

        if (current === endNodeId) {
            // Reconstruct path
            const path = [current];
            while (current in cameFrom) {
                current = cameFrom[current];
                path.unshift(current);
            }
            return path;
        }

        openSet.splice(openSet.indexOf(current), 1);

        for (let neighbor of ADJ_LIST[current]) {
            const tentativeGScore = gScore[current] + calculateDistance(ROAD_NODES[current].lat, ROAD_NODES[current].lng, ROAD_NODES[neighbor].lat, ROAD_NODES[neighbor].lng);

            if (tentativeGScore < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + calculateDistance(ROAD_NODES[neighbor].lat, ROAD_NODES[neighbor].lng, ROAD_NODES[endNodeId].lat, ROAD_NODES[endNodeId].lng);
                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return [startNodeId, endNodeId]; // Fallback direct line if no path
};

// --- MOCK BACKEND DATA ---

const ZONES = [
    { id: 'z1', name: 'Koramangala 5th Block', lat: 12.934, lng: 77.62, risk: 'high', type: 'theft', radius: 300 }, // Radius in meters
    { id: 'z2', name: 'SG Palya (Christ Univ)', lat: 12.938, lng: 77.60, risk: 'medium', type: 'public_order', radius: 250 },
    { id: 'z3', name: 'Sony Signal', lat: 12.945, lng: 77.625, risk: 'low', type: 'traffic', radius: 200 },
    { id: 'z4', name: 'Madiwala Market', lat: 12.922, lng: 77.618, risk: 'high', type: 'assault', radius: 350 },
];

const INITIAL_OFFICERS = [
    {
        id: 'o1',
        name: 'ASI Rajesh Kumar',
        badge: 'KA-05-221',
        skill: ['Public Order', 'Mediation'],
        fatigue: 12,
        status: 'patrol',
        lat: 12.935, lng: 77.622,
        vehicle: 'Hoysala',
        history: '15 Years Service • 92% Clearance Rate',
        specialization_desc: 'Expert in community mediation and de-escalation.'
    },
    {
        id: 'o2',
        name: 'HC Suresh Menon',
        badge: 'KA-05-882',
        skill: ['Theft', 'Surveillance'],
        fatigue: 45,
        status: 'patrol',
        lat: 12.948, lng: 77.628,
        vehicle: 'Cheetah',
        history: '8 Years Service • 78% Clearance Rate',
        specialization_desc: 'Specialized in urban surveillance and theft tracking.'
    },
    {
        id: 'o3',
        name: 'WPC Lakshmi N',
        badge: 'KA-05-441',
        skill: ['Women Safety', 'Counseling'],
        fatigue: 5,
        status: 'patrol',
        lat: 12.936, lng: 77.605,
        vehicle: 'Pink Hoysala',
        history: '4 Years Service • 98% Clearance Rate',
        specialization_desc: 'Dedicated to women safety and victim counseling.'
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
    public_order: { label: 'Public Disturbance', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', mapColor: '#eab308' },
    traffic: { label: 'Traffic Gridlock', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', mapColor: '#3b82f6' },
    predictive: { label: 'AI Prediction', color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500', mapColor: '#06b6d4' },
    murder: { label: 'Homicide', color: 'text-rose-600', bg: 'bg-rose-600/20', border: 'border-rose-600', mapColor: '#e11d48' }
};

// --- LOGIC HELPERS ---

const calculateFitScore = (officer, incident) => {
    const dist = calculateDistance(officer.lat, officer.lng, incident.lat, incident.lng);

    // STRICT REQUIREMENT: Proximity ONLY for initial dispatch.
    // "No use of skill if its rampant and running unchecked"
    // Distance is in degrees approx. 0.01 deg ~= 1km.
    // So 100 - dist * 10000 might be better scale?
    // Let's just normalize it roughly. 0.05 deg is far.
    const proximityScore = Math.max(0, 100 - dist * 2000);

    return {
        score: Math.round(proximityScore), // Pure proximity score
        breakdown: { proximity: Math.round(proximityScore), skill: 0, fatigue: 0 },
        distance: Math.round(dist * 111000) // Approx meters
    };
};

// --- VISUAL COMPONENTS ---

const RadarScanner = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-20">
        <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,197,94,0.1)_60deg,transparent_60deg)] animate-[spin_4s_linear_infinite] rounded-full opacity-30"></div>
    </div>
);

// Leaflet handles routes, so we don't need this SVG overlay anymore, but keeping it as null for now to avoid breaking references
const RouteLine = ({ path }) => {
    return null;
};

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

// --- MAIN APP COMPONENT ---
export default function App() {
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
    const [activeRoutes, setActiveRoutes] = useState({}); // { incidentId: [nodeId, nodeId...] }

    // AI State
    const [aiAdvice, setAiAdvice] = useState(null);
    const [generatingAdvice, setGeneratingAdvice] = useState(false);

    // Ingestion Logs State
    const [logs, setLogs] = useState([]);

    // VC Demo Mode State
    const [demoMode, setDemoMode] = useState(true);
    const [demoStage, setDemoStage] = useState('scanning');
    const [scenarioIndex, setScenarioIndex] = useState(0); // 0: Call, 1: Predictive, 2: Officer Request

    const addLog = useCallback((msg, color = 'text-slate-300') => {
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev.slice(-20), { time, msg, color }]);
    }, []);

    // --- LOGIC: REPOSITION OTHERS (COVERAGE ALGO) ---
    const repositionOthers = useCallback((dispatchedOfficerId, targetLat, targetLng) => {
        setOfficers(prev => prev.map(o => {
            if (o.id === dispatchedOfficerId || o.status === 'busy') return o;

            // Move towards nearest road node to stay "on grid"
            const nearestNode = getNearestNode(o.lat, o.lng);
            if (nearestNode) {
                // Slowly drift to nearest intersection if idle
                return { ...o, lat: o.lat + (nearestNode.lat - o.lat) * 0.05, lng: o.lng + (nearestNode.lng - o.lng) * 0.05 };
            }
            return o;
        }));
    }, []);

    // --- LOGIC: HANDLE DISPATCH ---
    const handleDispatch = useCallback((officerId) => {
        setDispatching(true);
        addLog(`Command confirmed. Syncing directives to unit device...`, 'text-yellow-400');

        setTimeout(() => {
            const officer = officers.find(o => o.id === officerId);
            const incident = incidents.find(i => i.status !== 'assigned');

            if (!officer || !incident) {
                setDispatching(false);
                return;
            }

            // 1. Calculate Path on Road Network
            const startNode = getNearestNode(officer.lat, officer.lng);
            const endNode = getNearestNode(incident.lat, incident.lng);
            const pathIds = findPath(startNode.id, endNode.id);

            // Store route for visualization
            setActiveRoutes(prev => ({ ...prev, [incident.id]: pathIds }));

            // 2. Trigger Repositioning
            repositionOthers(officerId, officer.lat, officer.lng);

            // 3. Update Status
            setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
            setIncidents(prev => prev.map(i => i.status !== 'assigned' ? { ...i, status: 'assigned', assignedTo: officerId } : i));

            // 4. Animate Movement along Path
            setMovingOfficerId(officerId);

            // Waypoints for curved roads (approximate visual path)
            const ROAD_WAYPOINTS = {
                'SonySignal-StJohns': [{ lat: 12.9400, lng: 77.6240 }, { lat: 12.9350, lng: 77.6230 }],
                'StJohns-SonySignal': [{ lat: 12.9350, lng: 77.6230 }, { lat: 12.9400, lng: 77.6240 }],
                'SonySignal-Indiranagar100ft': [{ lat: 12.9500, lng: 77.6300 }, { lat: 12.9550, lng: 77.6350 }],
                'Indiranagar100ft-SonySignal': [{ lat: 12.9550, lng: 77.6350 }, { lat: 12.9500, lng: 77.6300 }],
                'StJohns-CheckPost': [{ lat: 12.9280, lng: 77.6220 }],
                'CheckPost-StJohns': [{ lat: 12.9280, lng: 77.6220 }],
                'MadiwalaMkt-StJohns': [{ lat: 12.9250, lng: 77.6190 }],
                'StJohns-MadiwalaMkt': [{ lat: 12.9250, lng: 77.6190 }]
            };

            let currentPathIndex = 0;
            const moveAlongPath = () => {
                if (currentPathIndex >= pathIds.length - 1) {
                    // Arrived (End of path)
                    setMovingOfficerId(null);
                    addLog(`Unit ${officer.name} arrived at location.`, 'text-green-400');

                    // Stay in spot logic
                    setTimeout(() => {
                        setOfficers(prev => prev.map(o => {
                            if (o.id === officerId) {
                                return { ...o, status: 'patrol', lat: incident.lat, lng: incident.lng };
                            }
                            return o;
                        }));
                        setActiveRoutes(prev => {
                            const newRoutes = { ...prev };
                            delete newRoutes[incident.id];
                            return newRoutes;
                        });
                        addLog(`Unit ${officer.name} resolved incident. Holding position.`, 'text-slate-400');
                    }, 15000);
                    return;
                }

                const currentNodeId = pathIds[currentPathIndex];
                const nextNodeId = pathIds[currentPathIndex + 1];
                const targetNode = ROAD_NODES[nextNodeId];

                // Check for waypoints
                const edgeKey = `${currentNodeId}-${nextNodeId}`;
                const waypoints = ROAD_WAYPOINTS[edgeKey] || [];

                // Construct full segment path: [Waypoints..., TargetNode]
                const segmentPoints = [...waypoints, { lat: targetNode.lat, lng: targetNode.lng }];

                let segmentIndex = 0;

                const animateSegment = () => {
                    if (segmentIndex >= segmentPoints.length) {
                        currentPathIndex++;
                        moveAlongPath();
                        return;
                    }

                    const targetPoint = segmentPoints[segmentIndex];
                    const steps = 60; // 1 second per segment
                    let step = 0;

                    const segmentInterval = setInterval(() => {
                        step++;
                        setOfficers(prev => prev.map(o => {
                            if (o.id === officerId) {
                                const dLat = (targetPoint.lat - o.lat) / (steps - step + 1);
                                const dLng = (targetPoint.lng - o.lng) / (steps - step + 1);
                                return { ...o, lat: o.lat + dLat, lng: o.lng + dLng };
                            }
                            return o;
                        }));

                        if (step >= steps) {
                            clearInterval(segmentInterval);
                            segmentIndex++;
                            animateSegment();
                        }
                    }, 16);
                };

                animateSegment();
            };

            moveAlongPath();

        }, 2000);
    }, [addLog, officers, incidents, repositionOthers]);

    // --- LOGIC: TRIGGER AI ADVICE ---
    const triggerAiAnalysis = useCallback(async (incident, topOfficer) => {
        setGeneratingAdvice(true);
        addLog(`Requesting Genesis AI tactical assessment for Incident #${incident.id.slice(-4)}...`, 'text-blue-400');
        const advice = await callGeminiStrategy(incident, topOfficer);
        setAiAdvice(advice);
        setGeneratingAdvice(false);
        addLog(`Genesis AI assessment received. Confidence: 94%.`, 'text-blue-400');
    }, [addLog]);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // AI Logic Recommendation
    const recommendedOfficers = useMemo(() => {
        if (!selectedIncident) return [];
        return officers
            .filter(o => o.status !== 'busy')
            .map(o => ({ ...o, ...calculateFitScore(o, selectedIncident) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }, [selectedIncident, officers]);

    // AUTOMATED DEMO WORKFLOW - DYNAMIC SCENARIOS
    useEffect(() => {
        if (!demoMode) return;

        let timer;

        const advanceStage = () => {
            switch (demoStage) {
                case 'scanning':
                    // Slow down new events (12s)
                    timer = setTimeout(() => {
                        setDemoStage('detected');

                        const currentScenario = scenarioIndex % 3;
                        let newIncident = {};
                        if (currentScenario === 0) {
                            addLog("INCOMING CALL: +91-98XXX-XXXX (Tower: SG Palya)", 'text-red-400');
                            addLog("Voice-to-Text Active... Transcribing...", 'text-red-300');
                            setTimeout(() => addLog("Keyword Detected: 'Snatch', 'Bike', 'Help'", 'text-red-400'), 1000);
                            newIncident = { id: `inc-${Date.now()}`, type: 'theft', location: 'SG Palya Main Road', time: 'Just Now', status: 'pending', priority: 'high', lat: 12.9352, lng: 77.6093, desc: 'Two wheeler snatch & grab reported near Christ University Gate 1. Victim reporting via Dial 112.' };
                        } else if (currentScenario === 1) {
                            addLog("Predictive Model Alert: Crowd Density Critical > 85%", 'text-cyan-400');
                            addLog("Correlation: Weather (Rain) + Traffic (High) -> Risk of Public Disorder", 'text-cyan-300');
                            newIncident = { id: `inc-${Date.now()}`, type: 'predictive', location: 'Sony Signal Junction', time: 'Forecast (+15m)', status: 'pending', priority: 'medium', lat: 12.9400, lng: 77.6240, desc: 'AI Forecast: High probability of traffic deadlock leading to public disorder. Pre-emptive patrol requested.' };
                        } else {
                            addLog("RADIO SIGNAL: Unit KA-05-334 Requesting Assist", 'text-purple-400');
                            addLog("Signal Triangulation: Madiwala Market", 'text-purple-300');
                            newIncident = { id: `inc-${Date.now()}`, type: 'assault', location: 'Madiwala Market', time: 'Live Feed', status: 'pending', priority: 'critical', lat: 12.9250, lng: 77.6190, desc: 'Officer Arun Gowda requesting immediate backup. Active altercation in progress.' };
                        }
                        setIncidents([newIncident]);
                    }, 12000);
                    break;

                case 'detected':
                    timer = setTimeout(() => {
                        setDemoStage('analyzing');
                    }, 4000);
                    break;

                case 'analyzing':
                    const incident = incidents[0];
                    if (incident) {
                        setSelectedIncident(incident);
                        setShowDispatchModal(true);
                        addLog("Calculating Officer Fit Scores (Skill vs Distance vs Fatigue)...", 'text-yellow-300');

                        const bestOfficer = officers
                            .filter(o => o.status !== 'busy')
                            .map(o => ({ ...o, ...calculateFitScore(o, incident) }))
                            .sort((a, b) => b.score - a.score)[0];

                        if (bestOfficer) {
                            triggerAiAnalysis(incident, bestOfficer);
                        }
                    }
                    timer = setTimeout(() => {
                        setDemoStage('dispatching');
                    }, 8000); // Allow time to read analysis
                    break;

                case 'dispatching':
                    const bestOfficer = officers
                        .filter(o => o.status !== 'busy')
                        .map(o => ({ ...o, ...calculateFitScore(o, incidents[0]) }))
                        .sort((a, b) => b.score - a.score)[0];

                    if (bestOfficer) {
                        addLog(`Auto-Authorizing Dispatch for Officer ${bestOfficer?.name}...`, 'text-green-300');
                        handleDispatch(bestOfficer.id);
                    }
                    timer = setTimeout(() => {
                        setDemoStage('resolved');
                    }, 2000);
                    break;

                case 'resolved':
                    // Wait for resolution (linked to handleDispatch timeout)
                    timer = setTimeout(() => {
                        setScenarioIndex(prev => prev + 1);
                        setIncidents([]);
                        // DO NOT RESET OFFICERS
                        setShowDispatchModal(false);
                        setAiAdvice(null);
                        setDemoStage('scanning');
                    }, 20000);
                    break;
            }
        };

        advanceStage();
        return () => clearTimeout(timer);
    }, [demoMode, demoStage]); // Main driver

    // Handle Officer Click
    const handleOfficerClick = (officer) => {
        if (!demoMode) {
            setSelectedOfficer(officer);
            setShowOfficerModal(true);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">

            {/* HEADER */}
            <header className="flex-none h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-6 z-40 relative shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.6)]">
                        <Shield className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-wider text-white">DAMSTRIK <span className="text-blue-500">RPRT</span></h1>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            System Online
                            <span className="text-slate-600">|</span>
                            {demoMode ? <span className="text-yellow-400 font-bold animate-pulse">AI PILOT: {demoStage.toUpperCase()} (SCENARIO {scenarioIndex % 3 + 1})</span> : 'MANUAL COMMAND'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setDemoMode(!demoMode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${demoMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                    >
                        {demoMode ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {demoMode ? 'PAUSE AI PILOT' : 'ENGAGE AI PILOT'}
                    </button>

                    <div className="flex items-center gap-4 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-mono text-white">{currentTime.toLocaleTimeString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                        JD
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT GRID */}
            <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden relative">

                {/* LEFT SIDEBAR */}
                <div className="col-span-3 bg-slate-900/95 border-r border-slate-800 flex flex-col z-20 backdrop-blur-sm">
                    <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800/50">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Database className="w-4 h-4" /> Context Data
                        </h2>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 shadow-sm">
                                <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1"><CloudRain className="w-3 h-3" /> Weather</div>
                                <div className="text-xl font-bold text-white tracking-tight">Rainy</div>
                                <div className="text-[10px] text-blue-400">High Risk: Accidents</div>
                            </div>
                            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 shadow-sm">
                                <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Forecast</div>
                                <div className="text-xl font-bold text-red-400 tracking-tight">+15%</div>
                                <div className="text-[10px] text-slate-400">Crime Probability</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Officer Database</div>
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
                </div>

                {/* CENTER MAP */}
                <div className="col-span-6 relative bg-slate-950 overflow-hidden group flex flex-col">
                    <div className="flex-1 relative z-0">
                        <MapContainer
                            center={[12.935, 77.62]}
                            zoom={14}
                            style={{ height: '100%', width: '100%', background: '#0f172a' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />

                            {/* ZONES */}
                            {heatmapMode && ZONES.map(zone => (
                                <Circle
                                    key={zone.id}
                                    center={[zone.lat, zone.lng]}
                                    radius={zone.radius}
                                    pathOptions={{
                                        color: CRIME_TYPES[zone.type].mapColor,
                                        fillColor: CRIME_TYPES[zone.type].mapColor,
                                        fillOpacity: 0.2,
                                        weight: 1
                                    }}
                                />
                            ))}

                            {/* ROUTES */}
                            {Object.entries(activeRoutes).map(([incId, pathIds]) => {
                                const positions = pathIds.map(id => [ROAD_NODES[id].lat, ROAD_NODES[id].lng]);
                                return <Polyline key={incId} positions={positions} pathOptions={{ color: '#22c55e', dashArray: '5, 10', weight: 2 }} />;
                            })}

                            {/* OFFICERS */}
                            {patrolCarMode && officers.map(officer => (
                                <Marker
                                    key={officer.id}
                                    position={[officer.lat, officer.lng]}
                                    icon={L.divIcon({
                                        className: 'custom-leaflet-icon',
                                        html: `<div class="relative w-8 h-8 flex items-center justify-center">
                                                 <div class="w-8 h-8 rounded-full border-2 ${officer.status === 'busy' ? 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.8)]' : 'bg-slate-900 border-blue-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]'} flex items-center justify-center transition-all">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transform ${officer.status === 'busy' ? 'animate-pulse' : 'rotate-45'}"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                                                 </div>
                                               </div>`,
                                        iconSize: [32, 32],
                                        iconAnchor: [16, 16]
                                    })}
                                    eventHandlers={{
                                        click: () => handleOfficerClick(officer),
                                    }}
                                />
                            ))}
                        </MapContainer>

                        <div className="absolute inset-0 z-10 bg-blue-900/5 pointer-events-none"></div>
                        <RadarScanner />

                        {/* Controls */}
                        <div className="absolute top-4 left-4 z-30 flex gap-2">
                            <button
                                onClick={() => setHeatmapMode(!heatmapMode)}
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

                    {/* INGESTION LOGS */}
                    <IngestionLogs logs={logs} />
                </div>

                {/* RIGHT SIDEBAR */}
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
            </div>

            {/* DISPATCH MODAL */}
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

                                {/* --- NEW GEMINI AI SECTION --- */}
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
                                                    {/* Score Gauge */}
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
                                                    disabled={dispatching || (demoMode && idx !== 0)} // In demo mode, only top rank works automatically
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

                                            {/* Explainability Tags */}
                                            <div className="mt-3 pl-[4.5rem] flex gap-2">
                                                {match.breakdown.skill === 100 && (
                                                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                                        <CheckCircle className="w-3 h-3" /> Skill Match
                                                    </span>
                                                )}
                                                {match.distance < 30 && (
                                                    <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                                                        <MapIcon className="w-3 h-3" /> High Proximity
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* OFFICER DETAIL MODAL */}
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
                                <div>
                                    <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-400" /> Recent Activity</h4>
                                    <ul className="text-xs text-slate-400 space-y-2">
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Resolved public dispute at SG Palya (2h ago)</li>
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Routine patrol check at Sony Signal (4h ago)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

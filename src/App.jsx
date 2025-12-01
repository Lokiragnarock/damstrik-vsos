import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// --- MOCK BACKEND DATA ---

const ZONES = [
    { id: 'z1', name: 'Koramangala 5th Block', lat: 12.934, lng: 77.62, risk: 'high', type: 'theft', radius: 18 },
    { id: 'z2', name: 'SG Palya (Christ Univ)', lat: 12.938, lng: 77.60, risk: 'medium', type: 'public_order', radius: 15 },
    { id: 'z3', name: 'Sony Signal', lat: 12.945, lng: 77.625, risk: 'low', type: 'traffic', radius: 12 },
    { id: 'z4', name: 'Madiwala Market', lat: 12.922, lng: 77.618, risk: 'high', type: 'assault', radius: 20 },
];

const INITIAL_OFFICERS = [
    {
        id: 'o1',
        name: 'ASI Rajesh Kumar',
        badge: 'KA-05-221',
        skill: ['Theft', 'Burglary'],
        fatigue: 15,
        status: 'patrol',
        x: 25, y: 35,
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
        x: 50, y: 55,
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
        x: 10, y: 10,
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
        x: 82, y: 75,
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
        x: 65, y: 25,
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

const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

const calculateFitScore = (officer, incident) => {
    const dist = calculateDistance(officer.x, officer.y, incident.x, incident.y);
    const proximityScore = Math.max(0, 100 - dist * 1.5);

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
        distance: Math.round(dist * 10) // Mock meters
    };
};

// --- VISUAL COMPONENTS ---

const RadarScanner = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-20">
        <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,197,94,0.1)_60deg,transparent_60deg)] animate-[spin_4s_linear_infinite] rounded-full opacity-30"></div>
    </div>
);

const RouteLine = ({ start, end }) => {
    if (!start || !end) return null;
    const x1 = `${start.x}%`;
    const y1 = `${start.y}%`;
    const x2 = `${end.x}%`;
    const y2 = `${end.y}%`;

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
                </marker>
            </defs>
            <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#22c55e"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
                className="animate-pulse opacity-80"
            />
        </svg>
    );
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
        setLogs(prev => [...prev.slice(-20), { time, msg, color }]); // Keep last 20 logs
    }, []);

    // --- LOGIC: HANDLE DISPATCH ---
    const handleDispatch = useCallback((officerId) => {
        setDispatching(true);
        addLog(`Command confirmed. Syncing directives to unit device...`, 'text-yellow-400');

        setTimeout(() => {
            // Find officer and incident to animate movement
            const officer = officers.find(o => o.id === officerId);
            const incident = incidents.find(i => i.status !== 'assigned'); // Assuming single active incident for now or passing it

            // Update Officer Status to Busy
            setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
            // Update Incident Status to Assigned
            setIncidents(prev => prev.map(i => i.status !== 'assigned' ? { ...i, status: 'assigned', assignedTo: officerId } : i));

            // Start movement animation if we found both
            if (officer && incident) {
                setMovingOfficerId(officerId);
                // Animate movement over 2 seconds
                const steps = 60;
                const dx = (incident.x - officer.x) / steps;
                const dy = (incident.y - officer.y) / steps;
                let step = 0;

                const moveInterval = setInterval(() => {
                    step++;
                    setOfficers(prev => prev.map(o => {
                        if (o.id === officerId) {
                            return { ...o, x: o.x + dx, y: o.y + dy };
                        }
                        return o;
                    }));

                    if (step >= steps) {
                        clearInterval(moveInterval);
                        setMovingOfficerId(null);
                        addLog(`Unit ${officer.name} arrived at location.`, 'text-green-400');
                    }
                }, 16); // ~60fps
            }

            setDispatching(false);
            setShowDispatchModal(false);
            setSelectedIncident(null);
            setAiAdvice(null);
            addLog(`Unit dispatched successfully. Route uploaded.`, 'text-green-400');
        }, 1500);
    }, [addLog, officers, incidents]);

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
                    timer = setTimeout(() => {
                        setDemoStage('detected');

                        // LOGIC FOR DETECTION
                        const currentScenario = scenarioIndex % 3;
                        let newIncident = {};
                        if (currentScenario === 0) {
                            addLog("INCOMING CALL: +91-98XXX-XXXX (Tower: SG Palya)", 'text-red-400');
                            addLog("Voice-to-Text Active... Transcribing...", 'text-red-300');
                            setTimeout(() => addLog("Keyword Detected: 'Snatch', 'Bike', 'Help'", 'text-red-400'), 1000);
                            newIncident = { id: `inc-${Date.now()}`, type: 'theft', location: 'SG Palya Main Road', time: 'Just Now', status: 'pending', priority: 'high', x: 48, y: 62, desc: 'Two wheeler snatch & grab reported near Christ University Gate 1. Victim reporting via Dial 112.' };
                        } else if (currentScenario === 1) {
                            addLog("Predictive Model Alert: Crowd Density Critical > 85%", 'text-cyan-400');
                            addLog("Correlation: Weather (Rain) + Traffic (High) -> Risk of Public Disorder", 'text-cyan-300');
                            newIncident = { id: `inc-${Date.now()}`, type: 'predictive', location: 'Sony Signal Junction', time: 'Forecast (+15m)', status: 'pending', priority: 'medium', x: 70, y: 20, desc: 'AI Forecast: High probability of traffic deadlock leading to public disorder. Pre-emptive patrol requested.' };
                        } else {
                            addLog("RADIO SIGNAL: Unit KA-05-334 Requesting Assist", 'text-purple-400');
                            addLog("Signal Triangulation: Madiwala Market", 'text-purple-300');
                            newIncident = { id: `inc-${Date.now()}`, type: 'assault', location: 'Madiwala Market', time: 'Live Feed', status: 'pending', priority: 'critical', x: 80, y: 80, desc: 'Officer Arun Gowda requesting immediate backup. Active altercation in progress.' };
                        }
                        setIncidents([newIncident]);
                    }, 4000);
                    break;

                case 'detected':
                    timer = setTimeout(() => {
                        setDemoStage('analyzing');
                    }, 3000);
                    break;

                case 'analyzing':
                    // Trigger UI for analysis
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
                    }, 6000);
                    break;

                case 'dispatching':
                    // Trigger dispatch
                    const bestOfficer = officers
                        .filter(o => o.status !== 'busy')
                        .map(o => ({ ...o, ...calculateFitScore(o, incidents[0]) }))
                        .sort((a, b) => b.score - a.score)[0];

                    if (bestOfficer) {
                        addLog(`Auto-Authorizing Dispatch for Officer ${bestOfficer?.name}...`, 'text-green-300');
                        handleDispatch(bestOfficer.id); // This handles animation & state update
                    }
                    timer = setTimeout(() => {
                        setDemoStage('resolved');
                    }, 2000); // Wait for dispatch func to initiate
                    break;

                case 'resolved':
                    timer = setTimeout(() => {
                        // RESET FOR NEXT LOOP
                        setScenarioIndex(prev => prev + 1);
                        setIncidents([]);
                        setOfficers(INITIAL_OFFICERS); // Reset positions
                        setShowDispatchModal(false);
                        setAiAdvice(null);
                        setDemoStage('scanning');
                    }, 8000); // Wait for animation to finish
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
                    <div className="flex-1 relative">
                        {/* REAL MAP BACKGROUND */}
                        <div className="absolute inset-0 z-0 opacity-40 grayscale invert contrast-125 brightness-75 pointer-events-none">
                            <iframe
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                allowFullScreen
                                src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15554.336474149234!2d77.615!3d12.935!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin&maptype=satellite"
                            ></iframe>
                        </div>

                        <div className="absolute inset-0 z-10 bg-blue-900/10 pointer-events-none"></div>
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

                        {/* Active Routes */}
                        {incidents.filter(i => i.status === 'assigned').map(inc => {
                            // Officer position is now dynamic
                            const officer = officers.find(o => o.id === inc.assignedTo);
                            return <RouteLine key={`route-${inc.id}`} start={officer} end={inc} />;
                        })}

                        {/* Map Objects */}
                        <div className="absolute inset-0 z-20">
                            {heatmapMode && ZONES.map(zone => (
                                <div
                                    key={zone.id}
                                    className="absolute rounded-full blur-2xl opacity-40 animate-pulse mix-blend-screen"
                                    style={{
                                        left: `${zone.lng * 100 - 7755}%`,
                                        top: `${(1298 - zone.lat * 100) * 2}%`,
                                        width: `${zone.radius * 15}px`,
                                        height: `${zone.radius * 15}px`,
                                        transform: 'translate(-50%, -50%)',
                                        backgroundColor: CRIME_TYPES[zone.type].mapColor
                                    }}
                                ></div>
                            ))}

                            {patrolCarMode && officers.map(officer => (
                                <div
                                    key={officer.id}
                                    className="absolute transition-all duration-100 ease-linear group/marker"
                                    style={{ left: `${officer.x}%`, top: `${officer.y}%` }}
                                    onClick={() => handleOfficerClick(officer)}
                                >
                                    <div className="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer">
                                        <div className={`w-8 h-8 rounded-full border-2 ${officer.status === 'busy' ? 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.8)]' : 'bg-slate-900 border-blue-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]'} flex items-center justify-center z-20 relative transition-all`}>
                                            <Navigation className={`w-4 h-4 text-white transform ${officer.status === 'busy' ? 'rotate-0 animate-bounce' : 'rotate-45'}`} />
                                        </div>
                                        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 px-2 py-1 rounded text-[9px] font-bold whitespace-nowrap text-white opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-30 shadow-lg">
                                            {officer.name}
                                        </div>
                                        {officer.status === 'patrol' && <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-ping"></div>}
                                    </div>
                                </div>
                            ))}

                            {incidents.map(inc => (
                                <div
                                    key={inc.id}
                                    className="absolute z-30 cursor-pointer"
                                    style={{ left: `${inc.x}%`, top: `${inc.y}%` }}
                                    onClick={() => {
                                        if (inc.status !== 'assigned') {
                                            setSelectedIncident(inc);
                                            setShowDispatchModal(true);
                                        }
                                    }}
                                >
                                    <div className="relative -translate-x-1/2 -translate-y-1/2 group/incident">
                                        <div className="absolute inset-[-20px] bg-red-500/20 rounded-full animate-ping"></div>
                                        <div className="absolute inset-[-10px] bg-red-500/30 rounded-full animate-pulse"></div>
                                        <div className={`w-10 h-10 rounded-full border-2 ${inc.status === 'assigned' ? 'bg-green-600 border-white' : 'bg-red-600 border-white animate-bounce'} flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)]`}>
                                            {inc.status === 'assigned' ? <CheckCircle className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
                                        </div>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap uppercase tracking-wider">
                                            {CRIME_TYPES[inc.type].label}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Overlay Stats */}
                        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none z-30">
                            <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-lg text-xs font-mono text-slate-400 shadow-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <Target className="w-3 h-3 text-blue-400" />
                                    <span className="font-bold text-white">GRID: SG_PALYA_SEC_04</span>
                                </div>
                                <div>ZONAL RISK: MODERATE</div>
                            </div>
                            <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-lg flex items-center gap-4 shadow-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                                    <span className="text-xs font-bold text-slate-300">INCIDENT</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                                    <span className="text-xs font-bold text-slate-300">UNIT</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_5px_rgba(168,85,247,0.8)]"></div>
                                    <span className="text-xs font-bold text-slate-300">PREDICTED</span>
                                </div>
                            </div>
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
            {showDispatchModal && selectedIncident && (
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
            )}

            {/* OFFICER DETAIL MODAL */}
            {showOfficerModal && selectedOfficer && (
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
            )}
        </div>
    );
}

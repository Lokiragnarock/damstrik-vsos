import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Shield, Map as MapIcon, Radio, Users, Bell, Search, Activity, Clock, CheckCircle, AlertTriangle, Zap, Navigation, Battery, Award, ChevronRight, X, Target, Wifi, Database, Play, Pause, Sparkles, BrainCircuit, CloudRain, TrendingUp, FileText, PhoneCall, Mic, Server
} from 'lucide-react';
import { nearestPointOnGraph, shortestPath, randomWalkStep, allEdges } from './roadnet/graph';

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

// --- ROAD NETWORK (bundled OSM extract - see src/roadnet/graph.js) ---
// Cars are graph-locked: every officer/incident position is snapped onto this
// network, and routes/patrol movement only ever follow its edge geometry.
const ALL_ROAD_EDGES = allEdges();

// Planar distance in km (fine at city scale)
const distKmBetween = (a, b) => {
    const dLat = (b.lat - a.lat) * 110.574;
    const dLng = (b.lng - a.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
};

// Snap a raw lat/lng onto the road graph (falls back to the raw point if ungraphed)
const snapLatLng = (lat, lng) => {
    const p = nearestPointOnGraph(lat, lng);
    return p ? { lat: p.lat, lng: p.lng } : { lat, lng };
};

const calculateDistance = (lat1, lng1, lat2, lng2) => Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));

// --- SPEED MODEL & SIM CLOCK ---
// The simulation clock runs SIM_SPEED x faster than wall time. All kinematics
// below are computed in sim-seconds with REAL Bengaluru driving speeds, so the
// speedometer reads true km/h while a 2km run stays watchable.
export const SIM_SPEED = 8;

// Response-driving speeds per OSM road class (km/h, Bengaluru realistic).
const ROAD_SPEED_KMH = { trunk: 42, primary: 42, secondary: 34, tertiary: 28, unclassified: 20, residential: 20 };
const ACCEL_MS2 = 2.2;     // pull-away acceleration from stops
const DECEL_MS2 = 2.8;     // braking into junctions and turns
const JUNCTION_KMH = 12;   // brief slow rolling through every graph node
const SHARP_TURN_KMH = 10; // turns sharper than 45 degrees

const roadClassOf = (highway) => (highway || 'unclassified').replace(/_link$/, '');
const responseSpeedKmh = (highway) => ROAD_SPEED_KMH[roadClassOf(highway)] ?? 20;
const patrolSpeedKmh = (highway) => responseSpeedKmh(highway) * 0.6; // cruising

// Deflection angle at vertex b between segments a->b and b->c (degrees, 0 = straight).
const turnAngleDeg = (a, b, c) => {
    const scale = Math.cos(b.lat * Math.PI / 180);
    const v1x = (b.lng - a.lng) * scale, v1y = b.lat - a.lat;
    const v2x = (c.lng - b.lng) * scale, v2y = c.lat - b.lat;
    const d1 = Math.hypot(v1x, v1y), d2 = Math.hypot(v2x, v2y);
    if (d1 < 1e-12 || d2 < 1e-12) return 0;
    const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (d1 * d2)));
    return Math.acos(cos) * 180 / Math.PI;
};

// Braking-aware speed profile over a route of {lat,lng,highway,isNode} points:
// per-segment cruise limits plus per-vertex ceilings chained backwards so the
// unit always has room to decelerate into the next junction/turn/stop.
function buildSpeedProfile(route, speedForKmh) {
    const n = route.length;
    const segLens = [];
    const segLimit = []; // m/s cruise cap per segment
    let totalKm = 0;
    for (let i = 0; i < n - 1; i++) {
        const d = distKmBetween(route[i], route[i + 1]);
        segLens.push(d);
        totalKm += d;
        segLimit.push(Math.min(speedForKmh(route[i].highway), speedForKmh(route[i + 1].highway)) / 3.6);
    }
    const allowed = new Array(n); // m/s ceiling at each vertex
    for (let i = 0; i < n; i++) {
        let capKmh = speedForKmh(route[i].highway);
        if (i > 0 && i < n - 1) {
            if (route[i].isNode) capKmh = Math.min(capKmh, JUNCTION_KMH);
            if (turnAngleDeg(route[i - 1], route[i], route[i + 1]) > 45) capKmh = Math.min(capKmh, SHARP_TURN_KMH);
        }
        allowed[i] = capKmh / 3.6;
    }
    allowed[n - 1] = 0; // full stop at the destination
    for (let i = n - 2; i >= 0; i--) {
        const segM = segLens[i] * 1000;
        allowed[i] = Math.min(allowed[i], Math.sqrt(allowed[i + 1] ** 2 + 2 * DECEL_MS2 * segM));
    }
    return { segLens, segLimit, allowed, totalKm };
}

// Advance kinematic state {dKm, vMs} by simDt sim-seconds along a profiled route.
// Speed changes are continuous: bounded by ACCEL up, DECEL down, and the
// braking-distance ceiling toward the next vertex.
function stepKinematics(state, profile, simDt) {
    const { segLens, segLimit, allowed, totalKm } = profile;
    let acc = 0, i = 0;
    while (i < segLens.length - 1 && acc + segLens[i] < state.dKm) { acc += segLens[i]; i++; }
    const distToNextM = Math.max(0, (acc + (segLens[i] || 0) - state.dKm) * 1000);
    const nextCeil = allowed[Math.min(i + 1, allowed.length - 1)];
    const cap = Math.min(segLimit[i] ?? 0, Math.sqrt(nextCeil ** 2 + 2 * DECEL_MS2 * distToNextM));
    state.vMs = Math.max(Math.min(state.vMs + ACCEL_MS2 * simDt, cap), state.vMs - DECEL_MS2 * simDt);
    state.dKm += state.vMs * simDt / 1000;
    return state.dKm >= totalKm - 0.002; // within 2m of the stop point counts as arrived
}

// Position at cumulative distance dKm along a route polyline.
function pointAlongRoute(route, segLens, dKm) {
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= dKm) {
            const f = segLens[i] === 0 ? 0 : (dKm - acc) / segLens[i];
            return {
                lat: route[i].lat + (route[i + 1].lat - route[i].lat) * f,
                lng: route[i].lng + (route[i + 1].lng - route[i].lng) * f
            };
        }
        acc += segLens[i];
    }
    return route[route.length - 1];
}

// --- MOCK BACKEND DATA ---

const ZONES = [
    { id: 'z1', name: 'Koramangala 5th Block', lat: 12.934, lng: 77.62, risk: 'high', type: 'theft', radius: 300 }, // Radius in meters
    { id: 'z2', name: 'SG Palya (Christ Univ)', lat: 12.938, lng: 77.60, risk: 'medium', type: 'public_order', radius: 250 },
    { id: 'z3', name: 'Sony Signal', lat: 12.945, lng: 77.625, risk: 'low', type: 'traffic', radius: 200 },
    { id: 'z4', name: 'Madiwala Market', lat: 12.922, lng: 77.618, risk: 'high', type: 'assault', radius: 350 },
];

// Hotspot clustering: the risk zones double as patrol sector seeds. Coverage
// assignment weights hotspots by risk and spreads available units across them.
const RISK_WEIGHT = { high: 3, medium: 2, low: 1 };
const SECTOR_PATROL_RADIUS_KM = 0.35; // random-walk containment around the hotspot
const SECTOR_TRANSIT_KM = 0.4;        // beyond this, route to the hotspot first
const UNIT_SPACING_KM = 0.25;         // mutual awareness spacing between patrol units

// --- CRIME INTENSITY DIAL (Stream 3) ---
// Judge-facing dial driving the incident generator's arrival rate. Mean
// inter-arrival gap is in SIM-seconds (i.e. scaled by SIM_SPEED already being
// the sim clock's own rate) - these numbers are dramatic pacing choices for a
// demo, not derived from any real Bengaluru call-volume data.
// SIM: fabricated arrival-rate ladder, tuned only for how the demo *feels*.
const CRIME_INTENSITY_LEVELS = [
    { label: 'Calm Night', meanGapSimS: 100 },
    { label: 'Standard Patrol', meanGapSimS: 60 },
    { label: 'Busy Evening', meanGapSimS: 35 },
    { label: 'Peak Hour', meanGapSimS: 20 },
    { label: 'Festival Chaos', meanGapSimS: 9 },
];

// SIM: fabricated severity mix for generated incidents - no real crime-report
// distribution backs these weights, they just make the queue feel plausible.
const SEVERITY_WEIGHTS = [
    { severity: 'low', weight: 0.5 },
    { severity: 'high', weight: 0.35 },
    { severity: 'critical', weight: 0.15 },
];
// SIM: priority score used purely to order the incident queue for this demo.
const SEVERITY_PRIORITY = { critical: 3, high: 2, low: 1 };

const GENERATOR_TYPES = ['theft', 'assault', 'traffic', 'public_order'];
const GENERATOR_DESC = {
    theft: 'Snatch-theft reported by a bystander near the marked hotspot.',
    assault: 'Physical altercation reported in progress.',
    traffic: 'Traffic obstruction / accident reported, congestion building.',
    public_order: 'Crowd disturbance reported, escalation risk flagged.',
};

const weightedPick = (items, weightKey) => {
    const total = items.reduce((s, it) => s + it[weightKey], 0);
    let r = Math.random() * total; // SIM: uniform draw over the fabricated weights above
    for (const it of items) {
        r -= it[weightKey];
        if (r <= 0) return it;
    }
    return items[items.length - 1];
};

// Exponential inter-arrival draw (Poisson process) around a mean gap.
// SIM: standard Poisson-process math, but the mean itself is a fabricated dial value.
const nextArrivalGapSimS = (meanGapSimS) => -meanGapSimS * Math.log(1 - Math.random());

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

// --- INCIDENT GENERATOR (Stream 3) ---
// SIM: the whole generator is staged demo pressure. There is no Dial-112 feed;
// arrival rates, type mixes and severity odds below are invented for the demo
// (see WHAT-IS-REAL.md). Arrivals are Poisson-sampled per tick, spatially
// weighted toward high-risk ZONES, and every point is snapped onto the road graph.
const INTENSITY_LEVELS = [
    { name: 'Calm Night', ratePerSimMin: 0.12, color: 'text-emerald-400' },   // SIM: fabricated arrival rate
    { name: 'Quiet Shift', ratePerSimMin: 0.35, color: 'text-lime-400' },     // SIM: fabricated arrival rate
    { name: 'Steady Shift', ratePerSimMin: 0.8, color: 'text-yellow-400' },   // SIM: fabricated arrival rate
    { name: 'Weekend Rush', ratePerSimMin: 1.6, color: 'text-orange-400' },   // SIM: fabricated arrival rate
    { name: 'Festival Chaos', ratePerSimMin: 3.2, color: 'text-red-400' },    // SIM: fabricated arrival rate
];
const GEN_TICK_MS = 1500;
const MAX_PENDING = 15; // SIM: safety cap so the queue stays readable on screen

const GEN_TYPES = ['theft', 'assault', 'traffic', 'public_order'];
// SIM: invented severity mix for generated incidents
const SEVERITY_MIX = [['low', 0.5], ['high', 0.35], ['critical', 0.15]];
const SEVERITY_TO_PRIORITY = { low: 'medium', high: 'high', critical: 'critical' };

// SIM: canned incident descriptions keyed by type
const GEN_DESCS = {
    theft: 'Two-wheeler snatch reported by passerby. Suspect direction unknown.',
    assault: 'Physical altercation reported. Possible injuries on scene.',
    traffic: 'Traffic obstruction building. Signal discipline breaking down.',
    public_order: 'Crowd gathering, noise complaints. Situation not yet violent.',
};

const pickWeightedZone = () => {
    const total = ZONES.reduce((s, z) => s + RISK_WEIGHT[z.risk], 0);
    let r = Math.random() * total;
    for (const z of ZONES) {
        r -= RISK_WEIGHT[z.risk];
        if (r <= 0) return z;
    }
    return ZONES[ZONES.length - 1];
};

// Poisson sample via Knuth (fine for the small per-tick means we use)
const samplePoisson = (mean) => {
    const L = Math.exp(-mean);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
};

// Build one generated incident: zone-weighted position, road-snapped.
const makeGeneratedIncident = () => {
    const zone = pickWeightedZone();
    // Uniform point inside the zone circle, then snapped to the nearest road
    const rM = zone.radius * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const rawLat = zone.lat + (rM * Math.cos(theta)) / 110574;
    const rawLng = zone.lng + (rM * Math.sin(theta)) / (111320 * Math.cos(zone.lat * Math.PI / 180));
    const pos = snapLatLng(rawLat, rawLng);
    // SIM: 65% of incidents match the zone's signature crime type
    const type = Math.random() < 0.65 ? zone.type : GEN_TYPES[Math.floor(Math.random() * GEN_TYPES.length)];
    let severity = 'low', r = Math.random();
    for (const [sev, p] of SEVERITY_MIX) { if (r < p) { severity = sev; break; } r -= p; }
    return {
        id: `inc-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
        type,
        severity,
        location: `${zone.name} vicinity`,
        time: 'Live',
        status: 'pending',
        priority: SEVERITY_TO_PRIORITY[severity],
        lat: pos.lat, lng: pos.lng,
        desc: GEN_DESCS[type] || 'Incident reported via simulated feed.', // SIM
        createdWall: Date.now(),
    };
};

const CRIME_TYPES = {
    theft: { label: 'Theft / Snatch', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500', mapColor: '#a855f7' },
    assault: { label: 'Violent Assault', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500', mapColor: '#ef4444' },
    cyber: { label: 'Cyber Fraud', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500', mapColor: '#f97316' },
    women_safety: { label: 'Women Safety', color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500', mapColor: '#ec4899' },
    public_order: { label: 'Public Disturbance', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', mapColor: '#eab308' },
    traffic: { label: 'Traffic Gridlock', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', mapColor: '#3b82f6' },
    predictive: { label: 'AI Prediction', color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500', mapColor: '#06b6d4' },
    murder: { label: 'Homicide', color: 'text-rose-600', bg: 'bg-rose-600/20', border: 'border-rose-600', mapColor: '#e11d48' },
    manual: { label: 'Operator Report', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', mapColor: '#3b82f6' }
};

// --- LOGIC HELPERS ---

const calculateFitScore = (officer, incident) => {
    if (!officer.lat || !officer.lng || !incident.lat || !incident.lng) {
        return { score: 0, breakdown: { proximity: 0, skill: 0, fatigue: 0 }, distance: Infinity };
    }
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

// Click-anywhere-to-dispatch: must live inside <MapContainer> to use useMapEvents
const MapClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
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
    // Snap parked units onto the road graph synchronously at init (no more async OSRM round-trip)
    const [officers, setOfficers] = useState(() => INITIAL_OFFICERS.map(o => ({ ...o, ...snapLatLng(o.lat, o.lng) })));
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [selectedOfficer, setSelectedOfficer] = useState(null);
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [showOfficerModal, setShowOfficerModal] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState(true);
    const [patrolCarMode, setPatrolCarMode] = useState(true);
    const [showRoadnet, setShowRoadnet] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [movingOfficerId, setMovingOfficerId] = useState(null);
    const [activeRoutes, setActiveRoutes] = useState({}); // { incidentId: [[lat,lng], ...] }

    // Latest incidents, readable from inside long-lived timers without stale closures
    const incidentsRef = useRef(incidents);
    useEffect(() => { incidentsRef.current = incidents; }, [incidents]);

    // Latest officers, same reason (sector assignment timer reads live positions)
    const officersRef = useRef(officers);
    useEffect(() => { officersRef.current = officers; }, [officers]);

    // Sector assignment: officerId -> zoneId (null/undefined = unassigned)
    const sectorRef = useRef({});

    // --- SIM CLOCK (single source of truth) ---
    // Sim-seconds elapsed since load, advanced at SIM_SPEED x wall time. Every
    // incident timer / queue calculation reads this ref instead of Date.now(),
    // so pausing/backgrounding the tab never desyncs the demo's own clock.
    const simClockRef = useRef(0);
    useEffect(() => {
        let last = performance.now();
        const id = setInterval(() => {
            const now = performance.now();
            simClockRef.current += ((now - last) / 1000) * SIM_SPEED;
            last = now;
        }, 250);
        return () => clearInterval(id);
    }, []);

    // Per-officer idle patrol state, keyed by officer id: { coords, cumKm, lengthKm,
    // progressKm, fromNodeId, pausedUntil }. Lives outside React state since it's
    // advanced every tick and only the resulting lat/lng needs to trigger a render.
    const patrolStateRef = useRef({});

    // AI State
    const [aiAdvice, setAiAdvice] = useState(null);
    const [generatingAdvice, setGeneratingAdvice] = useState(false);

    // Ingestion Logs State
    const [logs, setLogs] = useState([]);

    // Crime Intensity dial: index into CRIME_INTENSITY_LEVELS, drives the
    // incident generator below. This dial-driven generator is the default
    // mode - it replaces the old scripted 3-scenario demo loop entirely.
    const [crimeIntensityIdx, setCrimeIntensityIdx] = useState(1); // default: Standard Patrol
    const nextArrivalSimRef = useRef(0); // sim-time of the next scheduled incident

    const addLog = useCallback((msg, color = 'text-slate-300') => {
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev.slice(-20), { time, msg, color }]);
    }, []);

    // Idle patrol: officers not currently dispatched cruise along the road graph,
    // edge by edge, turning randomly at intersections and pausing occasionally.
    // Cruising speed is 60% of the road class's response speed, with the same
    // accelerate-from-stop / brake-into-junction kinematics as dispatch runs.
    useEffect(() => {
        const TICK_MS = 500;
        const tick = setInterval(() => {
            const now = Date.now();
            setOfficers(prev => prev.map(o => {
                if (o.status !== 'patrol') return o;
                const state = patrolStateRef.current[o.id];

                if (state?.pausedUntil) {
                    if (now < state.pausedUntil) {
                        return o.speedKmh ? { ...o, speedKmh: 0 } : o; // holding position
                    }
                    state.pausedUntil = null;
                }

                let leg = state?.leg;
                let fromNodeId = state?.fromNodeId ?? null;
                let progressKm = state?.progressKm ?? 0;
                let vMs = state?.vMs ?? 0;

                if (!leg) {
                    const zone = ZONES.find(z => z.id === sectorRef.current[o.id]) || null;

                    // Far from the assigned hotspot: route there along the graph
                    // instead of wandering, as one long transit leg.
                    if (zone && distKmBetween(o, zone) > SECTOR_TRANSIT_KM) {
                        const route = shortestPath({ lat: o.lat, lng: o.lng }, { lat: zone.lat, lng: zone.lng });
                        if (route.length >= 2) {
                            const cumKm = [0];
                            for (let i = 1; i < route.length; i++) {
                                cumKm.push(cumKm[i - 1] + distKmBetween(route[i - 1], route[i]));
                            }
                            leg = { coords: route, cumKm, lengthKm: cumKm[cumKm.length - 1], fromNodeId: null, isTransit: true };
                            fromNodeId = null;
                            progressKm = 0;
                        }
                    }

                    // In (or near) the sector: random-walk, rejecting steps that
                    // leave the patrol radius or crowd another unit's position.
                    if (!leg) {
                        for (let attempt = 0; attempt < 4 && !leg; attempt++) {
                            const step = randomWalkStep({ lat: o.lat, lng: o.lng }, fromNodeId);
                            if (!step) return o; // isolated node, nowhere to go
                            const end = step.coords[step.coords.length - 1];
                            const leavesZone = zone && distKmBetween(end, zone) > SECTOR_PATROL_RADIUS_KM;
                            // Mutual awareness: don't drift onto a unit patrolling a
                            // different sector (same-sector units are allowed close).
                            const crowded = prev.some(other =>
                                other.id !== o.id && other.status === 'patrol' &&
                                sectorRef.current[other.id] !== sectorRef.current[o.id] &&
                                distKmBetween(end, other) < UNIT_SPACING_KM
                            );
                            // Last attempt always passes so dead ends stay escapable.
                            if ((leavesZone || crowded) && attempt < 3) continue;
                            const cumKm = [0];
                            for (let i = 1; i < step.coords.length; i++) {
                                cumKm.push(cumKm[i - 1] + distKmBetween(step.coords[i - 1], step.coords[i]));
                            }
                            leg = { coords: step.coords, cumKm, lengthKm: step.lengthKm, toNodeId: step.toNodeId, fromNodeId: step.fromNodeId, highway: step.highway };
                            fromNodeId = step.fromNodeId;
                            progressKm = 0;
                        }
                        if (!leg) return o;
                    }
                }

                // Integrate patrol kinematics in 1s sim substeps: accelerate toward
                // cruise speed, brake so we roll through the end junction slowly.
                // Transit legs span many edges, so look up the road class at the
                // current position instead of using a single per-leg class.
                const highwayAtKm = (l, km) => {
                    for (let i = 1; i < l.coords.length; i++) {
                        if (l.cumKm[i] >= km) return l.coords[i].highway;
                    }
                    return l.coords[l.coords.length - 1].highway;
                };
                const junctionMs = JUNCTION_KMH / 3.6;
                let remainingSimS = (TICK_MS / 1000) * SIM_SPEED;
                while (remainingSimS > 0 && progressKm < leg.lengthKm) {
                    const dt = Math.min(1, remainingSimS);
                    const cruiseMs = patrolSpeedKmh(leg.isTransit ? highwayAtKm(leg, progressKm) : leg.highway) / 3.6;
                    const remainM = Math.max(0, (leg.lengthKm - progressKm) * 1000);
                    const cap = Math.min(cruiseMs, Math.sqrt(junctionMs ** 2 + 2 * DECEL_MS2 * remainM));
                    vMs = Math.max(Math.min(vMs + ACCEL_MS2 * dt, cap), vMs - DECEL_MS2 * dt);
                    progressKm += vMs * dt / 1000;
                    remainingSimS -= dt;
                }

                if (progressKm >= leg.lengthKm) {
                    // Reached the intersection at the end of this edge.
                    const endPos = leg.coords[leg.coords.length - 1];
                    const shouldPause = Math.random() < 0.3;
                    patrolStateRef.current[o.id] = {
                        leg: null,
                        fromNodeId: leg.fromNodeId,
                        progressKm: 0,
                        vMs: shouldPause ? 0 : vMs,
                        pausedUntil: shouldPause ? now + (10000 + Math.random() * 20000) : null
                    };
                    return { ...o, lat: endPos.lat, lng: endPos.lng, speedKmh: shouldPause ? 0 : vMs * 3.6 };
                }

                // Interpolate position along the current leg's real street geometry.
                const { coords, cumKm } = leg;
                let pos = coords[coords.length - 1];
                for (let i = 1; i < coords.length; i++) {
                    if (cumKm[i] >= progressKm) {
                        const segLen = cumKm[i] - cumKm[i - 1];
                        const f = segLen < 1e-9 ? 0 : (progressKm - cumKm[i - 1]) / segLen;
                        pos = {
                            lat: coords[i - 1].lat + (coords[i].lat - coords[i - 1].lat) * f,
                            lng: coords[i - 1].lng + (coords[i].lng - coords[i - 1].lng) * f
                        };
                        break;
                    }
                }
                patrolStateRef.current[o.id] = { leg, fromNodeId, progressKm, vMs, pausedUntil: null };
                return { ...o, lat: pos.lat, lng: pos.lng, speedKmh: vMs * 3.6 };
            }));
        }, TICK_MS);
        return () => clearInterval(tick);
    }, []);

    // Co-aware coverage: every few seconds, greedily assign non-busy units to
    // hotspot sectors - higher-weight hotspots are covered first, and no hotspot
    // gets a second unit while another is still uncovered. Assignments are sticky
    // so units don't churn between sectors on marginal distance differences.
    useEffect(() => {
        const rebalance = setInterval(() => {
            const current = officersRef.current;
            const avail = current.filter(o => o.status === 'patrol');
            const zonesByWeight = [...ZONES].sort((a, b) => RISK_WEIGHT[b.risk] - RISK_WEIGHT[a.risk]);

            // Greedy rounds: each round covers every hotspot once (weight order)
            // with its nearest free unit, then surplus units double up on the
            // highest-weight hotspots. Stickiness bonus damps pointless churn.
            const assignment = {}; // officerId -> zone
            const pool = new Set(avail.map(o => o.id));
            while (pool.size > 0) {
                let progressed = false;
                for (const zone of zonesByWeight) {
                    if (pool.size === 0) break;
                    let bestO = null, bestD = Infinity;
                    for (const o of avail) {
                        if (!pool.has(o.id)) continue;
                        let d = distKmBetween(o, zone);
                        if (sectorRef.current[o.id] === zone.id) d -= 0.5; // stickiness
                        if (d < bestD) { bestD = d; bestO = o; }
                    }
                    if (bestO) {
                        assignment[bestO.id] = zone;
                        pool.delete(bestO.id);
                        progressed = true;
                    }
                }
                if (!progressed) break;
            }

            // Apply changes: log rebalances, drop stale transit legs, sync state.
            let changed = false;
            for (const o of current) {
                const zone = assignment[o.id] || null;
                const zoneId = zone ? zone.id : null;
                if ((sectorRef.current[o.id] ?? null) === zoneId) continue;
                sectorRef.current[o.id] = zoneId;
                const st = patrolStateRef.current[o.id];
                if (st?.leg) st.leg = null; // re-plan next tick toward the new sector
                if (zone) addLog(`Coverage rebalance: ${o.name.split(' ').slice(1).join(' ')} → ${zone.name} sector`, 'text-cyan-400');
                changed = true;
            }
            if (changed) {
                setOfficers(prev => prev.map(o => {
                    const z = ZONES.find(zz => zz.id === sectorRef.current[o.id]) || null;
                    const name = z ? z.name : null;
                    return (o.sector ?? null) === name ? o : { ...o, sector: name };
                }));
            }
        }, 3000);
        return () => clearInterval(rebalance);
    }, [addLog]);

    // --- LOGIC: HANDLE DISPATCH ---
    const handleDispatch = useCallback((officerId, incidentId) => {
        setDispatching(true);
        addLog(`Command confirmed. Syncing directives to unit device...`, 'text-yellow-400');

        setTimeout(() => {
            const officer = officersRef.current.find(o => o.id === officerId);
            const incident = incidentsRef.current.find(i => i.id === incidentId) || incidentsRef.current.find(i => i.status === 'pending');

            if (!officer || !incident) {
                setDispatching(false);
                return;
            }

            // 1. Route along the graph's real street geometry (fully on-road, no fetch)
            const route = shortestPath({ lat: officer.lat, lng: officer.lng }, { lat: incident.lat, lng: incident.lng });

            // Store route polyline for visualization
            setActiveRoutes(prev => ({ ...prev, [incident.id]: route.map(p => [p.lat, p.lng]) }));

            // 2. Update Status - drop any idle-patrol state so the unit resumes
            // patrolling fresh from the arrival point instead of a stale leg
            patrolStateRef.current[officerId] = null;
            setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
            setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'assigned', assignedTo: officerId } : i));

            // 3. Animate along the route with real kinematics on the sim clock
            setMovingOfficerId(officerId);

            const profile = buildSpeedProfile(route, responseSpeedKmh);
            const { segLens, totalKm } = profile;

            // Pre-simulate the run coarsely to log distance + ETA up front
            let etaSimS = 0;
            {
                const trial = { dKm: 0, vMs: 0 };
                let guard = 0;
                while (!stepKinematics(trial, profile, 0.5) && guard++ < 20000) etaSimS += 0.5;
            }
            addLog(`Dispatch route: ${totalKm.toFixed(1)} km — ETA ${Math.round(etaSimS / SIM_SPEED)}s @ SIM ${SIM_SPEED}×`, 'text-cyan-300');

            const kin = { dKm: 0, vMs: 0 };
            let lastTick = performance.now();
            let arrived = route.length < 2;

            // setInterval (not rAF): keeps advancing even in hidden/background tabs.
            // Elapsed wall time is integrated in small sim-time substeps, so
            // throttled background ticks stay position-accurate.
            const moveTimer = setInterval(() => {
                const now = performance.now();
                let remainingSimS = ((now - lastTick) / 1000) * SIM_SPEED;
                lastTick = now;
                while (remainingSimS > 0 && !arrived) {
                    const dt = Math.min(0.25, remainingSimS);
                    arrived = stepKinematics(kin, profile, dt);
                    remainingSimS -= dt;
                }
                const pos = arrived ? route[route.length - 1] : pointAlongRoute(route, segLens, Math.min(kin.dKm, totalKm));
                const speedKmh = arrived ? 0 : kin.vMs * 3.6;
                setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, lat: pos.lat, lng: pos.lng, speedKmh } : o));

                if (!arrived) return;
                // Arrived — unit holds at the road-snapped end of the route
                clearInterval(moveTimer);
                setMovingOfficerId(null);
                addLog(`Unit ${officer.name} arrived at location.`, 'text-green-400');
                setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'onscene', arrivedAtSim: simClockRef.current } : i));
                setTimeout(() => {
                    setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'patrol' } : o));
                    setActiveRoutes(prev => {
                        const newRoutes = { ...prev };
                        delete newRoutes[incident.id];
                        return newRoutes;
                    });
                    setIncidents(prev => prev.filter(i => i.id !== incident.id));
                    addLog(`Unit ${officer.name} resolved incident. Holding position.`, 'text-slate-400');
                }, 15000);
            }, 33);

            // Close modal and stop loading state
            setDispatching(false);
            setShowDispatchModal(false);

        }, 2000);
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
            .filter(o => o.status === 'patrol')
            .map(o => ({ ...o, ...calculateFitScore(o, selectedIncident) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }, [selectedIncident, officers]);

    // --- INCIDENT GENERATOR (Stream 3, default mode) ---
    // Replaces the old scripted 3-scenario demo loop: a Poisson-ish arrival
    // process, paced by the Crime Intensity dial, spatially weighted toward
    // the higher-risk ZONES. This is the default/only mode now - preserving
    // the old single-incident scripted loop alongside a real incident queue
    // would have meant maintaining two incompatible incident-array shapes, so
    // it was removed rather than kept behind a toggle.
    useEffect(() => {
        const meanGap = CRIME_INTENSITY_LEVELS[crimeIntensityIdx].meanGapSimS;
        if (nextArrivalSimRef.current === 0) {
            nextArrivalSimRef.current = simClockRef.current + nextArrivalGapSimS(meanGap);
        }
        const check = setInterval(() => {
            if (simClockRef.current < nextArrivalSimRef.current) return;

            // SIM: hotspot-weighted spawn point - pick a zone by risk weight,
            // then jitter within its radius, then snap onto the real road graph.
            const zone = weightedPick(ZONES.map(z => ({ ...z, weight: RISK_WEIGHT[z.risk] })), 'weight');
            const jitterKm = Math.random() * (zone.radius / 1000);
            const angle = Math.random() * 2 * Math.PI;
            const dLat = (jitterKm * Math.cos(angle)) / 110.574;
            const dLng = (jitterKm * Math.sin(angle)) / (111.32 * Math.cos(zone.lat * Math.PI / 180));
            const pos = snapLatLng(zone.lat + dLat, zone.lng + dLng);

            const type = GENERATOR_TYPES[Math.floor(Math.random() * GENERATOR_TYPES.length)]; // SIM: uniform type draw
            const severity = weightedPick(SEVERITY_WEIGHTS, 'weight').severity;

            const newIncident = {
                id: `inc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                type,
                severity,
                priority: severity, // legacy field some UI still reads
                priorityScore: SEVERITY_PRIORITY[severity],
                location: zone.name,
                time: 'Just Now',
                status: 'pending',
                lat: pos.lat,
                lng: pos.lng,
                desc: GENERATOR_DESC[type],
                createdAtSim: simClockRef.current,
            };
            addLog(`INCIDENT: ${CRIME_TYPES[type].label} (${severity.toUpperCase()}) near ${zone.name}`, severity === 'critical' ? 'text-red-400' : 'text-yellow-300');
            setIncidents(prev => [...prev, newIncident]);

            nextArrivalSimRef.current = simClockRef.current + nextArrivalGapSimS(meanGap);
        }, 500);
        return () => clearInterval(check);
    }, [crimeIntensityIdx, addLog]);

    // Handle Officer Click
    const handleOfficerClick = (officer) => {
        setSelectedOfficer(officer);
        setShowOfficerModal(true);
    };

    // Click-anywhere dispatch: creates a manual incident at the snapped point.
    // (Stream 3 chunk 4 replaces this with a crime-type picker popup.)
    const handleMapClick = useCallback((lat, lng) => {
        const pos = snapLatLng(lat, lng);
        const newIncident = {
            id: `inc-${Date.now()}`,
            type: 'manual',
            severity: 'high',
            priority: 'high',
            priorityScore: SEVERITY_PRIORITY.high,
            location: 'Operator Selected Point',
            time: 'Just Now',
            status: 'pending',
            lat: pos.lat,
            lng: pos.lng,
            desc: 'Manual incident reported by operator via map interface.',
            createdAtSim: simClockRef.current,
        };
        addLog('Manual incident logged at operator-selected coordinates.', 'text-yellow-400');
        setIncidents(prev => [...prev, newIncident]);
        setSelectedIncident(newIncident);
        setShowDispatchModal(true);
    }, [addLog]);

    // Debug overlay - flatten all graph edges into one multi-part Polyline (cheap
    // to render vs. one component per edge across ~17k edges)
    const roadnetPositions = useMemo(() => ALL_ROAD_EDGES.map(e => e.coords.map(c => [c.lat, c.lng])), []);

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
                                        {officer.sector && <div className="text-[10px] text-cyan-500 font-mono mt-0.5">▸ {officer.sector}</div>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase ${officer.status === 'busy' ? 'text-blue-400' : 'text-slate-500'}`}>{officer.status}</div>
                                    <div className={`text-[10px] font-mono mt-0.5 ${officer.fatigue > 50 ? 'text-yellow-500' : 'text-emerald-500'}`}>{officer.fatigue}% FTG</div>
                                    <div className={`text-[10px] font-mono mt-0.5 ${(officer.speedKmh || 0) >= 0.5 ? 'text-cyan-400' : 'text-slate-600'}`}>{Math.round(officer.speedKmh || 0)} km/h</div>
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

                            <MapClickHandler onMapClick={handleMapClick} />

                            {/* ROADNET DEBUG OVERLAY */}
                            {showRoadnet && (
                                <Polyline positions={roadnetPositions} pathOptions={{ color: '#334155', weight: 1, opacity: 0.6 }} />
                            )}

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

                            {/* ROUTES (real street geometry) */}
                            {Object.entries(activeRoutes).map(([incId, positions]) => (
                                <Polyline key={incId} positions={positions} pathOptions={{ color: '#22c55e', dashArray: '5, 10', weight: 2 }} />
                            ))}

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
                                                 ${(officer.speedKmh || 0) >= 0.5 ? `<div class="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 px-1.5 rounded-full bg-slate-900/90 border border-slate-600 text-[9px] font-mono font-bold text-emerald-300 whitespace-nowrap leading-tight">${Math.round(officer.speedKmh)} km/h</div>` : ''}
                                               </div>`,
                                        iconSize: [32, 32],
                                        iconAnchor: [16, 16]
                                    })}
                                    eventHandlers={{
                                        click: () => handleOfficerClick(officer),
                                    }}
                                />
                            ))}

                            {/* INCIDENTS */}
                            {incidents.map(inc => (
                                <Marker
                                    key={inc.id}
                                    position={[inc.lat, inc.lng]}
                                    icon={L.divIcon({
                                        className: 'custom-leaflet-icon',
                                        html: `<div class="relative w-10 h-10 flex items-center justify-center group/incident">
                                                 <div class="absolute inset-[-10px] bg-red-500/30 rounded-full animate-pulse"></div>
                                                 <div class="w-10 h-10 rounded-full border-2 ${inc.status === 'assigned' ? 'bg-green-600 border-white' : 'bg-red-600 border-white animate-bounce'} flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)]">
                                                    ${inc.status === 'assigned' ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'}
                                                 </div>
                                               </div>`,
                                        iconSize: [40, 40],
                                        iconAnchor: [20, 20]
                                    })}
                                    eventHandlers={{
                                        click: () => {
                                            if (inc.status !== 'assigned') {
                                                setSelectedIncident(inc);
                                                setShowDispatchModal(true);
                                            }
                                        }
                                    }}
                                />
                            ))}
                        </MapContainer>

                        <div className="absolute inset-0 z-10 bg-blue-900/5 pointer-events-none"></div>
                        <RadarScanner />

                        {/* Controls */}
                        <div className="absolute top-4 left-4 z-[1000] flex gap-2 pointer-events-auto">
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
                            <button
                                onClick={() => setShowRoadnet(!showRoadnet)}
                                className={`px-4 py-2 text-xs font-bold rounded shadow-lg backdrop-blur-md border transition-all ${showRoadnet ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/20' : 'bg-slate-900/80 border-slate-700 text-slate-400'}`}
                            >
                                <MapIcon className="w-3 h-3 inline mr-2" />
                                ROADNET
                            </button>
                        </div>

                        {/* SIM CLOCK BADGE - time compression is honest and visible */}
                        <div className="absolute bottom-4 right-4 z-[1000] px-3 py-1.5 text-xs font-bold font-mono rounded bg-slate-900/80 border border-slate-700 text-cyan-300 pointer-events-none shadow-lg">
                            SIM {SIM_SPEED}×
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
                                        <p className="text-xs text-slate-400">{selectedOfficer.badge} • {selectedOfficer.vehicle}{selectedOfficer.sector ? ` • ${selectedOfficer.sector} sector` : ''}</p>
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

import { useState, useEffect, useCallback } from 'react';
import { INITIAL_OFFICERS } from '../data/officers';
import { ROAD_NODES, ROAD_WAYPOINTS } from '../data/grid';
import { usePathfinding } from './usePathfinding';

export const useSimulation = (demoMode = true) => {
    const [officers, setOfficers] = useState(INITIAL_OFFICERS);
    const [incidents, setIncidents] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeRoutes, setActiveRoutes] = useState({});
    const [demoStage, setDemoStage] = useState('scanning');
    const [scenarioIndex, setScenarioIndex] = useState(0);

    const { getNearestNode, findPath } = usePathfinding();

    const addLog = useCallback((msg, color = 'text-slate-300') => {
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev.slice(-20), { time, msg, color }]);
    }, []);

    // Reposition idle officers for coverage
    const repositionOthers = useCallback((dispatchedOfficerId) => {
        setOfficers(prev => prev.map(o => {
            if (o.id === dispatchedOfficerId || o.status === 'busy') return o;
            const nearestNode = getNearestNode(o.lat, o.lng);
            if (nearestNode) {
                return { ...o, lat: o.lat + (nearestNode.lat - o.lat) * 0.05, lng: o.lng + (nearestNode.lng - o.lng) * 0.05 };
            }
            return o;
        }));
    }, [getNearestNode]);

    // Dispatch Logic
    const dispatchOfficer = useCallback((officerId, incidentId) => {
        const officer = officers.find(o => o.id === officerId);
        const incident = incidents.find(i => i.id === incidentId);

        if (!officer || !incident) return;

        addLog(`Dispatching ${officer.name} to ${incident.location}...`, 'text-yellow-400');

        const startNode = getNearestNode(officer.lat, officer.lng);
        const endNode = getNearestNode(incident.lat, incident.lng);

        if (!startNode || !endNode) {
            console.error("Dispatch failed: Invalid nodes");
            return;
        }

        const pathIds = findPath(startNode.id, endNode.id);
        setActiveRoutes(prev => ({ ...prev, [incident.id]: pathIds }));
        repositionOthers(officerId);

        // Update Status
        setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
        setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: 'assigned', assignedTo: officerId } : i));

        // Animation Logic
        let currentPathIndex = 0;

        const moveAlongPath = () => {
            if (currentPathIndex >= pathIds.length - 1) {
                // Arrived
                addLog(`Unit ${officer.name} arrived at scene.`, 'text-green-400');
                setTimeout(() => {
                    setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'patrol', lat: incident.lat, lng: incident.lng } : o));
                    setActiveRoutes(prev => {
                        const newRoutes = { ...prev };
                        delete newRoutes[incident.id];
                        return newRoutes;
                    });
                    addLog(`Incident resolved by ${officer.name}.`, 'text-slate-400');
                }, 5000); // Faster resolution for demo
                return;
            }

            const currentNodeId = pathIds[currentPathIndex];
            const nextNodeId = pathIds[currentPathIndex + 1];
            const targetNode = ROAD_NODES[nextNodeId];
            const edgeKey = `${currentNodeId}-${nextNodeId}`;
            const waypoints = ROAD_WAYPOINTS[edgeKey] || [];
            const segmentPoints = [...waypoints, { lat: targetNode.lat, lng: targetNode.lng }];

            let segmentIndex = 0;

            const animateSegment = () => {
                if (segmentIndex >= segmentPoints.length) {
                    currentPathIndex++;
                    moveAlongPath();
                    return;
                }

                const targetPoint = segmentPoints[segmentIndex];
                const steps = 30; // Faster movement (0.5s per segment)
                let step = 0;

                const interval = setInterval(() => {
                    step++;
                    setOfficers(prev => prev.map(o => {
                        if (o.id === officerId) {
                            return {
                                ...o,
                                lat: o.lat + (targetPoint.lat - o.lat) / (steps - step + 1),
                                lng: o.lng + (targetPoint.lng - o.lng) / (steps - step + 1)
                            };
                        }
                        return o;
                    }));

                    if (step >= steps) {
                        clearInterval(interval);
                        segmentIndex++;
                        animateSegment();
                    }
                }, 16);
            };
            animateSegment();
        };

        moveAlongPath();

    }, [officers, incidents, getNearestNode, findPath, addLog, repositionOthers]);

    // Demo Loop
    useEffect(() => {
        if (!demoMode) return;

        let timer;
        const advanceStage = () => {
            switch (demoStage) {
                case 'scanning':
                    timer = setTimeout(() => {
                        setDemoStage('detected');
                        const currentScenario = scenarioIndex % 3;
                        let newIncident = {};

                        if (currentScenario === 0) {
                            addLog("INCOMING CALL: +91-98XXX-XXXX", 'text-red-400');
                            newIncident = { id: `inc-${Date.now()}`, type: 'theft', location: 'SG Palya Main Road', time: 'Just Now', status: 'pending', priority: 'high', lat: 12.9352, lng: 77.6093, desc: 'Two wheeler snatch & grab.' };
                        } else if (currentScenario === 1) {
                            addLog("Predictive Alert: Crowd Density High", 'text-cyan-400');
                            newIncident = { id: `inc-${Date.now()}`, type: 'predictive', location: 'Sony Signal', time: 'Forecast (+15m)', status: 'pending', priority: 'medium', lat: 12.9400, lng: 77.6240, desc: 'High probability of traffic deadlock.' };
                        } else {
                            addLog("RADIO SIGNAL: Officer Requesting Assist", 'text-purple-400');
                            newIncident = { id: `inc-${Date.now()}`, type: 'assault', location: 'Madiwala Market', time: 'Live Feed', status: 'pending', priority: 'critical', lat: 12.9250, lng: 77.6190, desc: 'Officer requesting backup.' };
                        }
                        setIncidents([newIncident]);
                    }, 3000); // Fast scan (3s)
                    break;

                case 'detected':
                    timer = setTimeout(() => setDemoStage('analyzing'), 2000);
                    break;

                case 'analyzing':
                    timer = setTimeout(() => setDemoStage('dispatching'), 3000);
                    break;

                case 'dispatching':
                    timer = setTimeout(() => {
                        // Auto-dispatch if no manual action taken
                        const incident = incidents.find(i => i.status !== 'assigned');
                        if (incident) {
                            // Simple fit score logic (duplicated from App.jsx for now, or move to helper)
                            // We just need ANY available officer for the demo
                            const availableOfficers = officers.filter(o => o.status !== 'busy');
                            if (availableOfficers.length > 0) {
                                // Find closest
                                const best = availableOfficers.sort((a, b) => {
                                    const distA = Math.sqrt((a.lat - incident.lat) ** 2 + (a.lng - incident.lng) ** 2);
                                    const distB = Math.sqrt((b.lat - incident.lat) ** 2 + (b.lng - incident.lng) ** 2);
                                    return distA - distB;
                                })[0];

                                addLog(`Auto-Authorizing Dispatch for Officer ${best.name}...`, 'text-green-300');
                                dispatchOfficer(best.id, incident.id);
                                // Note: dispatchOfficer doesn't advance stage, we do it here or rely on timeout?
                                // Actually, let's just advance stage here to keep loop moving
                                setDemoStage('resolved');
                            } else {
                                addLog("No units available. Queuing...", 'text-orange-300');
                                setDemoStage('resolved'); // Skip to next
                            }
                        } else {
                            setDemoStage('resolved');
                        }
                    }, 2000);
                    break;

                case 'resolved':
                    timer = setTimeout(() => {
                        setScenarioIndex(prev => prev + 1);
                        setIncidents([]);
                        setDemoStage('scanning');
                    }, 8000); // Wait a bit before clearing and restarting
                    break;
            }
        };
        advanceStage();
        return () => clearTimeout(timer);
    }, [demoMode, demoStage, scenarioIndex, addLog, incidents, officers, dispatchOfficer]);

    return {
        officers,
        incidents,
        logs,
        activeRoutes,
        demoStage,
        setDemoStage,
        dispatchOfficer,
        addLog
    };
};

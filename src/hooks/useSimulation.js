import { useState, useEffect, useCallback } from 'react';
import { INITIAL_OFFICERS } from '../data/officers';

export const useSimulation = (demoMode = true) => {
    const [officers, setOfficers] = useState(INITIAL_OFFICERS);
    const [incidents, setIncidents] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeRoutes, setActiveRoutes] = useState({});
    const [demoStage, setDemoStage] = useState('scanning');
    const [scenarioIndex, setScenarioIndex] = useState(0);

    const addLog = useCallback((msg, color = 'text-slate-300') => {
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev.slice(-20), { time, msg, color }]);
    }, []);

    const dispatchOfficer = useCallback((officerId, incidentId) => {
        let officer = null;
        let incident = null;

        setOfficers(prev => {
            officer = prev.find(o => o.id === officerId);
            return prev;
        });

        setIncidents(prev => {
            incident = prev.find(i => i.id === incidentId);
            return prev;
        });

        if (!officer || !incident) return;

        addLog(`Dispatching ${officer.name} to ${incident.location}...`, 'text-yellow-400');

        // Simple route: straight line from officer to incident
        setActiveRoutes(prev => ({
            ...prev,
            [incident.id]: [[officer.lat, officer.lng], [incident.lat, incident.lng]]
        }));

        setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: 'busy' } : o));
        setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: 'assigned', assignedTo: officerId } : i));

        // DIRECT STRAIGHT-LINE MOVEMENT
        const startLat = officer.lat;
        const startLng = officer.lng;
        const targetLat = incident.lat;
        const targetLng = incident.lng;

        const distKm = Math.sqrt(
            Math.pow((targetLat - startLat) * 111, 2) +
            Math.pow((targetLng - startLng) * 111, 2)
        );

        const durationSeconds = Math.max(3, distKm / 0.00556);
        const steps = Math.floor(durationSeconds * 60);
        let step = 0;

        const interval = setInterval(() => {
            step++;
            const progress = step / steps;

            setOfficers(prev => prev.map(o => {
                if (o.id === officerId) {
                    return {
                        ...o,
                        lat: startLat + (targetLat - startLat) * progress,
                        lng: startLng + (targetLng - startLng) * progress
                    };
                }
                return o;
            }));

            if (step >= steps) {
                clearInterval(interval);
                addLog(`Unit ${officer.name} arrived. Solving...`, 'text-green-400');
                setTimeout(() => {
                    setOfficers(prev => prev.map(o => o.id === officerId ? {
                        ...o,
                        status: 'patrol',
                        lat: incident.lat,
                        lng: incident.lng
                    } : o));
                    setActiveRoutes(prev => {
                        const newRoutes = { ...prev };
                        delete newRoutes[incident.id];
                        return newRoutes;
                    });
                    addLog(`Incident resolved by ${officer.name}.`, 'text-slate-400');
                }, 10000);
            }
        }, 16);

    }, [addLog]);

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
                    }, 3000);
                    break;

                case 'detected':
                    timer = setTimeout(() => setDemoStage('analyzing'), 2000);
                    break;

                case 'analyzing':
                    timer = setTimeout(() => setDemoStage('dispatching'), 3000);
                    break;

                case 'dispatching':
                    timer = setTimeout(() => {
                        setIncidents(prev => {
                            const incident = prev.find(i => i.status !== 'assigned');
                            if (incident) {
                                setOfficers(officers => {
                                    const availableOfficers = officers.filter(o => o.status !== 'busy');
                                    if (availableOfficers.length > 0) {
                                        const best = availableOfficers.sort((a, b) => {
                                            const distA = Math.sqrt((a.lat - incident.lat) ** 2 + (a.lng - incident.lng) ** 2);
                                            const distB = Math.sqrt((b.lat - incident.lat) ** 2 + (b.lng - incident.lng) ** 2);
                                            return distA - distB;
                                        })[0];

                                        addLog(`Auto-Authorizing Dispatch for Officer ${best.name}...`, 'text-green-300');
                                        dispatchOfficer(best.id, incident.id);
                                    } else {
                                        addLog("No units available. Queuing...", 'text-orange-300');
                                    }
                                    return officers;
                                });
                            }
                            return prev;
                        });
                        setDemoStage('resolved');
                    }, 2000);
                    break;

                case 'resolved':
                    timer = setTimeout(() => {
                        setScenarioIndex(prev => prev + 1);
                        setIncidents([]);
                        setDemoStage('scanning');
                    }, 8000);
                    break;
            }
        };
        advanceStage();
        return () => clearTimeout(timer);
    }, [demoMode, demoStage, scenarioIndex, addLog, dispatchOfficer]);

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

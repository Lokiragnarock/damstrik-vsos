import React from 'react';
import { Shield, Navigation, Radio, CheckCircle } from 'lucide-react';

const DispatchModal = ({ isOpen, onClose, incident, officers, onDispatch, dispatching }) => {
    if (!isOpen || !incident) return null;

    // Simple fit score calculation for display (logic is in hook, but we need to sort for UI)
    const getScore = (officer) => {
        // Simplified for UI sorting
        const dist = Math.sqrt(Math.pow(officer.lat - incident.lat, 2) + Math.pow(officer.lng - incident.lng, 2));
        return Math.max(0, 100 - dist * 2000);
    };

    const sortedOfficers = [...officers]
        .filter(o => o.status !== 'busy')
        .sort((a, b) => getScore(b) - getScore(a));

    const bestOfficer = sortedOfficers[0];

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-red-500/20 flex items-center justify-center border border-red-500/50">
                            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Tactical Dispatch</h2>
                            <div className="text-xs text-slate-400 font-mono">INCIDENT ID: {incident.id.toUpperCase()}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        ✕ ESC
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 grid grid-cols-2 gap-6 overflow-y-auto">
                    {/* Incident Details */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Incident Profile</h3>
                        <div className="bg-slate-800/50 rounded p-4 border border-slate-700 space-y-3">
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase">Location</div>
                                <div className="text-white font-medium">{incident.location}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase">Description</div>
                                <div className="text-slate-300 text-sm">{incident.desc}</div>
                            </div>
                        </div>
                    </div>

                    {/* Recommended Unit */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Recommended Unit</h3>
                        {bestOfficer ? (
                            <div className="bg-blue-900/20 rounded p-4 border border-blue-500/30 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-50">
                                    <Shield className="w-12 h-12 text-blue-500/20" />
                                </div>
                                <div className="relative z-10">
                                    <div className="text-xl font-bold text-white mb-1">{bestOfficer.name}</div>
                                    <div className="text-xs text-blue-300 font-mono mb-3">{bestOfficer.badge} • {bestOfficer.vehicle}</div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Proximity Score</span>
                                            <span className="text-green-400 font-bold">{Math.round(getScore(bestOfficer))}% Match</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-green-500 h-full" style={{ width: `${getScore(bestOfficer)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 italic text-sm">No available units nearby.</div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button
                        disabled={!bestOfficer || dispatching}
                        onClick={() => onDispatch(bestOfficer.id, incident.id)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                    >
                        {dispatching ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                TRANSMITTING...
                            </>
                        ) : (
                            <>
                                <Navigation className="w-4 h-4" />
                                AUTHORIZE DISPATCH
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DispatchModal;

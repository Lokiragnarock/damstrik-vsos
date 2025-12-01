import React, { useRef, useEffect } from 'react';
import { Shield, Radio, Activity, Users, Server, AlertTriangle, MapPin, Clock, CheckCircle } from 'lucide-react';
import { CRIME_TYPES } from '../data/constants';

export const IngestionLogs = ({ logs }) => {
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

export const Sidebar = ({ officers, incidents, onOfficerClick, onIncidentClick }) => {
    return (
        <div className="col-span-2 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-white">DAMSTRIK <span className="text-blue-500">V.O.S</span></h1>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            OPERATIONAL
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 p-2 border-b border-slate-800">
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Active Units</div>
                    <div className="text-xl font-bold text-blue-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {officers.filter(o => o.status !== 'busy').length}/{officers.length}
                    </div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Incidents</div>
                    <div className="text-xl font-bold text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {incidents.filter(i => i.status !== 'assigned').length}
                    </div>
                </div>
            </div>

            {/* Active Incidents List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Live Incidents</div>
                {incidents.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs italic">No active incidents reported.</div>
                ) : (
                    incidents.map(inc => (
                        <div
                            key={inc.id}
                            onClick={() => onIncidentClick(inc)}
                            className={`p-3 rounded border cursor-pointer transition-all hover:bg-slate-800 ${inc.status === 'assigned' ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-800/80 border-slate-700 hover:border-blue-500/50'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CRIME_TYPES[inc.type]?.color} ${CRIME_TYPES[inc.type]?.bg} ${CRIME_TYPES[inc.type]?.border}`}>
                                    {CRIME_TYPES[inc.type]?.label}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{inc.time}</span>
                            </div>
                            <div className="text-sm font-medium text-slate-200 mb-1">{inc.location}</div>
                            <div className="text-xs text-slate-400 line-clamp-2">{inc.desc}</div>
                            {inc.status === 'assigned' && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-green-400 font-mono">
                                    <CheckCircle className="w-3 h-3" /> Unit Dispatched
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

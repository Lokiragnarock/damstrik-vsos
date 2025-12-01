import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ROAD_NODES, ZONES } from '../data/grid';
import { CRIME_TYPES } from '../data/constants';

const MapLayer = ({ officers, incidents, activeRoutes, heatmapMode, patrolCarMode, onOfficerClick, onIncidentClick }) => {
    return (
        <div className="flex-1 relative z-0 h-full">
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

                {/* CRIME HEATMAP - Translucent overlay */}
                {incidents.map(inc => (
                    <Circle
                        key={`heatmap-${inc.id}`}
                        center={[inc.lat, inc.lng]}
                        radius={300}
                        pathOptions={{
                            color: inc.status === 'assigned' ? '#10b981' : '#ef4444',
                            fillColor: inc.status === 'assigned' ? '#10b981' : '#ef4444',
                            fillOpacity: 0.2,
                            weight: 0,
                            className: inc.status === 'assigned' ? '' : 'animate-pulse'
                        }}
                    />
                ))}

                {/* ROUTES - Now straight lines */}
                {Object.entries(activeRoutes).map(([incId, route]) => {
                    return <Polyline key={incId} positions={route} pathOptions={{ color: '#22c55e', dashArray: '5, 10', weight: 2 }} />;
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
                            click: () => onOfficerClick && onOfficerClick(officer),
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
                            click: () => onIncidentClick && onIncidentClick(inc)
                        }}
                    />
                ))}
            </MapContainer>
        </div>
    );
};

export default MapLayer;

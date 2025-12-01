// Map Configuration
const BLR_COORDS = [12.9290, 77.6200]; // Koramangala/Madiwala Center
const map = L.map('view-map').setView(BLR_COORDS, 14);

// Dark Mode Map Tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Layers
let roadLayer = L.layerGroup().addTo(map);
let heatLayer = null;

// Icons (SVG Strings)
const getAssetIcon = (type) => {
    let color = '#3b82f6'; // Blue
    let svg = '';

    if (type === 'PCR') {
        // Car Icon
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
    } else if (type === 'BIKE') {
        // Bike Icon
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`;
    } else {
        // Foot/User Icon
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    }

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="width:24px; height:24px;">${svg}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const eventIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div class='animate-ping' style='background-color:#ef4444; width:16px; height:16px; border-radius:50%; opacity:0.7;'></div><div style='background-color:#ef4444; width:8px; height:8px; border-radius:50%; position:absolute; top:4px; left:4px;'></div>",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// Tab Switching Logic
window.switchTab = function (tabName) {
    ['map', 'audit', 'logs'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('text-vos-accent', 'border-b-2', 'border-vos-accent');
        document.getElementById(`tab-${t}`).classList.add('text-slate-400');
    });
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('text-vos-accent', 'border-b-2', 'border-vos-accent');
    document.getElementById(`tab-${tabName}`).classList.remove('text-slate-400');
    if (tabName === 'map') map.invalidateSize();
}

// State
const markers = {
    assets: {},
    events: {}
};
let roadNetworkDrawn = false;

// WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
const socket = new WebSocket(wsUrl);

socket.onopen = () => console.log("Connected to V-OS Logic Engine");
socket.onmessage = (event) => updateDashboard(JSON.parse(event.data));

function updateDashboard(data) {
    document.getElementById('stat-assets').innerText = data.assets.length;
    document.getElementById('stat-events').innerText = data.events.length;

    // 1. Draw Road Network (Once)
    if (!roadNetworkDrawn && data.road_network) {
        const nodes = data.road_network.nodes;
        const edges = data.road_network.edges;

        // Draw Edges
        Object.keys(edges).forEach(nodeId => {
            const start = nodes[nodeId];
            edges[nodeId].forEach(neighborId => {
                const end = nodes[neighborId];
                L.polyline([start, end], {
                    color: '#334155', // Slate-700
                    weight: 3,
                    opacity: 0.5,
                    dashArray: '5, 10'
                }).addTo(roadLayer);
            });
        });

        // Draw Nodes (Intersections)
        Object.values(nodes).forEach(coord => {
            L.circleMarker(coord, {
                radius: 3,
                fillColor: '#94a3b8',
                color: '#000',
                weight: 1,
                opacity: 0.5,
                fillOpacity: 0.5
            }).addTo(roadLayer);
        });

        roadNetworkDrawn = true;
    }

    // 2. Update Heatmap
    if (data.heatmap) {
        if (heatLayer) {
            heatLayer.setLatLngs(data.heatmap);
        } else {
            // Check if L.heatLayer exists (script loaded)
            if (L.heatLayer) {
                heatLayer = L.heatLayer(data.heatmap, {
                    radius: 25,
                    blur: 15,
                    maxZoom: 17,
                    gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
                }).addTo(map);
            }
        }
    }

    // 3. Update Assets
    data.assets.forEach(asset => {
        if (markers.assets[asset.asset_id]) {
            markers.assets[asset.asset_id].setLatLng([asset.location.lat, asset.location.lng]);
        } else {
            const marker = L.marker([asset.location.lat, asset.location.lng], {
                icon: getAssetIcon(asset.type)
            }).bindPopup(`<b>${asset.asset_id}</b><br>${asset.type}<br>${asset.status}`)
                .addTo(map);
            markers.assets[asset.asset_id] = marker;
        }
    });

    // 4. Update Events
    const feed = document.getElementById('event-feed');
    if (feed.children.length === 1 && feed.children[0].classList.contains('italic')) {
        feed.innerHTML = '';
    }

    data.events.forEach(evt => {
        if (!markers.events[evt.event_id]) {
            const marker = L.marker([evt.location.lat, evt.location.lng], { icon: eventIcon })
                .bindPopup(`<b>${evt.type}</b><br>Severity: ${evt.severity}<br>${evt.status}`)
                .addTo(map);
            markers.events[evt.event_id] = marker;

            const card = document.createElement('div');
            card.className = "bg-slate-800 p-3 rounded border-l-4 border-vos-alert animate-fade-in";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-white text-sm">${evt.type}</h3>
                    <span class="text-xs bg-red-900 text-red-200 px-1 rounded">LVL ${evt.severity}</span>
                </div>
                <div class="text-xs text-slate-400 mt-1">ID: ${evt.event_id.split('-')[2]}</div>
            `;
            feed.prepend(card);
        }
    });

    // 5. Update Audit & Logs
    const auditBody = document.getElementById('audit-table-body');
    auditBody.innerHTML = data.assets.map(a => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50">
            <td class="p-3 font-bold text-blue-400">${a.asset_id}</td>
            <td class="p-3">${a.type}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs ${a.status === 'IDLE' ? 'bg-green-900 text-green-200' : 'bg-blue-900 text-blue-200'}">${a.status}</span></td>
            <td class="p-3">${new Date(a.shift_start).toLocaleTimeString()}</td>
            <td class="p-3">${a.time_worked_minutes.toFixed(1)} min</td>
            <td class="p-3">
                <div class="w-24 bg-slate-700 rounded h-2">
                    <div class="bg-red-500 h-2 rounded" style="width: ${a.fatigue_level * 100}%"></div>
                </div>
            </td>
        </tr>
    `).join('');

    const logsConsole = document.getElementById('logs-console');
    if (data.logs) {
        logsConsole.innerHTML = data.logs.map(l => `
            <div class="mb-1">
                <span class="text-slate-500">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
                <span class="text-yellow-500">${l.source}</span>: 
                <span class="text-green-400">${l.raw_data}</span>
            </div>
        `).join('');
    }
}

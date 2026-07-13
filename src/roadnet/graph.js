// Road graph built once at import time from the baked OSM extract (src/data/roadnet.json).
// Cars are physically constrained to this graph: nearestPointOnGraph() snaps any point onto
// it, shortestPath() routes along real street geometry, randomWalkStep() drives idle patrol.
import roadnet from '../data/roadnet.json';

// Planar distance in km (fine at city scale) - same formula as the old OSRM helper.
const distKm = (a, b) => {
    const dLat = (b.lat - a.lat) * 110.574;
    const dLng = (b.lng - a.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
};

// --- BUILD: split OSM ways into edges at intersection nodes ---

function buildGraph() {
    const ways = roadnet.ways;

    // A node is an intersection if it's shared by >=2 ways, or it's a dead-end
    // (first/last node of any way).
    const wayCountByNode = new Map();
    for (const way of ways) {
        const seen = new Set(way.nodes);
        for (const nodeId of seen) {
            wayCountByNode.set(nodeId, (wayCountByNode.get(nodeId) || 0) + 1);
        }
    }
    const intersectionSet = new Set();
    for (const [nodeId, count] of wayCountByNode) {
        if (count >= 2) intersectionSet.add(nodeId);
    }
    for (const way of ways) {
        intersectionSet.add(way.nodes[0]);
        intersectionSet.add(way.nodes[way.nodes.length - 1]);
    }

    const nodes = new Map(); // nodeId -> {lat, lng}
    const edges = new Map(); // edgeId -> edge
    const adjacency = new Map(); // nodeId -> [{edgeId, to, forward}]
    const ensureNode = (nodeId, lat, lng) => {
        if (!nodes.has(nodeId)) nodes.set(nodeId, { lat, lng });
        if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);
    };

    let edgeCounter = 0;
    for (const way of ways) {
        const n = way.nodes.length;
        let startIdx = 0;
        for (let i = 1; i < n; i++) {
            const isLast = i === n - 1;
            if (!intersectionSet.has(way.nodes[i]) && !isLast) continue;

            const aId = way.nodes[startIdx];
            const bId = way.nodes[i];
            const coords = [];
            for (let k = startIdx; k <= i; k++) {
                coords.push({ lat: way.geometry[k][0], lng: way.geometry[k][1] });
            }
            ensureNode(aId, coords[0].lat, coords[0].lng);
            ensureNode(bId, coords[coords.length - 1].lat, coords[coords.length - 1].lng);

            let lengthKm = 0;
            const cumKm = [0];
            for (let k = 1; k < coords.length; k++) {
                lengthKm += distKm(coords[k - 1], coords[k]);
                cumKm.push(lengthKm);
            }

            if (lengthKm > 1e-9 && aId !== bId) {
                const edgeId = `e${edgeCounter++}`;
                const edge = { id: edgeId, a: aId, b: bId, coords, cumKm, lengthKm, oneway: !!way.oneway, highway: way.highway || 'unclassified' };
                edges.set(edgeId, edge);
                adjacency.get(aId).push({ edgeId, to: bId, forward: true });
                if (!way.oneway) {
                    adjacency.get(bId).push({ edgeId, to: aId, forward: false });
                }
            }

            startIdx = i;
        }
    }

    return { nodes, edges, adjacency };
}

const GRAPH = buildGraph();

// --- helpers over a single edge ---

// Ordered coords for traversing the edge in the given direction.
const orientedCoords = (edge, forward) => (forward ? edge.coords : [...edge.coords].reverse());

// Point at fractional distance t (0-1) along the edge, from a to b.
function pointAtT(edge, t) {
    const targetKm = Math.max(0, Math.min(1, t)) * edge.lengthKm;
    const { coords, cumKm } = edge;
    for (let i = 1; i < coords.length; i++) {
        if (cumKm[i] >= targetKm) {
            const segLen = cumKm[i] - cumKm[i - 1];
            const f = segLen < 1e-9 ? 0 : (targetKm - cumKm[i - 1]) / segLen;
            return {
                lat: coords[i - 1].lat + (coords[i].lat - coords[i - 1].lat) * f,
                lng: coords[i - 1].lng + (coords[i].lng - coords[i - 1].lng) * f
            };
        }
    }
    return coords[coords.length - 1];
}

// Coords from t=tStart to t=tEnd along the edge (either direction), inclusive of endpoints.
function sliceBetween(edge, tStart, tEnd) {
    const forward = tEnd >= tStart;
    const lo = Math.min(tStart, tEnd);
    const hi = Math.max(tStart, tEnd);
    const { coords, cumKm, lengthKm } = edge;
    const loKm = lo * lengthKm;
    const hiKm = hi * lengthKm;
    const pts = [pointAtT(edge, lo)];
    for (let i = 0; i < coords.length; i++) {
        if (cumKm[i] > loKm && cumKm[i] < hiKm) pts.push(coords[i]);
    }
    pts.push(pointAtT(edge, hi));
    return forward ? pts : pts.reverse();
}

// --- exported API ---

// Project (lat,lng) onto the nearest edge in the graph.
export function nearestPointOnGraph(lat, lng) {
    const p = { lat, lng };
    let best = null;
    for (const edge of GRAPH.edges.values()) {
        const { coords, cumKm, lengthKm } = edge;
        for (let i = 1; i < coords.length; i++) {
            const a = coords[i - 1];
            const b = coords[i];
            // Project p onto segment a-b in a locally-planar frame anchored at a.
            const ax = 0, ay = 0;
            const bx = (b.lng - a.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
            const by = (b.lat - a.lat) * 110.574;
            const px = (lng - a.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
            const py = (lat - a.lat) * 110.574;
            const segLenSq = bx * bx + by * by;
            let segT = segLenSq < 1e-12 ? 0 : ((px * bx + py * by) / segLenSq);
            segT = Math.max(0, Math.min(1, segT));
            const projX = ax + segT * bx;
            const projY = ay + segT * by;
            const dx = px - projX, dy = py - projY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!best || dist < best.dist) {
                const projLat = a.lat + segT * (b.lat - a.lat);
                const projLng = a.lng + segT * (b.lng - a.lng);
                const segKm = cumKm[i - 1] + segT * (cumKm[i] - cumKm[i - 1]);
                best = {
                    dist,
                    edgeId: edge.id,
                    a: edge.a,
                    b: edge.b,
                    t: lengthKm < 1e-9 ? 0 : segKm / lengthKm,
                    lat: projLat,
                    lng: projLng,
                    lengthKm
                };
            }
        }
    }
    if (!best) return null;
    const { dist, ...result } = best;
    return result;
}

// Dijkstra (weights = km) from a set of weighted sources to all reachable nodes.
function dijkstraFrom(origins) {
    const dist = new Map();
    const prev = new Map(); // nodeId -> { from, edgeId, forward }
    const visited = new Set();
    for (const { node, cost } of origins) {
        if (!dist.has(node) || cost < dist.get(node)) dist.set(node, cost);
    }
    // Simple array-based priority queue - graph is small enough (a few thousand
    // nodes) that this runs comfortably for a per-dispatch route calculation.
    while (true) {
        let currentNode = null;
        let currentDist = Infinity;
        for (const [node, d] of dist) {
            if (!visited.has(node) && d < currentDist) {
                currentDist = d;
                currentNode = node;
            }
        }
        if (currentNode === null) break;
        visited.add(currentNode);

        const arcs = GRAPH.adjacency.get(currentNode) || [];
        for (const arc of arcs) {
            const edge = GRAPH.edges.get(arc.edgeId);
            const newDist = currentDist + edge.lengthKm;
            if (!dist.has(arc.to) || newDist < dist.get(arc.to)) {
                dist.set(arc.to, newDist);
                prev.set(arc.to, { from: currentNode, edgeId: arc.edgeId, forward: arc.forward });
            }
        }
    }
    return { dist, prev };
}

function reconstructNodePath(prev, sourceNodes, destNode) {
    const hops = []; // { edgeId, forward } from source to destNode, in order
    let node = destNode;
    while (!sourceNodes.has(node)) {
        const p = prev.get(node);
        if (!p) return null; // unreachable
        hops.unshift({ edgeId: p.edgeId, forward: p.forward });
        node = p.from;
    }
    return { sourceNode: node, hops };
}

// Route from fromPos {lat,lng} to toPos {lat,lng}, following real street geometry.
// Snaps both ends onto the graph and stitches in the partial first/last edge geometry.
export function shortestPath(fromPos, toPos) {
    const fromSnap = nearestPointOnGraph(fromPos.lat, fromPos.lng);
    const toSnap = nearestPointOnGraph(toPos.lat, toPos.lng);
    if (!fromSnap || !toSnap) return [{ ...fromPos, highway: 'unclassified', isNode: true }, { ...toPos, highway: 'unclassified', isNode: true }];

    if (fromSnap.edgeId === toSnap.edgeId) {
        const edge = GRAPH.edges.get(fromSnap.edgeId);
        return sliceBetween(edge, fromSnap.t, toSnap.t).map((c, i, arr) => ({ ...c, highway: edge.highway, isNode: i === 0 || i === arr.length - 1 }));
    }

    const fromEdge = GRAPH.edges.get(fromSnap.edgeId);
    const toEdge = GRAPH.edges.get(toSnap.edgeId);

    // The vehicle is physically already on fromEdge, so it can leave toward either end.
    const origins = [
        { node: fromEdge.a, cost: fromSnap.t * fromEdge.lengthKm },
        { node: fromEdge.b, cost: (1 - fromSnap.t) * fromEdge.lengthKm }
    ];
    // Arriving at the destination point requires travelling along toEdge in an
    // allowed direction: from a is always fine (forward arc), from b needs !oneway.
    const destinations = [{ node: toEdge.a, cost: toSnap.t * toEdge.lengthKm }];
    if (!toEdge.oneway) {
        destinations.push({ node: toEdge.b, cost: (1 - toSnap.t) * toEdge.lengthKm });
    }

    const { dist, prev } = dijkstraFrom(origins);
    const sourceNodes = new Set(origins.map(o => o.node));

    let best = null;
    for (const d of destinations) {
        if (!dist.has(d.node)) continue;
        const total = dist.get(d.node) + d.cost;
        if (!best || total < best.total) {
            best = { total, node: d.node, destCost: d.cost, isA: d.node === toEdge.a };
        }
    }
    if (!best) return [fromPos, toPos]; // disconnected components - fall back to direct line

    const recon = reconstructNodePath(prev, sourceNodes, best.node);
    if (!recon) return [fromPos, toPos];

    const path = [];
    // isNode marks points that sit at a real graph intersection (edge boundary),
    // as opposed to an interior shape vertex along a single way - used to apply
    // junction slow-downs in the speed model.
    const pushCoords = (coords, highway, markNodesAt) => {
        for (let k = 0; k < coords.length; k++) {
            const c = coords[k];
            const lastPt = path[path.length - 1];
            if (lastPt && Math.abs(lastPt.lat - c.lat) < 1e-9 && Math.abs(lastPt.lng - c.lng) < 1e-9) continue;
            const isNode = markNodesAt ? markNodesAt.has(k) : false;
            path.push({ lat: c.lat, lng: c.lng, highway, isNode });
        }
    };

    // Partial geometry from the snapped start point to the chosen origin node.
    const fromCoords = sliceBetween(fromEdge, fromSnap.t, recon.sourceNode === fromEdge.a ? 0 : 1);
    pushCoords(fromCoords, fromEdge.highway, new Set([fromCoords.length - 1]));
    // Full edges along the node path.
    for (const hop of recon.hops) {
        const edge = GRAPH.edges.get(hop.edgeId);
        const coords = orientedCoords(edge, hop.forward);
        pushCoords(coords, edge.highway, new Set([coords.length - 1]));
    }
    // Partial geometry from the destination node to the snapped end point.
    pushCoords(sliceBetween(toEdge, best.isA ? 0 : 1, toSnap.t), toEdge.highway, null);

    if (path.length && path[0].isNode === undefined) path[0].isNode = true;
    return path;
}

// Pick the next edge to patrol along from `pos` (assumed at/near a graph node),
// avoiding an immediate U-turn back to prevNodeId unless it's a dead end.
export function randomWalkStep(pos, prevNodeId) {
    let nearestNodeId = null;
    let nearestDist = Infinity;
    for (const [nodeId, n] of GRAPH.nodes) {
        const d = distKm(pos, n);
        if (d < nearestDist) {
            nearestDist = d;
            nearestNodeId = nodeId;
        }
    }
    if (nearestNodeId === null) return null;

    const arcs = GRAPH.adjacency.get(nearestNodeId) || [];
    if (arcs.length === 0) return null;

    let choices = arcs.filter(arc => arc.to !== prevNodeId);
    if (choices.length === 0) choices = arcs; // dead end - allow U-turn

    const arc = choices[Math.floor(Math.random() * choices.length)];
    const edge = GRAPH.edges.get(arc.edgeId);
    return {
        edgeId: arc.edgeId,
        fromNodeId: nearestNodeId,
        toNodeId: arc.to,
        coords: orientedCoords(edge, arc.forward),
        lengthKm: edge.lengthKm,
        highway: edge.highway
    };
}

// All edges, for the debug "ROADNET" overlay.
export function allEdges() {
    return Array.from(GRAPH.edges.values()).map(e => ({ id: e.id, coords: e.coords }));
}

export function graphStats() {
    return { nodeCount: GRAPH.nodes.size, edgeCount: GRAPH.edges.size };
}

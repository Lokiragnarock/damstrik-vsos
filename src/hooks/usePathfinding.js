import { useCallback } from 'react';
import { ROAD_NODES, ROAD_EDGES } from '../data/grid';

// Build Adjacency List
const ADJ_LIST = {};
Object.keys(ROAD_NODES).forEach(id => ADJ_LIST[id] = []);
ROAD_EDGES.forEach(([a, b]) => {
    ADJ_LIST[a].push(b);
    ADJ_LIST[b].push(a);
});

export const usePathfinding = () => {

    const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
        return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
    }, []);

    const getNearestNode = useCallback((lat, lng) => {
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
    }, []);

    const findPath = useCallback((startNodeId, endNodeId) => {
        const openSet = [startNodeId];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        Object.keys(ROAD_NODES).forEach(id => {
            gScore[id] = Infinity;
            fScore[id] = Infinity;
        });

        gScore[startNodeId] = 0;
        const straightLineDist = calculateDistance(
            ROAD_NODES[startNodeId].lat, ROAD_NODES[startNodeId].lng,
            ROAD_NODES[endNodeId].lat, ROAD_NODES[endNodeId].lng
        );
        fScore[startNodeId] = straightLineDist;

        while (openSet.length > 0) {
            let current = openSet.reduce((lowest, node) => {
                return fScore[node] < fScore[lowest] ? node : lowest;
            }, openSet[0]);

            if (current === endNodeId) {
                const path = [current];
                while (current in cameFrom) {
                    current = cameFrom[current];
                    path.unshift(current);
                }

                // Check if path is inefficient (more than 1.5x straight line distance)
                let pathDist = 0;
                for (let i = 0; i < path.length - 1; i++) {
                    pathDist += calculateDistance(
                        ROAD_NODES[path[i]].lat, ROAD_NODES[path[i]].lng,
                        ROAD_NODES[path[i + 1]].lat, ROAD_NODES[path[i + 1]].lng
                    );
                }

                // If path is too long, just use direct route
                if (pathDist > straightLineDist * 1.5) {
                    return [startNodeId, endNodeId];
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
        return [startNodeId, endNodeId]; // Fallback - direct route
    }, [calculateDistance]);

    return { calculateDistance, getNearestNode, findPath };
};

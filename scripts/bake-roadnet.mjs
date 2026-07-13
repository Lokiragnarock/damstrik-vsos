// One-time (re-runnable) dev script: pulls the OSM road network for the demo's
// Koramangala/Madiwala bbox from Overpass and bakes it into src/data/roadnet.json.
// Run with: node scripts/bake-roadnet.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'roadnet.json');

// The bare overpass-api.de/api/interpreter endpoint returns a blanket 406 for every
// request from this network (even with no query) - some kind of edge/WAF block
// unrelated to query syntax. The lz4-load-balanced subdomain works fine.
const OVERPASS_URL = 'https://lz4.overpass-api.de/api/interpreter';
const BBOX = '12.905,77.585,12.965,77.650';

// Drop 'residential' if the output is too large (>4MB) and re-run.
const HIGHWAY_TYPES = [
    'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
    'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
];

function buildQuery(types) {
    return `[out:json];way["highway"~"^(${types.join('|')})$"](${BBOX});out geom;`;
}

async function fetchOverpass(query) {
    const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        // Overpass's Apache front-end 406s Node's default undici User-Agent/Accept
        // headers; a browser/curl-style UA is required to get past it.
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'curl/8.17.0',
            'Accept': '*/*'
        },
        body: `data=${encodeURIComponent(query)}`
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    return res.json();
}

function compact(json) {
    const ways = [];
    for (const el of json.elements) {
        if (el.type !== 'way' || !el.geometry || !el.nodes) continue;
        ways.push({
            id: el.id,
            nodes: el.nodes,
            geometry: el.geometry.map(g => [
                Math.round(g.lat * 1e5) / 1e5,
                Math.round(g.lon * 1e5) / 1e5
            ]),
            oneway: el.tags?.oneway === 'yes'
        });
    }
    return { ways };
}

async function main() {
    let types = HIGHWAY_TYPES;
    console.log(`Fetching Overpass data for bbox [${BBOX}] with highways: ${types.join(', ')}`);
    let json = await fetchOverpass(buildQuery(types));
    let data = compact(json);
    let bytes = Buffer.byteLength(JSON.stringify(data));
    console.log(`Ways: ${data.ways.length}, size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);

    if (bytes > 4 * 1024 * 1024 && types.includes('residential')) {
        console.log('Output >4MB, dropping "residential" and re-fetching...');
        types = types.filter(t => t !== 'residential');
        json = await fetchOverpass(buildQuery(types));
        data = compact(json);
        bytes = Buffer.byteLength(JSON.stringify(data));
        console.log(`Ways: ${data.ways.length}, size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    }

    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(data));
    console.log(`Wrote ${OUT_PATH}`);
}

main().catch(err => {
    console.error('bake-roadnet failed:', err);
    process.exit(1);
});

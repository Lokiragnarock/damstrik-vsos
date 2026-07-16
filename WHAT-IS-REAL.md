# ⚠️ WHAT IS REAL AND WHAT IS FAKE — READ BEFORE TOUCHING THIS APP ⚠️

If you are about to work on damstrik-vsos: this file is the contract. The demo mixes real
engineering with staged theater. Confusing the two in front of a judge, a cop, or an investor
kills us. Know which side of the line you're standing on.

## REAL — actually computed, defensible under questioning

| Thing | How it's real |
|---|---|
| Road network | 7,841 real OSM ways of Koramangala/Madiwala baked into `src/data/roadnet.json` (12.5k nodes / 17k edges) |
| Routing | A* over that graph, respects one-way streets; movement is graph-locked — a unit *cannot* be off-road by construction |
| Dispatch choice | Deterministic fit score: skill match × distance × fatigue. Simple, real, explainable |
| Click-anywhere dispatch | Any map point snaps to the nearest real road and gets a real route |
| Speeds (post-S2) | Kinematic model, per-road-class km/h, sim clock at a declared multiplier (SIM 8× badge). Speedometer shows true model speed |
| Patrol sectors (post-S1) | Greedy weighted assignment of units to hotspot clusters, live rebalancing |

## FAKE — canned theater, never present it as live capability

| Thing | What it actually is |
|---|---|
| Incidents / 911 calls | Scripted generator. No Dial-112 integration exists |
| Call transcripts + "keyword detection" | Hardcoded strings on a timer |
| "Genesis AI" tactical advisory | Canned text (or a generic Gemini call if a key is set — still not our model) |
| Officer roster, fatigue %, bios | Invented |
| Confidence percentages ("94%") | Literals in the source |
| Predictive alerts / weather correlation | Staged log lines |

**Dev rules:** tag every staged value with `// SIM:` in code · never add a fake number without
adding it to this table · demo narration must say "simulated feed" for anything in this table.

## THE PROMISE — what we tell judges we will build (and where the AI actually goes)

This is the roadmap we're selling. Each insertion point replaces one FAKE row above:

1. **Call → structured incident.** STT on Dial-112 audio → LLM extraction (type, location,
   severity, victim state). Replaces the canned transcripts. Hardest data access, highest value.
2. **Learned dispatch ranking.** Today's fit score becomes a trained ranking model on historical
   dispatch outcomes (response time, resolution, escalation). The heuristic is the honest v0.
3. **Hotspot forecasting.** Model trained on FIR/NCRB history (damstrik-core's sim engine already
   generates NCRB-rate synthetic events for exactly this bootstrapping). Replaces hand-placed ZONES.
4. **Patrol routing optimization.** Sector assignment becomes a real coverage optimizer
   (max coverage of predicted risk under unit-count constraints) instead of greedy assignment.
5. **Advisory LLM with SOP grounding.** Tactical advice RAG'd over Karnataka Police SOPs — replaces
   Genesis AI theater.

**What the app IS, in one sentence:** a real routing + allocation engine wearing a simulated
city as a costume, with five marked sockets where trained models plug in.

# Judge Console — Interaction Spec (Stream 5)

> Status: DESIGN NOTES — drives the S3 build (more officers, more crimes, live allocation).
> The point: judges stop watching a movie and start running a police force.

## The core loop we hand the judges

1. **Start a crime.** Click anywhere on the map → crime-type picker pops at the click point
   (Theft / Assault / Traffic / Public Order + severity Low/High/Critical). Point snaps to the
   nearest road. This already half-exists (click-to-dispatch); it needs the picker instead of
   auto-creating a fixed type.
2. **Watch the force respond.** Best unit routes there on real streets at real (sim-scaled) speed.
3. **Break the force.** A visible **Crime Intensity dial** (Calm Night → Festival Chaos) drives the
   incident generator rate. Judges crank it. Queue builds. This is the money moment.
4. **Feel the decision.** When the queue is non-empty and no units are free, the system flashes
   **FORCE SATURATED** and *recommends* action: "Deploy reserve unit — predicted response time
   drops 6m40s → 2m10s." A **[Deploy Reserve]** button spawns a fresh unit from the station.
   The judge presses the button. The judge *is* the commissioner. That's the pitch.

## Force Levels panel (always visible)

Per-unit rows:
- status chip: PATROL / EN-ROUTE / ON-SCENE / RETURNING
- live speed (from S2 speedometer), assigned sector (from S1 clustering)
- fatigue %, incidents handled this shift

Aggregates (top strip):
- Units free vs busy (e.g. 3/12)
- **Avg response time** and **P95 response time** this session
- Hotspot coverage % (how many weighted hotspots have a unit in-sector)
- Incident queue depth (0 = green, 1-2 = amber, 3+ = red + saturation banner)

## Escalation mechanics (what "increase workload" means concretely)

- Every incident gets a running timer from creation → unit arrival. Timers are public and red when
  breaching target (e.g. 5 sim-minutes).
- When saturated: incoming incidents queue, sorted by priority; the system shows WHICH incident it
  would drop coverage for and WHY (priority × wait time). Transparency = credibility.
- Reserve units: max 3, each deploy visibly worsens a "budget" counter — makes the resource
  tradeoff honest, invites the "so how do you optimize staffing?" question we WANT judges to ask.

## What this stream is NOT

Not analytics dashboards, not login/roles, not mobile. One screen, one loop: create pressure →
see strain → make the allocation call.

## Build order (S3 implementation)

1. Incident generator w/ intensity dial (Poisson-ish arrivals weighted toward high-risk zones)
2. 12-officer roster + queue + response timers
3. Force Levels panel + saturation banner + [Deploy Reserve]
4. Crime-type picker on map click

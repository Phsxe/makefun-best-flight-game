# Dawn Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game for the [make.fun best-flight-game competition](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a small prop plane — the Courier — on dawn missions over a mountain valley: take off from the runway, complete one of three missions, then bring her home and land on the runway for the finish screen. Crash into the mountains and the run is over. Fuel is limited and the airframe wears with every hard arrival, so throttle discipline and gentle landings matter. Fly from the chase camera or from the cockpit — a first-person view with live instruments — and chain all three missions into one tour with fuel and damage carrying over.

Everything is original and built for this entry: the plane, the valley, the dawn sky, the sounds, and the flight model. It runs offline in a desktop browser from its own files — no network requests, no build step.

## Missions

Pick one on the start screen (or press **1**, **2**, **3**, **4**). All fly in the same valley, and each ends by landing on the runway.

1. **Ring Run** — fly the eight glowing gold rings in order, then land. Each ring is **+100 points**, and flying rings back-to-back within 20 seconds builds a **combo** (×2, ×3…) that multiplies the points. Par 5:00.
2. **Cargo Drop** — carry a wooden crate to the marked drop zone north of the bridge and release it with **C** (or the Drop button). Score by accuracy: up to **+500** for a bullseye, down to +50 at the edge. Then fly home and land. Par 4:00.
3. **Mountain Rescue** — fly to the flashing beacon on the high west ridge, land on the helipad (or creep in slow and low) to pick up the stranded hiker, then bring them back to the runway. The pickup is **+600**. Par 6:00.
4. **Fly the Tour** — all three missions in one sortie: Ring Run, then Cargo Drop, then Mountain Rescue. Fuel and damage carry across the legs — the tank only refills and the airframe only mends while the Courier sits on the runway between legs — so a rough first leg costs the whole tour. Each leg scores on its own, and finishing all three earns a **+500 tour bonus**. Par 15:00.

Finishing inside par earns a **time bonus** (+2 points per second under par). A mission is only complete once the plane is back on the runway.

## Cockpit view

Press **V** (or the Cockpit button) to fly from the pilot's seat. The camera sits at the canopy and rolls with the plane; the dashboard shelf, engine cowl, wing roots, canopy frame and a spinning prop frame the windscreen, and a strip of live instruments along the bottom reads the flight state every frame: an artificial horizon, an altimeter, an airspeed indicator, a compass strip, fuel and damage gauges, and a throttle indicator. The instruments are drawn by the game's own code, never a picture — the needles move with the plane. Press **V** again (or the button, which reads Chase View) to go back to the chase camera. The cockpit is flyable through every mission and the whole tour.

## Fuel and damage

- **Fuel** drains with the throttle — faster at full throttle, slower on the ground. A full tank is about four minutes of cruising. Land on the runway to refuel (25%/s), or fly through a glowing teal **fuel ring** (+50). Running dry means **engine out**: the prop stops and the plane glides, so plan the descent to a strip. The HUD fuel gauge turns red below 22%.
- **Damage** rises with hard landings, steep impacts and terrain scrapes. A gentle touchdown is free; a firm one costs up to 35%. The HUD damage meter fills as the airframe wears, the engine trails smoke above 40% and thicker smoke above 70%, and at **100% the airframe is wrecked**. Land slow, level, and on the strip.

## Precision landing

Every touchdown on the runway is scored: how close to the centreline the wheels touched, and how gently. A dead-centre kiss is worth **+200**; a firm or off-centre arrival earns little, and a landing off the strip earns nothing. The grade (PERFECT, GOOD, FIRM, ROUGH, or OFF STRIP) is announced as you touch down and printed on the finish screen, so a careful pilot can see the landing paid — and a rough one can see what it cost.

## The valley

The dawn valley is a hand-built low-poly landscape: a river running its length with a bridge, a lake at the north end with a lighthouse whose beam turns, a dam, a small town with lit windows beside the runway, and a snow-capped peak on the west ridge with a flag. The wind gusts across the valley (the HUD shows direction and speed) and pushes the plane, the clouds drift, and a light fog hangs in the valley.

## How to play

1. Serve `game/` with any static server (for example `npx serve game` or `python3 -m http.server --directory game`) and open `index.html`.
2. Pick a mission, then press **Enter** (or click **Take off**) to start. Hold **Shift** to spool the throttle up, pull up with **W** / **↑** to lift off.
3. Follow the HUD arrow to your objective: the next ring, the drop zone, or the rescue beacon. The mission bar at the top tells you what to do next.
4. Land on the runway to finish: come down gently and slowly on the flat strip. A gentle touchdown completes the mission and adds the time bonus.
5. Land anywhere else gently and you can take off again from the field. Come down hard, fast, or onto a steep slope and you crash — or damage the airframe badly enough to end the run.

The flight model is arcade-forgiving: it auto-levels gently when you let go, banks to turn, and sinks if you get too slow — so a first flight is flyable and a good one is still a skill.

## Controls

| Key | Action |
| --- | --- |
| **W / ↑** or **S / ↓** | Pitch up (climb) / pitch down (descend) |
| **A / ←** or **D / →** | Roll left / right (banks to turn) |
| **Shift** / **Ctrl** (or **+** / **-**) | Throttle up / down |
| **C** | Drop the cargo crate (Cargo Drop mission) |
| **V** | Toggle the cockpit view (first person, live instruments) |
| **1 / 2 / 3 / 4** | Pick a mission on the start screen (4 = Fly the Tour) |
| **Mouse drag** | Look around (the camera follows the plane) |
| **Mouse wheel** | Trim the throttle |
| **Enter** | Start / fly again |
| **R** | Restart after finishing or crashing |
| **M** | Mute / unmute sound |
| **Click** | The on-screen buttons (Take off, mission, Drop, Cockpit, Sound) |

The HUD shows altitude (feet), airspeed (knots), heading with a compass strip, wind direction and speed, throttle %, fuel and damage gauges, score, a mission-aware status readout (rings flown, drop result, or pickup state), a timer, a combo indicator when a streak is alive, an artificial horizon, and an arrow with the distance to the current objective. In the cockpit the same flight state reads on the instrument strip: attitude, altimeter, airspeed, compass, fuel, damage and throttle.

## Sound

All sound is made with the Web Audio API — no audio files. The engine hum rises with the throttle, the wind grows with speed, a chime rings for each ring flown, a low beep warns of low fuel, and there is a thud on landing, a whoosh for the cargo drop, a warm chime for the rescue pickup, and a fanfare on mission completion. Press **M** or the Sound button to mute.

## Screenshots

All three are real renders of this game's own code, taken in a browser at 1280×720. The first is the cover.

- **1-start.jpg** — The cockpit view in flight, the cover: from the pilot's seat, the dashboard, engine cowl, wing roots and spinning prop frame the windscreen, the live instruments read the flight (attitude, altitude, airspeed, compass, fuel 65%, damage 12%), and the third gold ring is 95 m ahead up the valley with a ×2 combo on the HUD and the river bridge ahead.
- **2-play.jpg** — Fly the Tour, leg 2, in chase view: the Courier carries the crate toward the amber drop zone, the tour HUD reads LEG 2/3, the tank is at 72% after the ring leg and the airframe carries 9% damage into the leg.
- **3-end.jpg** — Tour complete: all three legs flown, back on the runway, the finish screen breaking the tour down leg by leg (RING +3600 · CARGO +450 · RESCUE +600), the tour bonus, and the landing line — a perfect centred touchdown worth +185 — with the tank at 28% and 14% damage on the HUD.

## Files

- `game/` — the game itself: `index.html` plus `src/` (one module per job: world, plane, rings, flight, HUD, sound, input, screenshots, fuel, damage, missions, weather, landmarks, cargo, effects, cockpit, campaign, landing) and `vendor/three.module.min.js` (three.js r160, vendored).
- `screenshots/` — the three renders above.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the platform library, copied unchanged from the kit.

## License

MIT — see [LICENSE](LICENSE).

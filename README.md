# Dawn Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game for the [make.fun best-flight-game competition](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a small prop plane — the Courier — on dawn missions over a mountain valley: take off from the runway, complete one of three missions, then bring her home and land on the runway for the finish screen. Crash into the mountains and the run is over. Fuel is limited and the airframe wears with every hard arrival, so throttle discipline and gentle landings matter.

Everything is original and built for this entry: the plane, the valley, the dawn sky, the sounds, and the flight model. It runs offline in a desktop browser from its own files — no network requests, no build step.

## Missions

Pick one on the start screen (or press **1**, **2**, **3**). All three fly in the same valley, and each ends by landing on the runway.

1. **Ring Run** — fly the eight glowing gold rings in order, then land. Each ring is **+100 points**, and flying rings back-to-back within 20 seconds builds a **combo** (×2, ×3…) that multiplies the points. Par 5:00.
2. **Cargo Drop** — carry a wooden crate to the marked drop zone north of the bridge and release it with **C** (or the Drop button). Score by accuracy: up to **+500** for a bullseye, down to +50 at the edge. Then fly home and land. Par 4:00.
3. **Mountain Rescue** — fly to the flashing beacon on the high west ridge, land on the helipad (or creep in slow and low) to pick up the stranded hiker, then bring them back to the runway. The pickup is **+600**. Par 6:00.

Finishing inside par earns a **time bonus** (+2 points per second under par). A mission is only complete once the plane is back on the runway.

## Fuel and damage

- **Fuel** drains with the throttle — faster at full throttle, slower on the ground. A full tank is about four minutes of cruising. Land on the runway to refuel (25%/s), or fly through a glowing teal **fuel ring** (+50). Running dry means **engine out**: the prop stops and the plane glides, so plan the descent to a strip. The HUD fuel gauge turns red below 22%.
- **Damage** rises with hard landings, steep impacts and terrain scrapes. A gentle touchdown is free; a firm one costs up to 35%. The HUD damage meter fills as the airframe wears, the engine trails smoke above 40% and thicker smoke above 70%, and at **100% the airframe is wrecked**. Land slow, level, and on the strip.

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
| **1 / 2 / 3** | Pick a mission on the start screen |
| **Mouse drag** | Look around (the camera follows the plane) |
| **Mouse wheel** | Trim the throttle |
| **Enter** | Start / fly again |
| **R** | Restart after finishing or crashing |
| **M** | Mute / unmute sound |
| **Click** | The on-screen buttons (Take off, mission, Drop, Sound) |

The HUD shows altitude (feet), airspeed (knots), heading with a compass strip, wind direction and speed, throttle %, fuel and damage gauges, score, a mission-aware status readout (rings flown, drop result, or pickup state), a timer, a combo indicator when a streak is alive, an artificial horizon, and an arrow with the distance to the current objective.

## Sound

All sound is made with the Web Audio API — no audio files. The engine hum rises with the throttle, the wind grows with speed, a chime rings for each ring flown, a low beep warns of low fuel, and there is a thud on landing, a whoosh for the cargo drop, a warm chime for the rescue pickup, and a fanfare on mission completion. Press **M** or the Sound button to mute.

## Screenshots

All three are real renders of this game's own code, taken in a browser at 1280×720. The first is the cover.

- **1-start.jpg** — On the runway at dawn, engine warm, the Ring Run selected: the Courier sits on the strip with the hangar to the left, the river to the right, and the first gold ring 147 m ahead up the valley. The HUD shows a full tank and a clean airframe.
- **2-play.jpg** — Mid-flight in chase view: the Courier banks toward the third gold ring (95 m ahead, the crosshair on it) with the river bridge ahead, two rings already flown, a ×2 combo on the HUD, the tank at 65% and the airframe carrying 12% damage.
- **3-end.jpg** — Course complete: all eight rings flown, back on the runway, the finish screen showing 03:34, 800 ring points, an +86 time bonus, and a total of 886 — with the tank at 30% and 8% damage on the HUD.

## Files

- `game/` — the game itself: `index.html` plus `src/` (one module per job: world, plane, rings, flight, HUD, sound, input, screenshots, fuel, damage, missions, weather, landmarks, cargo, effects) and `vendor/three.module.min.js` (three.js r160, vendored).
- `screenshots/` — the three renders above.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the platform library, copied unchanged from the kit.

## License

MIT — see [LICENSE](LICENSE).

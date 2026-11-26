# Dawn Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Phsxe/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game for the [make.fun best-flight-game competition](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a small prop plane — the Courier — on a dawn mail run over a mountain valley: take off from the runway, thread eight glowing gold rings in order, then bring her home and land on the runway for the course-complete screen. Crash into the mountains and the run is over.

Everything is original and built for this entry: the plane, the valley, the dawn sky, the sounds, and the flight model. It runs offline in a desktop browser from its own files — no network requests, no build step.

## How to play

1. Serve `game/` with any static server (for example `npx serve game` or `python3 -m http.server --directory game`) and open `index.html`.
2. Press **Enter** (or click **Take off**) to start. Hold **Shift** to spool the throttle up, pull up with **W** / **↑** to lift off.
3. Fly through the gold ring — it is always the next one, and the HUD arrow points at it with the distance. Each ring is **+100 points**.
4. After the eighth ring, land on the runway: come down gently and slowly on the flat strip. A gentle touchdown with all eight rings flown completes the course and adds a time bonus (the faster, the more).
5. Land anywhere else gently and you can take off again from the field. Come down hard, fast, or onto a steep slope and you crash.

The flight model is arcade-forgiving: it auto-levels gently when you let go, banks to turn, and sinks if you get too slow — so a first flight is flyable and a good one is still a skill.

## Controls

| Key | Action |
| --- | --- |
| **W / ↑** or **S / ↓** | Pitch up (climb) / pitch down (descend) |
| **A / ←** or **D / →** | Roll left / right (banks to turn) |
| **Shift** / **Ctrl** (or **+** / **-**) | Throttle up / down |
| **Mouse drag** | Look around (the camera follows the plane) |
| **Mouse wheel** | Trim the throttle |
| **Enter** | Start / fly again |
| **R** | Restart after finishing or crashing |
| **M** | Mute / unmute sound |
| **Click** | The on-screen buttons (Take off, Fly again, Sound) |

The HUD shows altitude (feet), airspeed (knots), heading with a compass strip, throttle %, score, rings flown, a timer, an artificial horizon, and an arrow with the distance to the next ring.

## Sound

All sound is made with the Web Audio API — no audio files. The engine hum rises with the throttle, the wind grows with speed, a chime rings for each ring flown, and there is a thud on landing and a fanfare on course completion. Press **M** or the Sound button to mute.

## Screenshots

All three are real renders of this game's own code, taken in a browser at 1280×720. The first is the cover.

- **1-start.jpg** — On the runway at dawn, engine warm, HUD lit: the Courier sits on the strip with the hangar to the left, the river to the right, and the first gold ring 147 m ahead up the valley.
- **2-play.jpg** — Mid-flight in chase view: the Courier banks toward the third gold ring (95 m ahead, the crosshair on it), the valley, river and mountains below, the dawn sun in the sky, and the HUD reading 256 ft, 113 kt, heading 035°.
- **3-end.jpg** — Course complete: all eight rings flown, back on the runway, the finish screen showing 03:34, 800 ring points, an +86 time bonus, and a total of 886.

## Files

- `game/` — the game itself: `index.html` plus `src/` (one module per job: world, plane, rings, flight, HUD, sound, input, screenshots) and `vendor/three.module.min.js` (three.js r160, vendored).
- `screenshots/` — the three renders above.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the platform library, copied unchanged from the kit.

## License

MIT — see [LICENSE](LICENSE).

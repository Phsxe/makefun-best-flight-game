// Dawn Courier — deterministic screenshot scenes, v2.
// ?shot=start | play | end (with &seed=1) puts the game into a fixed scene
// for the screenshots, so the cover and the other two frames are the same
// every run: the plane on the runway at dawn with the Ring Run selected,
// mid-flight through a ring with fuel, damage and a combo on the HUD and
// the river bridge ahead, and the course-complete landing. Normal play
// (no ?shot) is untouched.

import * as THREE from 'three';

// Read the shot and the seed from the page's URL. The seed pins the world
// (terrain, trees, clouds) so every screenshot of the same shot is the same
// valley; the shot picks the scene (runway, mid-flight, finished).
export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || '',
    seed: parseInt(q.get('seed') || '1', 10) || 1,
  };
}

// Set up a scene for a screenshot. game is the Game object from main.js.
// Returns true when a shot scene was applied.
export function applyShot(game, shot) {
  if (!shot) return false;
  // Screenshots hold the scene still, so the frame is exactly the composed
  // one no matter how fast the machine renders.
  game.frozen = true;
  if (shot === 'start') {
    // On the runway at dawn, engine warm, the Ring Run selected, the tank
    // full and the airframe clean — the new fuel and damage gauges on the
    // HUD, the village and the hangar beside the strip.
    game.startRun('ring');
    game.flight.throttle = 0.35;
    game.fuel.level = 100;
    game.damage.level = 0;
    game.hud.hint('DAWN COURIER — RUNWAY 09 · PRESS ENTER TO TAKE OFF');
    game.sound.ensure();
    game.sound.update(0.35, 0, false);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'play') {
    // Mid-flight, chasing the third ring down the valley, about to fly it:
    // the river bridge ahead, two rings already flown, a combo of two on
    // the HUD, the tank at 65% and the airframe carrying 12% damage from
    // an earlier firm arrival.
    game.startRun('ring');
    const f = game.flight;
    f.grounded = false;
    f.throttle = 0.72;
    f.speed = 58;
    // Place the plane just short of ring 3, lined up on it, in a gentle bank.
    // Far enough back that the ring reads as a target ahead, not a wall.
    const ring = game.rings.items[2];
    const prev = game.rings.items[1];
    const dir = new THREE.Vector3()
      .subVectors(ring.pos, prev.pos)
      .normalize();
    f.pos.copy(ring.pos).addScaledVector(dir, -95);
    f.pos.y = ring.pos.y + 4;
    f.yaw = Math.atan2(-dir.x, -dir.z);
    f.pitch = 0.04;
    f.roll = 0.12;
    f.sync(); // recompute forward so the HUD heading and camera agree
    // Rings 1 and 2 are already flown, the second one kept the streak alive.
    game.rings.items[0].passed = true;
    game.rings.items[1].passed = true;
    game.rings.nextIndex = 2;
    game.rings._paint();
    game.score = 200;
    game.elapsed = 47;
    game.combo = 2;
    game.lastRingTime = 47;
    game.fuel.level = 65;
    game.damage.level = 12;
    game.hud.message('', 0); // no start banner in the mid-flight frame
    game.hud.hint('');
    game.sound.ensure();
    game.sound.update(0.72, 58, true);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'end') {
    // Course complete: back on the runway, the finish screen up, the tank
    // at 30% after the run and the airframe carrying 8% damage.
    game.startRun('ring');
    game.flight.grounded = true;
    game.flight.throttle = 0;
    game.flight.speed = 0;
    game.score = 800;
    game.elapsed = 214;
    game.fuel.level = 30;
    game.damage.level = 8;
    game.rings.nextIndex = game.rings.items.length;
    for (const it of game.rings.items) it.passed = true;
    game.rings._paint();
    game.showComplete({
      title: 'COURSE COMPLETE ✈',
      sub: 'The mail is delivered and the Courier is home on the runway. Well flown, pilot.',
      time: 214,
      detailLine: '8 / 8 rings',
      score: 800,
      bonus: 86,
    });
    game.hud.hint('');
    game.sound.ensure();
    game.sound.update(0, 0, false);
    game.positionCamera(true);
    return true;
  }
  return false;
}

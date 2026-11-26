// Dawn Courier — deterministic screenshot scenes.
// ?shot=start | play | end (with &seed=1) puts the game into a fixed scene
// for the screenshots, so the cover and the other two frames are the same
// every run: the plane on the runway at dawn, mid-flight through a ring,
// and the course-complete landing. Normal play (no ?shot) is untouched.

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
    // On the runway at dawn, engine warm, HUD lit, title hidden.
    game.flight.reset();
    game.flight.throttle = 0.35;
    game.state = 'flying';
    game.hideOverlays();
    game.hud.hint('DAWN COURIER — RUNWAY 09 · PRESS ENTER TO TAKE OFF');
    game.sound.ensure();
    game.sound.update(0.35, 0, false);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'play') {
    // Mid-flight, chasing the third ring down the valley, about to fly it.
    game.flight.reset();
    game.state = 'flying';
    game.hideOverlays();
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
    // Rings 1 and 2 are already flown.
    game.rings.items[0].passed = true;
    game.rings.items[1].passed = true;
    game.rings.nextIndex = 2;
    game.rings._paint();
    game.score = 200;
    game.elapsed = 47;
    game.hud.hint('');
    game.sound.ensure();
    game.sound.update(0.72, 58, true);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'end') {
    // Course complete: back on the runway, the finish screen up.
    game.flight.reset();
    game.state = 'complete';
    game.hideOverlays();
    game.flight.grounded = true;
    game.flight.throttle = 0;
    game.flight.speed = 0;
    game.score = 800;
    game.elapsed = 214;
    game.rings.nextIndex = game.rings.items.length;
    for (const it of game.rings.items) it.passed = true;
    game.rings._paint();
    game.showComplete(214, 800, 86);
    game.hud.hint('');
    game.sound.ensure();
    game.sound.update(0, 0, false);
    game.positionCamera(true);
    return true;
  }
  return false;
}

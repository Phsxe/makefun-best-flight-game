// Dawn Courier — deterministic screenshot scenes, v3.
// ?shot=start | play | end (with &seed=1) puts the game into a fixed scene
// for the screenshots, so the cover and the other two frames are the same
// every run: the cockpit view in flight chasing a ring (the v3 headline),
// the Fly the Tour campaign mid-way through its cargo leg, and the tour
// complete screen with the leg-by-leg breakdown and the landing line.
// Normal play (no ?shot) is untouched.

import * as THREE from 'three';

// Read the shot and the seed from the page's URL. The seed pins the world
// (terrain, trees, clouds) so every screenshot of the same shot is the same
// valley; the shot picks the scene (cockpit, campaign, finished).
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
    // The cover: the cockpit view in flight, chasing the third ring down
    // the valley. The dashboard, nose, wing roots and spinning prop frame
    // the view; the live instruments read the flight — attitude, altitude,
    // airspeed, compass, fuel 65%, damage 12% — and a combo of two is on
    // the HUD. The river bridge is ahead.
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
    game.setCockpitView(true);
    game.sound.ensure();
    game.sound.update(0.72, 58, true);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'play') {
    // Fly the Tour, leg 2: the cargo run, the crate aboard and the amber
    // drop zone ahead. The tour HUD reads LEG 2/3, the tank is at 72%
    // after the ring leg and the airframe carries 9% damage into the leg.
    game.startCampaign(1);
    const f = game.flight;
    f.grounded = false;
    f.throttle = 0.68;
    f.speed = 52;
    // South of the drop zone, lined up on it, in a gentle bank.
    f.pos.set(140, 55, -80);
    f.yaw = 0; // facing north (-z), toward the zone at z=-180
    f.pitch = -0.02;
    f.roll = 0.08;
    f.sync();
    game.score = 3600; // the ring leg, already flown
    game.elapsed = 96;
    game.fuel.level = 72;
    game.damage.level = 9;
    // The crate rides under the fuselage; the frozen frame never runs the
    // follow step, so put it there by hand.
    game.cargo.crate.position.copy(f.pos).add(new THREE.Vector3(0, -1.9, 0.4));
    game.hud.message('', 0);
    game.hud.hint('');
    game.sound.ensure();
    game.sound.update(0.68, 52, true);
    game.positionCamera(true);
    return true;
  }
  if (shot === 'end') {
    // Fly the Tour, complete: all three legs flown, the final screen up
    // with the leg-by-leg breakdown, the tour bonus, and the landing line
    // — a perfect centred touchdown worth +185.
    game.startCampaign(0);
    game.campaign.legScores = [3600, 450, 600];
    game.campaign.legBonuses = [86, 40, 120];
    game.campaign.legTimes = [214, 190, 300];
    game.campaign.legIndex = 3; // all three legs done
    game.flight.grounded = true;
    game.flight.throttle = 0;
    game.flight.speed = 0;
    game.fuel.level = 28;
    game.damage.level = 14;
    game.lastLanding = { points: 185, grade: 'PERFECT', align: 0.95, soft: 0.9 };
    game.sound.ensure();
    game._finishCampaign();
    game.hud.hint('');
    game.sound.update(0, 0, false);
    game.positionCamera(true);
    return true;
  }
  return false;
}

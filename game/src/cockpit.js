// Dawn Courier — the cockpit view.
// A first-person view from the pilot's seat. The camera sits where the
// pilot sits and rolls with the plane, a 3D cowl (dashboard shelf, engine
// cowl, wing roots, canopy frame and a spinning prop) frames the view, and
// a strip of live canvas instruments along the bottom reads the flight
// state every frame: attitude, altimeter, airspeed, compass, fuel, damage
// and throttle. Toggle with V or the COCKPIT button; the chase camera is
// the other view. The instruments are drawn by code, never a picture —
// the needles move with the plane.

import * as THREE from 'three';
import { clamp } from './random.js';

const CREAM = '#ffe9c9';
const AMBER = '#ffb020';
const AMBER_DIM = '#ffb36b';
const DIAL_FACE = 'rgba(16, 12, 24, 0.88)';

// The pilot's seat in plane-local space: at the canopy, just behind the
// prop. The camera sits here and looks along the plane's nose.
const SEAT = new THREE.Vector3(0, 0.9, -0.9);

export class Cockpit {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;
    this._propSpin = 0;
    // The cowl is a child of the camera, so it stays glued to the view.
    // (A camera's children only render once the camera is in the scene.)
    this.scene.add(this.camera);
    this._buildCowl();
    this._grabGauges();
    this.setEnabled(false);
  }

  // --- the 3D cowl ---------------------------------------------------------
  // Everything here is in camera space: the camera looks down -Z, up is
  // +Y. The numbers were placed against the 62-degree field of view so
  // the shelf sits at the bottom of the frame, the nose and prop read
  // over it, and the wing roots and canopy frame edge the view.

  _buildCowl() {
    const group = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2126, flatShading: true });
    const darkPanel = new THREE.MeshLambertMaterial({ color: 0x1c151c, flatShading: true });
    const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e, flatShading: true });
    const cream = new THREE.MeshLambertMaterial({ color: 0xf2e6c8, flatShading: true });

    // Dashboard shelf across the bottom of the view, with a glareshield lip.
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 0.5), darkPanel);
    dash.position.set(0, -0.8, -1.25);
    dash.rotation.x = -0.18;
    group.add(dash);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.55), dark);
    lip.position.set(0, -0.52, -1.22);
    lip.rotation.x = -0.18;
    group.add(lip);

    // Engine cowl over the nose, just above the shelf.
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 10), cream);
    cowl.rotation.x = -Math.PI / 2;
    cowl.position.set(0, -0.95, -3.1);
    group.add(cowl);
    // A red spinner tip on the cowl, so the nose reads finished.
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), red);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.set(0, -0.9, -3.55);
    group.add(spinner);

    // The prop: two translucent blades on a hub, spinning in front of the
    // cowl. Kept faint so the view through it stays clear.
    this._prop = new THREE.Group();
    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0x1a1512, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
    });
    const bladeGeo = new THREE.BoxGeometry(0.28, 2.9, 0.05);
    for (const a of [0, Math.PI]) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = a;
      this._prop.add(blade);
    }
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1512, transparent: true, opacity: 0.5 })
    );
    hub.rotation.x = Math.PI / 2;
    this._prop.add(hub);
    this._prop.position.set(0, -0.9, -3.4);
    group.add(this._prop);

    // Wing roots at the lower sides of the frame.
    for (const x of [-1.1, 1.1]) {
      const root = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.2), red);
      root.position.set(x, -0.55, -1.6);
      root.rotation.y = x > 0 ? -0.15 : 0.15;
      group.add(root);
    }

    // Canopy frame: two struts and a top bar, edging the windscreen.
    for (const x of [-1.05, 1.05]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), dark);
      strut.position.set(x, 0.18, -1.1);
      group.add(strut);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.17, 0.07, 0.07), dark);
    bar.position.set(0, 0.58, -1.1);
    group.add(bar);

    this.cowl = group;
    this.camera.add(group);
  }

  // --- the instrument strip ------------------------------------------------

  _grabGauges() {
    this.panel = document.getElementById('cockpit-panel');
    const ids = ['g-att', 'g-alt', 'g-spd', 'g-compass', 'g-fuel', 'g-dmg', 'g-thr'];
    this.ctx = {};
    for (const id of ids) {
      const c = document.getElementById(id);
      if (c) this.ctx[id] = c.getContext('2d');
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.cowl.visible = on;
    if (this.panel) this.panel.style.display = on ? 'flex' : 'none';
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // Where the pilot's eyes are, in world space, from the flight state.
  // flight: the Flight model (pos, euler). Returns a Vector3 (reused).
  seatPosition(flight, out) {
    return out.copy(SEAT).applyEuler(flight.euler).add(flight.pos);
  }

  // Draw the instruments for this frame. v: { pitch, roll, altFt,
  // speedKts, headingDeg, fuel, damage, throttle, propSpin }. dt seconds.
  update(dt, v) {
    if (!this.enabled) return;
    if (this._prop) this._prop.rotation.z += (v.propSpin || 0) * dt;
    const c = this.ctx;
    if (c['g-att']) this._drawAttitude(c['g-att'], v.pitch, v.roll);
    if (c['g-alt']) this._drawDial(c['g-alt'], v.altFt, 1000, 'FT', Math.round(v.altFt));
    if (c['g-spd']) this._drawDial(c['g-spd'], v.speedKts, 200, 'KT', Math.round(v.speedKts));
    if (c['g-compass']) this._drawCompassStrip(c['g-compass'], v.headingDeg);
    if (c['g-fuel']) this._drawArc(c['g-fuel'], v.fuel, this._fuelColor(v.fuel), `${Math.round(v.fuel)}%`);
    if (c['g-dmg']) this._drawArc(c['g-dmg'], v.damage, this._dmgColor(v.damage), `${Math.round(v.damage)}%`);
    if (c['g-thr']) this._drawThrottle(c['g-thr'], v.throttle);
  }

  _fuelColor(fuel) {
    return fuel < 22 ? '#ff4a2a' : fuel < 50 ? '#ff9a3c' : '#37c978';
  }

  _dmgColor(dmg) {
    return dmg > 70 ? '#ff4a2a' : dmg > 40 ? '#ff9a3c' : '#37c978';
  }

  // --- dial helpers ----------------------------------------------------------

  // A round face with an amber rim, for the needle gauges.
  _face(ctx) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 3;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = DIAL_FACE;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return { cx, cy, r };
  }

  // A 270-degree sweep dial: 0 at 135 degrees (bottom left), full scale at
  // 45 degrees (bottom right), the gap at the bottom. Canvas angles run
  // clockwise from east because y points down.
  _sweepAngle(frac) {
    return ((135 + clamp(frac, 0, 1) * 270) * Math.PI) / 180;
  }

  // Altimeter / airspeed: ticks around the sweep, a needle, and the value
  // in digits in the middle.
  _drawDial(ctx, value, max, unit, digits) {
    const { cx, cy, r } = this._face(ctx);
    // Ticks: ten around the sweep, longer every other one.
    for (let i = 0; i <= 10; i++) {
      const a = this._sweepAngle(i / 10);
      const inner = i % 2 === 0 ? r - 9 : r - 5;
      ctx.strokeStyle = 'rgba(255, 233, 201, 0.75)';
      ctx.lineWidth = i % 2 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    // Needle.
    const a = this._sweepAngle(value / max);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6);
    ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
    ctx.stroke();
    // Hub.
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = AMBER;
    ctx.fill();
    // Digits in the middle, unit under them.
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(r * 0.42)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(String(digits), cx, cy + r * 0.52);
    ctx.fillStyle = AMBER_DIM;
    ctx.font = `400 ${Math.round(r * 0.22)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(unit, cx, cy + r * 0.78);
  }

  // Fuel / damage: a coloured arc that fills with the value, and the
  // percentage in the middle.
  _drawArc(ctx, value, color, digits) {
    const { cx, cy, r } = this._face(ctx);
    // Track.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, this._sweepAngle(0), this._sweepAngle(1));
    ctx.stroke();
    // Fill.
    if (value > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, this._sweepAngle(0), this._sweepAngle(value / 100));
      ctx.stroke();
    }
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(r * 0.4)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(digits, cx, cy + r * 0.3);
  }

  // Throttle: a vertical bar that fills from the bottom, with the percent.
  _drawThrottle(ctx, throttle) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const x = 6;
    const y = 4;
    const w = W - 12;
    const h = H - 26;
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    const fillH = h * clamp(throttle, 0, 1);
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(x + 1.5, y + h - fillH, w - 3, fillH);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${Math.round(throttle * 100)}%`, W / 2, H - 6);
  }

  // Compass: a sliding strip, the heading ticks moving under a fixed
  // centre marker — the same strip the chase HUD draws, as a canvas.
  _drawCompassStrip(ctx, headingDeg) {
    // The strip is a wide short canvas (200x44), not a round dial: a
    // dark rounded face across the whole strip, a moving tape of
    // headings, and an amber marker over the current heading. Labels
    // only every 30 degrees — at 15 the three-digit numbers collide
    // into one unreadable string.
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 8);
    ctx.fillStyle = DIAL_FACE;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 179, 107, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 8);
    ctx.clip();
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const pxPerDeg = (W / 2 - 10) / 60;
    // Tick marks every 15 degrees.
    ctx.strokeStyle = 'rgba(255, 233, 201, 0.55)';
    ctx.lineWidth = 1;
    for (let d = -60; d <= 60; d += 15) {
      const x = W / 2 + d * pxPerDeg;
      ctx.beginPath();
      ctx.moveTo(x, H - 4);
      ctx.lineTo(x, H - (d % 30 === 0 ? 12 : 8));
      ctx.stroke();
    }
    // Labels every 30 degrees: a cardinal name on the 45-degree
    // points, a three-digit number otherwise. Five labels across the
    // strip, 46 px apart, so none of them touch.
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    for (let d = -60; d <= 60; d += 30) {
      const h = (Math.round(headingDeg) + d + 360) % 360;
      const label = h % 45 === 0 ? points[Math.round(h / 45) % 8] : String(h).padStart(3, '0');
      const x = W / 2 + d * pxPerDeg;
      ctx.fillText(label, x, H - 16);
    }
    ctx.restore();
    // Centre marker over the current heading.
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 5, 2);
    ctx.lineTo(W / 2 + 5, 2);
    ctx.lineTo(W / 2, 9);
    ctx.closePath();
    ctx.fill();
  }

  // Attitude: sky above the line, ground below it, the line tilting with
  // the bank and sliding with the pitch. A fixed symbol is the aircraft.
  _drawAttitude(ctx, pitch, roll) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = W / 2 - 3;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    ctx.translate(0, pitch * 90);
    ctx.fillStyle = '#3a6db0';
    ctx.fillRect(-W, -H, W * 2, H);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-W, 0, W * 2, H);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W, 0);
    ctx.lineTo(W, 0);
    ctx.stroke();
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
    // Rim.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

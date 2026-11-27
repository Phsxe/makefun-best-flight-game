// Dawn Courier — the heads-up display.
// A DOM overlay, lit like real instruments at dawn: altitude, speed and
// heading on the left, throttle, score, rings and time on the right, an
// artificial horizon low on the left, a crosshair in the middle, and an
// arrow that always points at the next ring. The horizon is a small canvas
// drawn fresh every frame.

import * as THREE from 'three';

export class Hud {
  constructor(camera) {
    this.camera = camera;
    this.el = {};
    for (const id of [
      'alt', 'spd', 'hdg', 'compass', 'thr', 'thrbar', 'score', 'rings',
      'time', 'crosshair', 'ringind', 'ringdist', 'message', 'hint', 'horizon',
      'fuel', 'fuelbar', 'dmg', 'dmgbar', 'wind', 'windarrow', 'combo',
      'mission', 'objective',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.horizonCtx = this.el.horizon ? this.el.horizon.getContext('2d') : null;
    this._msgTimer = 0;
    this._v = new THREE.Vector3();
  }

  // values: { altFt, speedKts, headingDeg, throttle, score, ringsLeft,
  // ringsTotal, timeSec, pitch, roll, ringPos (Vector3|null), ringDist,
  // flying, grounded, fuel, damage, windToDeg, windKts, combo, missionName,
  // objective }
  update(v) {
    const el = this.el;
    if (el.alt) el.alt.textContent = `${Math.round(v.altFt)}`;
    if (el.spd) el.spd.textContent = `${Math.round(v.speedKts)}`;
    if (el.hdg) el.hdg.textContent = `${String(Math.round(v.headingDeg)).padStart(3, '0')}°`;
    if (el.compass) this._drawCompass(v.headingDeg);
    if (el.thr) el.thr.textContent = `${Math.round(v.throttle * 100)}%`;
    if (el.thrbar) el.thrbar.style.width = `${Math.round(v.throttle * 100)}%`;
    if (el.score) el.score.textContent = `${v.score}`;
    if (el.rings) el.rings.textContent = v.ringsText || `${v.ringsFlown}/${v.ringsTotal}`;
    if (el.time) el.time.textContent = this._fmtTime(v.timeSec);
    // Fuel: the bar drains with the tank and turns red when it is low.
    if (el.fuel) el.fuel.textContent = `${Math.round(v.fuel)}%`;
    if (el.fuelbar) {
      el.fuelbar.style.width = `${Math.round(v.fuel)}%`;
      el.fuelbar.style.background =
        v.fuel < 22 ? 'linear-gradient(90deg, #ff4a2a, #ff7a3c)'
        : v.fuel < 50 ? 'linear-gradient(90deg, #ff9a3c, #ffd27a)'
        : 'linear-gradient(90deg, #37c978, #7ae8a8)';
    }
    // Damage: the bar fills as the airframe wears, green to red.
    if (el.dmg) el.dmg.textContent = `${Math.round(v.damage)}%`;
    if (el.dmgbar) {
      el.dmgbar.style.width = `${Math.round(v.damage)}%`;
      el.dmgbar.style.background =
        v.damage > 70 ? 'linear-gradient(90deg, #ff4a2a, #ff7a3c)'
        : v.damage > 40 ? 'linear-gradient(90deg, #ff9a3c, #ffd27a)'
        : 'linear-gradient(90deg, #37c978, #7ae8a8)';
    }
    // Wind: an arrow pointing where the wind blows toward, with the speed.
    // The arrow glyph points east at 0°, so rotate by heading minus 90°.
    if (el.wind) el.wind.textContent = `${Math.round(v.windKts)} KT`;
    if (el.windarrow) el.windarrow.style.transform = `rotate(${v.windToDeg - 90}deg)`;
    // Combo: only shown while the streak is alive.
    if (el.combo) {
      el.combo.style.display = v.combo > 1 ? 'block' : 'none';
      el.combo.textContent = `COMBO ×${v.combo}`;
    }
    if (el.mission) el.mission.textContent = v.missionName || '';
    if (el.objective) el.objective.textContent = v.objective || '';
    // The DROP button only shows while the cargo mission is carrying.
    const dropBtn = document.getElementById('btn-drop');
    if (dropBtn) dropBtn.style.display = v.showDrop ? 'block' : 'none';
    if (this.horizonCtx) this._drawHorizon(v.pitch, v.roll);
    if (el.ringind) this._placeRingIndicator(v.ringPos, v.ringDist);
    if (this._msgTimer > 0) {
      this._msgTimer -= 1 / 60;
      if (this._msgTimer <= 0 && el.message) el.message.style.opacity = '0';
    }
  }

  _fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // A sliding compass strip: the heading ticks move under a fixed marker.
  _drawCompass(headingDeg) {
    const el = this.el.compass;
    if (!el) return;
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let d = -60; d <= 60; d += 15) {
      const h = (Math.round(headingDeg) + d + 360) % 360;
      const label = h % 45 === 0 ? points[Math.round(h / 45) % 8] : String(h).padStart(3, '0');
      const off = (d / 60) * 50;
      html += `<span style="left:${50 + off}%">${label}</span>`;
    }
    el.innerHTML = html;
  }

  // The artificial horizon: sky above the line, ground below it, the line
  // tilting with the bank and sliding with the pitch. A fixed white symbol
  // in the middle is the aircraft.
  _drawHorizon(pitch, roll) {
    const ctx = this.horizonCtx;
    const c = this.el.horizon;
    const W = c.width;
    const H = c.height;
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const pitchPx = pitch * 90;
    ctx.translate(0, pitchPx);
    // Sky and ground.
    ctx.fillStyle = '#3a6db0';
    ctx.fillRect(-W, -H, W * 2, H);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-W, 0, W * 2, H);
    // The horizon line.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W, 0);
    ctx.lineTo(W, 0);
    ctx.stroke();
    ctx.restore();
    // The fixed aircraft symbol.
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
    ctx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The next-ring arrow: projected to the screen; when the ring is off
  // screen it clamps to the edge and points the way, with the distance.
  _placeRingIndicator(ringPos, ringDist) {
    const el = this.el.ringind;
    const distEl = this.el.ringdist;
    if (!el || !ringPos) {
      if (el) el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    this._v.copy(ringPos).project(this.camera);
    const behind = this._v.z > 1;
    let nx = this._v.x;
    let ny = this._v.y;
    if (behind) {
      nx = -nx;
      ny = -ny;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    let px = (nx * 0.5 + 0.5) * W;
    let py = (-ny * 0.5 + 0.5) * H;
    // Clamp to a margin inside the screen and point the arrow that way.
    const m = 70;
    const cx = W / 2;
    const cy = H / 2;
    const dx = px - cx;
    const dy = py - cy;
    const ang = Math.atan2(dy, dx);
    px = Math.max(m, Math.min(W - m, px));
    py = Math.max(m, Math.min(H - m, py));
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.transform = 'translate(-50%, -50%)';
    // Only the arrow turns to point the way; the distance stays level so it
    // can be read at a glance.
    const arrow = el.querySelector('.ring-arrow');
    if (arrow) {
      arrow.style.transform = `rotate(${ang}rad)`;
      arrow.style.opacity = behind || Math.abs(dx) > W * 0.32 || Math.abs(dy) > H * 0.32 ? '1' : '0.25';
    }
    if (distEl) distEl.textContent = ringDist < 1000 ? `${Math.round(ringDist)}m` : `${(ringDist / 1000).toFixed(1)}km`;
  }

  // A centre-screen announcement that fades after a couple of seconds.
  message(text, seconds = 2.2) {
    const el = this.el.message;
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    this._msgTimer = seconds;
  }

  hint(text) {
    const el = this.el.hint;
    if (el) el.textContent = text;
  }
}

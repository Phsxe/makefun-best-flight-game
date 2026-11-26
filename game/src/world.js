// Dawn Courier — the world: a dawn mountain valley.
// Everything the pilot flies over is built here from a seeded height function:
// the low-poly terrain, the river and lake, the runway with its edge lights,
// the little village and hangar, the trees, the dawn sky, the sun and clouds.
// terrainHeight(x, z) is the one source of truth for height — the flight model
// asks it when it checks for the ground, so the mesh and the physics agree.

import * as THREE from 'three';
import { makeFbm, mulberry32, clamp, smoothstep } from './random.js';

// --- layout ---------------------------------------------------------------

export const RUNWAY = {
  x: 0,
  z: 150, // centre of the strip
  length: 520, // along z: z from -110 to 410
  width: 26,
  halfWidth: 13,
};

export const RIVER_X = 70; // the river runs the length of the valley
export const LAKE = { x: -40, z: -640, rx: 130, rz: 90 };

const WORLD = 2000; // terrain spans x,z in [-1000, 1000]

// --- the height function ---------------------------------------------------

const fbm = makeFbm(1337);
const fbmFloor = makeFbm(777);

// Height of the ground at (x, z), in metres. 0 is the valley floor.
export function terrainHeight(x, z) {
  const ax = Math.abs(x);
  // The valley walls: flat floor, then mountains rising past |x| ~ 180.
  const wall = smoothstep(180, 520, ax) * 175;
  // Rolling mountain noise, rougher high up; gentle undulation on the floor.
  const rough = fbm(x * 0.0035, z * 0.0035) * 26 * (0.35 + smoothstep(120, 500, ax) * 0.65);
  const floor = fbmFloor(x * 0.008, z * 0.008) * 4;
  // The river carves a shallow channel down the valley.
  const dx = (x - RIVER_X) / 28;
  const river = -7 * Math.exp(-dx * dx);
  // The lake sits in a bowl at the north end.
  const lx = (x - LAKE.x) / LAKE.rx;
  const lz = (z - LAKE.z) / LAKE.rz;
  const lake = -6 * Math.exp(-(lx * lx + lz * lz));
  let h = wall + rough + floor + river + lake;
  // Flatten a strip around the runway so the strip is dead level.
  const rx = 1 - smoothstep(22, 65, ax);
  const rz = 1 - smoothstep(230, 300, Math.abs(z - RUNWAY.z));
  const mask = rx * rz;
  h = h * (1 - mask);
  return h;
}

// True when (x, z) is on the runway strip (for landings).
export function isOnRunway(x, z) {
  return Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && Math.abs(z - RUNWAY.z) < RUNWAY.length / 2;
}

// --- sky -------------------------------------------------------------------

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#141f45'); // zenith: deep dawn blue
  grad.addColorStop(0.32, '#3d3f7d'); // upper sky: violet
  grad.addColorStop(0.48, '#a34d7e'); // pink band
  grad.addColorStop(0.55, '#ff8a5c'); // horizon: burning orange
  grad.addColorStop(0.62, '#ffc27a'); // just below the horizon: warm gold
  grad.addColorStop(1.0, '#2c2130'); // below ground: dark haze
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- terrain colours -------------------------------------------------------

function colorForHeight(h, slope, n) {
  // n is a little noise so the colour does not band into flat stripes.
  const c = new THREE.Color();
  if (h < 2.5) {
    // Valley floor: meadow green, patchy.
    c.setHex(0x5d8a48);
    if (n > 0.25) c.setHex(0x6d9a52);
    if (n < -0.3) c.setHex(0x4f7a3e);
  } else if (h < 45) {
    // Lower slopes: grass giving way to scrub.
    c.setHex(0x6b7f43);
    if (n > 0.2) c.setHex(0x7d8a4a);
  } else if (h < 105) {
    // Rock and scree.
    c.setHex(0x8a7a6a);
    if (n > 0.2) c.setHex(0x9a8878);
  } else if (h < 150) {
    // High grey rock.
    c.setHex(0x7d7d84);
  } else {
    // Peaks: snow.
    c.setHex(0xe8e8ee);
  }
  // Steep ground is rock whatever its height.
  if (slope > 0.55 && h > 8) c.setHex(0x8a7a6a);
  return c;
}

// --- the world -------------------------------------------------------------

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.seed = seed;
    this.clouds = [];
    this.sunDir = new THREE.Vector3(0.55, 0.28, -0.78).normalize();
    this._buildLights();
    this._buildSky();
    this._buildTerrain();
    this._buildWater();
    this._buildRunway();
    this._buildVillage();
    this._buildTrees();
    this._buildClouds();
  }

  _buildLights() {
    // The low dawn sun, warm and long-shadowed.
    const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
    sun.position.copy(this.sunDir).multiplyScalar(900);
    this.scene.add(sun);
    // Sky light from above, ground bounce from below. Strong enough that
    // the shadowed mountain faces still read as terrain at dawn.
    const hemi = new THREE.HemisphereLight(0x8a7fb8, 0x5a4632, 0.95);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0x40334a, 0.7));
  }

  _buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2800, 24, 16),
      new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
    );
    this.scene.add(sky);
    // The sun disc, low on the horizon, and a soft glow around it.
    const sunPos = this.sunDir.clone().multiplyScalar(2400);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false })
    );
    disc.position.copy(sunPos);
    disc.lookAt(0, 0, 0);
    this.scene.add(disc);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(190, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a55, transparent: true, opacity: 0.28, fog: false })
    );
    glow.position.copy(sunPos).multiplyScalar(0.999);
    glow.lookAt(0, 0, 0);
    this.scene.add(glow);
    // Warm haze so the far mountains melt into the dawn.
    this.scene.fog = new THREE.Fog(0xd89a7a, 700, 2600);
  }

  _buildTerrain() {
    const SEG = 128;
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const noise = makeFbm(4242);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      // Slope from the height function, sampled a little to each side.
      const hx = terrainHeight(x + 6, z) - terrainHeight(x - 6, z);
      const hz = terrainHeight(x, z + 6) - terrainHeight(x, z - 6);
      const slope = Math.min(1, Math.hypot(hx, hz) / 12);
      const c = colorForHeight(h, slope, noise(x * 0.02, z * 0.02));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    this.scene.add(mesh);
  }

  _buildWater() {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x4a86c8,
      transparent: true,
      opacity: 0.85,
    });
    // The river: a long strip down the carved channel.
    const river = new THREE.Mesh(new THREE.PlaneGeometry(38, 1700), mat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(RIVER_X, -1.0, 0);
    this.scene.add(river);
    // The lake: a wide ellipse in its bowl at the north end.
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mat);
    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(LAKE.rx, LAKE.rz, 1);
    lake.position.set(LAKE.x, -1.0, LAKE.z);
    this.scene.add(lake);
  }

  _buildRunway() {
    const g = new THREE.Group();
    // Asphalt strip, light enough to read as a runway at dawn.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: 0x3d4048 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(RUNWAY.x, 0.15, RUNWAY.z);
    g.add(strip);
    // Centreline dashes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
    const dashGeo = new THREE.PlaneGeometry(1.4, 16);
    for (let i = 0; i < 13; i++) {
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(RUNWAY.x, 0.28, RUNWAY.z - RUNWAY.length / 2 + 30 + i * 38);
      g.add(d);
    }
    // Threshold bars at each end.
    const barGeo = new THREE.PlaneGeometry(9, 3);
    for (const z of [RUNWAY.z - RUNWAY.length / 2 + 12, RUNWAY.z + RUNWAY.length / 2 - 12]) {
      for (const x of [-7, 0, 7]) {
        const b = new THREE.Mesh(barGeo, dashMat);
        b.rotation.x = -Math.PI / 2;
        b.position.set(x, 0.28, z);
        g.add(b);
      }
    }
    // Edge lights: warm lamps down both sides, glowing at dawn.
    const lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 0; i <= 16; i++) {
      const z = RUNWAY.z - RUNWAY.length / 2 + (i * RUNWAY.length) / 16;
      for (const x of [RUNWAY.x - RUNWAY.halfWidth - 2, RUNWAY.x + RUNWAY.halfWidth + 2]) {
        const lamp = new THREE.Mesh(lightGeo, lightMat);
        lamp.position.set(x, 0.9, z);
        g.add(lamp);
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.9, 5),
          new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        post.position.set(x, 0.45, z);
        g.add(post);
      }
    }
    this.scene.add(g);
  }

  _buildVillage() {
    const g = new THREE.Group();
    const rand = mulberry32(this.seed * 7 + 3);
    const wallCols = [0xd8c49a, 0xcbb89a, 0xd8c49a, 0xc4b49a];
    const roofCols = [0x9a4a3a, 0x7a3a2e, 0x8a4a3a, 0x6a3a2e];
    // Four little houses with pitched roofs, tucked beside the runway.
    const spots = [
      [-72, 330, 0.4], [-58, 372, -0.3], [-88, 388, 0.9], [-64, 420, 1.8],
    ];
    spots.forEach(([x, z, rot], i) => {
      const y = terrainHeight(x, z);
      const house = new THREE.Group();
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(9, 6, 8),
        new THREE.MeshLambertMaterial({ color: wallCols[i % wallCols.length] })
      );
      walls.position.y = 3;
      house.add(walls);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.2, 4.2, 4),
        new THREE.MeshLambertMaterial({ color: roofCols[i % roofCols.length], flatShading: true })
      );
      roof.position.y = 8.1;
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      house.position.set(x, y, z);
      house.rotation.y = rot;
      g.add(house);
    });
    // The hangar: a big shed with a curved roof, by the apron.
    const hangar = new THREE.Group();
    const shed = new THREE.Mesh(
      new THREE.BoxGeometry(26, 9, 18),
      new THREE.MeshLambertMaterial({ color: 0x7a8894 })
    );
    shed.position.y = 4.5;
    hangar.add(shed);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x5a6a78, flatShading: true })
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 9;
    hangar.add(roof);
    const hy = terrainHeight(-46, 318);
    hangar.position.set(-46, hy, 318);
    hangar.rotation.y = 0.15;
    g.add(hangar);
    // A windsock by the runway, pointing into the dawn breeze.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    pole.position.set(20, 4.5, 386);
    g.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xff7a2a })
    );
    sock.rotation.z = Math.PI / 2 - 0.35;
    sock.position.set(22.4, 8.6, 386);
    g.add(sock);
    this.scene.add(g);
  }

  _buildTrees() {
    const rand = mulberry32(this.seed * 13 + 5);
    const spots = [];
    let guard = 0;
    while (spots.length < 150 && guard < 3000) {
      guard++;
      const x = (rand() * 2 - 1) * 480;
      const z = (rand() * 2 - 1) * 850;
      // Keep the runway, the river and the village clear.
      if (Math.abs(x) < 42 && Math.abs(z - RUNWAY.z) < 300) continue;
      if (Math.abs(x - RIVER_X) < 26) continue;
      if (Math.hypot(x + 70, z - 375) < 55) continue;
      const h = terrainHeight(x, z);
      if (h > 95 || h < -3) continue; // trees grow on the valley floor and lower slopes
      spots.push({ x, z, y: h, s: 0.8 + rand() * 0.9, r: rand() * Math.PI * 2 });
    }
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
    const pineGeo = new THREE.ConeGeometry(2.4, 8, 6);
    const pineMat = new THREE.MeshLambertMaterial({ color: 0x3a6b35, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.r);
      sc.set(s.s, s.s, s.s);
      m.compose(new THREE.Vector3(s.x, s.y + 1.6 * s.s, s.z), q, sc);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(s.x, s.y + (3.2 + 4) * s.s, s.z), q, sc);
      pines.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    pines.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks);
    this.scene.add(pines);
  }

  _buildClouds() {
    const rand = mulberry32(this.seed * 29 + 11);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffe8e0,
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      const puffs = 2 + Math.floor(rand() * 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rand() * 18, 8, 6), mat);
        s.scale.y = 0.42;
        s.position.set((rand() - 0.5) * 46, (rand() - 0.5) * 6, (rand() - 0.5) * 22);
        cloud.add(s);
      }
      cloud.position.set(
        (rand() * 2 - 1) * 900,
        210 + rand() * 90,
        (rand() * 2 - 1) * 900
      );
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  // Clouds drift slowly down the valley.
  update(dt) {
    for (const c of this.clouds) {
      c.position.z += dt * 1.6;
      if (c.position.z > 1000) c.position.z = -1000;
    }
  }
}

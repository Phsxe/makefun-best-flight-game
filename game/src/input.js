// Dawn Courier — keyboard and mouse input.
// One place owns every key and pointer the pilot touches, so the flight model
// and the menus both read the same clean state. Nothing here touches the DOM
// except the buttons the page wires up itself.

// Keys we listen for. Arrow keys and WASD fly the plane; Shift/Ctrl and +/-
// work the throttle; Enter starts, restarts and confirms.
const KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract',
  'Enter', 'Space', 'KeyR', 'KeyM', 'KeyP',
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set(); // keys hit since the last frame (edge-triggered)
    this.mouseDX = 0; // accumulated drag this frame, for looking around
    this.mouseDY = 0;
    this.dragging = false;
    this._onKeyDown = (e) => {
      if (!KEYS.has(e.code)) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
      this.dragging = false;
    };
    this._onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      this.dragging = true;
    };
    this._onMouseUp = () => {
      this.dragging = false;
    };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onWheel = (e) => {
      // The wheel trims the throttle a notch at a time.
      this.wheelDelta = (this.wheelDelta || 0) + (e.deltaY < 0 ? 1 : -1);
      e.preventDefault();
    };
    this.wheelDelta = 0;
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
  }

  // True when any key is held, for "press any key" prompts.
  anyKeyDown() {
    return this.down.size > 0;
  }

  // Call once per frame: clears the edge-triggered set and the drag deltas.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Pitch input: +1 climbs, -1 descends. Up/W climbs, Down/S descends.
  // (An arcade choice: real sticks pull to climb, but a courier game reads
  // better when up means up.)
  pitchAxis() {
    let v = 0;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) v += 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) v -= 1;
    return v;
  }

  // Roll input: +1 banks right, -1 banks left.
  rollAxis() {
    let v = 0;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) v += 1;
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) v -= 1;
    return v;
  }

  // Throttle input: +1 opens it, -1 closes it. Shift opens, Ctrl closes.
  throttleAxis() {
    let v = 0;
    if (this.isDown('ShiftLeft') || this.isDown('ShiftRight')) v += 1;
    if (this.isDown('ControlLeft') || this.isDown('ControlRight')) v -= 1;
    if (this.isDown('Equal') || this.isDown('NumpadAdd')) v += 1;
    if (this.isDown('Minus') || this.isDown('NumpadSubtract')) v -= 1;
    v += this.wheelDelta * 0.1;
    return v;
  }
}

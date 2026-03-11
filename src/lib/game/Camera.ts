import type { Vector2D } from './types';

/**
 * First-person camera for the 2D store renderer.
 *
 * Coordinate convention
 * ─────────────────────
 *   yaw = 0       → facing north  (−Y in canvas space)
 *   yaw increases clockwise (east = π/2, south = π, west = 3π/2)
 *
 * Canvas transform applied by GameEngine.render():
 *   translate(cx, cy)          — pivot at screen centre
 *   rotate(−yaw)               — rotate world opposite to yaw so forward faces up
 *   scale(zoom, zoom)
 *   translate(−position.x, −position.y) — centre on player
 */
export class Camera {
    /** World-space position of the camera (equals player's world position). */
    public position: Vector2D;

    /** Eye height in world units (semantic; does not affect 2D rendering). */
    public readonly eyeHeight: number = 1.6;

    /**
     * Horizontal rotation in radians.
     * 0 = north, increases clockwise.
     */
    public yaw: number = 0;

    /**
     * Vertical rotation in radians.
     * Clamped to [−MAX_PITCH, +MAX_PITCH] (±60°).
     * Stored for future use; 2D renderer cannot represent true pitch.
     */
    public pitch: number = 0;

    public width: number;
    public height: number;

    /** If true, the canvas holds the pointer-lock so mouse-look is active. */
    public pointerLocked: boolean = false;

    private targetPosition: Vector2D;
    private _zoom: number = 1.2;

    private mountedElement: HTMLElement | null = null;

    private static readonly MAX_PITCH = Math.PI / 3;          // 60°
    private static readonly YAW_SENSITIVITY = 0.0025;
    private static readonly PITCH_SENSITIVITY = 0.0025;

    // ── Bound listeners ────────────────────────────────────────────────────────

    private readonly _onMouseMove = (e: MouseEvent): void => {
        if (!this.pointerLocked) return;

        this.yaw += e.movementX * Camera.YAW_SENSITIVITY;
        // Normalise yaw to [0, 2π)
        this.yaw = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        this.pitch -= e.movementY * Camera.PITCH_SENSITIVITY;
        this.pitch = Math.max(-Camera.MAX_PITCH, Math.min(Camera.MAX_PITCH, this.pitch));
    };

    private readonly _onLockChange = (): void => {
        this.pointerLocked = document.pointerLockElement === this.mountedElement;
    };

    private readonly _onClick = (): void => {
        if (!this.pointerLocked && this.mountedElement) {
            this.mountedElement.requestPointerLock();
        }
    };

    // ── Constructor / lifecycle ────────────────────────────────────────────────

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        // Start camera centred on the store's default spawn area.
        this.position = { x: 600, y: 700 };
        this.targetPosition = { ...this.position };
    }

    /**
     * Attach pointer-lock mouse-look to `element`.
     * Call once after the canvas is mounted.
     */
    mount(element: HTMLElement): void {
        this.unmount();
        this.mountedElement = element;
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', this._onLockChange);
        element.addEventListener('click', this._onClick);
    }

    /** Detach pointer-lock listeners and release the lock if held. */
    unmount(): void {
        if (!this.mountedElement) return;
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('pointerlockchange', this._onLockChange);
        this.mountedElement.removeEventListener('click', this._onClick);
        if (this.pointerLocked) {
            document.exitPointerLock();
        }
        this.mountedElement = null;
        this.pointerLocked = false;
    }

    // ── Camera tracking ────────────────────────────────────────────────────────

    /** Track the player position exactly (first-person: camera IS the player). */
    follow(target: Vector2D): void {
        this.targetPosition = { ...target };
    }

    /**
     * Advance interpolation.
     * Uses a very tight smoothing factor so the view stays glued to the player
     * without the disorienting lag of slower follow cameras.
     */
    update(): void {
        const alpha = 0.85;
        this.position.x += (this.targetPosition.x - this.position.x) * alpha;
        this.position.y += (this.targetPosition.y - this.position.y) * alpha;
    }

    // ── Coordinate transforms ──────────────────────────────────────────────────

    /**
     * Convert a world-space point to screen-space, accounting for yaw rotation.
     *
     * Matches the canvas transform applied in GameEngine.render():
     *   translate(cx, cy) → rotate(−yaw) → scale(zoom) → translate(−pos)
     */
    worldToScreen(worldPos: Vector2D): Vector2D {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const dx = (worldPos.x - this.position.x) * this._zoom;
        const dy = (worldPos.y - this.position.y) * this._zoom;
        const cosY = Math.cos(this.yaw);
        const sinY = Math.sin(this.yaw);
        return {
            x:  dx * cosY + dy * sinY + cx,
            y: -dx * sinY + dy * cosY + cy,
        };
    }

    /** Inverse of worldToScreen — convert screen coords back to world space. */
    screenToWorld(screenPos: Vector2D): Vector2D {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const sx = (screenPos.x - cx) / this._zoom;
        const sy = (screenPos.y - cy) / this._zoom;
        const cosY = Math.cos(this.yaw);
        const sinY = Math.sin(this.yaw);
        return {
            x: sx * cosY - sy * sinY + this.position.x,
            y: sx * sinY + sy * cosY + this.position.y,
        };
    }

    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    // ── Forward vector ─────────────────────────────────────────────────────────

    /**
     * Unit vector pointing in the camera's facing direction (world space).
     * yaw = 0 → north (−Y), yaw = π/2 → east (+X).
     */
    get forward(): Vector2D {
        return {
            x:  Math.sin(this.yaw),
            y: -Math.cos(this.yaw),
        };
    }

    /**
     * Unit vector 90° clockwise from forward (strafe-right direction).
     */
    get right(): Vector2D {
        return {
            x:  Math.cos(this.yaw),
            y:  Math.sin(this.yaw),
        };
    }

    // ── Zoom ──────────────────────────────────────────────────────────────────

    get zoom(): number { return this._zoom; }

    setZoom(zoom: number): void {
        this._zoom = Math.max(0.5, Math.min(2.0, zoom));
    }

    adjustZoom(delta: number): void {
        this.setZoom(this._zoom + delta);
    }

    // ── Legacy / compatibility helpers ─────────────────────────────────────────

    /** @deprecated Use yaw directly. */
    get rotation(): number { return this.yaw; }

    get x(): number { return this.position.x; }
    get y(): number { return this.position.y; }

    setAerialView(): void  { this._zoom = 0.6; this.yaw = 0; }
    setNormalView(): void  { this._zoom = 1.2; this.yaw = 0; }
    setCloseView(): void   { this._zoom = 1.5; }

    getCurrentView(): 'aerial' | 'normal' | 'close' {
        if (this._zoom <= 0.7) return 'aerial';
        if (this._zoom >= 1.4) return 'close';
        return 'normal';
    }

    reset(): void {
        this._zoom = 1.2;
        this.yaw   = 0;
        this.pitch = 0;
    }
}

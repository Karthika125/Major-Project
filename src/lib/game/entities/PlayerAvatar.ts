import { Avatar } from './Avatar';
import type { Vector2D, Direction } from '../types';
import { isWalkable } from '../Store';
import type { InputManager } from '../InputManager';

/**
 * World-unit scale: 1 unit = 60 pixels (store is 1200 × 900 px = 20 × 15 units).
 * Walk: 2.5 u/s = 150 px/s   Run: 5 u/s = 300 px/s
 */
const UNIT        = 60;  // px per world unit
const WALK_SPEED  = 2.5 * UNIT;   // 150 px/s
const RUN_SPEED   = 5.0 * UNIT;   // 300 px/s

export class PlayerAvatar extends Avatar {
    private inputManager: InputManager;
    private velocity: Vector2D = { x: 0, y: 0 };
    private movementAnimation: 'idle' | 'walk' | 'run' = 'idle';
    public currentAction: 'idle' | 'walking' | 'viewing_product' | 'shopping' = 'idle';
    public viewingProductId?: string;
    public avatarCustomization: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    public animationState: 'idle' | 'walking' | 'waving' | 'shopping' = 'idle';
    private position3D: { x: number; y: number; z: number } = { x: 0, y: 1.6, z: 12 };
    /**
     * Camera yaw (radians) used to rotate WASD input into world-space.
     * Updated by GameEngine every frame before update() is called.
     */
    private cameraYaw: number = 0;

    constructor(
        userId: string,
        username: string,
        position: Vector2D,
        inputManager: InputManager,
        customization?: { bodyColor: string; skinTone: string; style: string }
    ) {
        super(userId, username, position);
        this.inputManager = inputManager;
        this.avatarCustomization = customization || {
            bodyColor: '#4A90E2',
            skinTone: '#FFD1A3',
            style: 'casual',
        };
    }

    /** Sync the camera's current yaw so WASD moves relative to facing direction. */
    setYaw(yaw: number): void {
        this.cameraYaw = yaw;
    }

    update(deltaTime: number): void {
        // ── 1. Read directional intent in camera-local space ─────────────────
        //   forwardInput : +1 = W (forward)   −1 = S (backward)
        //   strafeInput  : +1 = D (right)     −1 = A (left)
        let forwardInput = 0;
        let strafeInput  = 0;
        let newDirection: Direction = this.direction;

        if      (this.inputManager.isMovingUp())    { forwardInput =  1; newDirection = 'up'; }
        else if (this.inputManager.isMovingDown())  { forwardInput = -1; newDirection = 'down'; }

        if      (this.inputManager.isMovingLeft())  { strafeInput  = -1; if (forwardInput === 0) newDirection = 'left'; }
        else if (this.inputManager.isMovingRight()) { strafeInput  =  1; if (forwardInput === 0) newDirection = 'right'; }

        // ── 2. Normalise diagonal so movement speed is identical in every
        //      direction (prevents faster movement on diagonals).
        const rawLen = Math.sqrt(strafeInput ** 2 + forwardInput ** 2);
        if (rawLen > 1) { strafeInput /= rawLen; forwardInput /= rawLen; }

        // ── 3. Select walk / run speed (Shift = run). ─────────────────────
        const isSprinting = this.inputManager.isSprinting();
        const speed = isSprinting ? RUN_SPEED : WALK_SPEED;

        // ── 4. Project camera-local input into world space using camera yaw.
        //
        //   Camera convention: yaw = 0 → north (−Y), increases clockwise.
        //     forward world vector = (sin(yaw), −cos(yaw))
        //     right   world vector = (cos(yaw),  sin(yaw))
        //
        //   velocity = forwardInput * forward + strafeInput * right
        //
        //   Expanding components:
        //     vx = forwardInput * sin(yaw) + strafeInput * cos(yaw)
        //     vy = forwardInput * (−cos(yaw)) + strafeInput * sin(yaw)
        //        = −forwardInput * cos(yaw) + strafeInput * sin(yaw)
        //
        //   Verification (yaw = 0, facing north):
        //     W  → fwd=+1, str=0  → vx=0,  vy=−1  → moves north (−Y) ✓
        //     S  → fwd=−1, str=0  → vx=0,  vy=+1  → moves south (+Y) ✓
        //     A  → fwd=0, str=−1  → vx=−1, vy=0   → moves west  (−X) ✓
        //     D  → fwd=0, str=+1  → vx=+1, vy=0   → moves east  (+X) ✓
        const cosY = Math.cos(this.cameraYaw);
        const sinY = Math.sin(this.cameraYaw);

        this.velocity = {
            x: (forwardInput * sinY + strafeInput * cosY) * speed,
            y: (-forwardInput * cosY + strafeInput * sinY) * speed,
        };

        // ── 5. Determine animation / action state. ────────────────────────
        this.isMoving = this.velocity.x !== 0 || this.velocity.y !== 0;
        if (this.isMoving) {
            this.direction = newDirection;
            this.currentAction = 'walking';
            this.animationState = 'walking';
            this.movementAnimation = isSprinting ? 'run' : 'walk';
        } else {
            this.currentAction = this.viewingProductId ? 'viewing_product' : 'idle';
            this.animationState = this.viewingProductId ? 'shopping' : 'idle';
            this.movementAnimation = 'idle';
        }

        // ── 6. Collision — walls & shelves block; other players do not. ───
        //   isWalkable() tests the store geometry only (no other avatars).
        //   Remote avatars are never added to that check, so players can
        //   freely pass through each other.
        const newPosition = {
            x: this.position.x + this.velocity.x * deltaTime,
            y: this.position.y + this.velocity.y * deltaTime,
        };

        if (isWalkable(newPosition, this.getBounds())) {
            this.position = newPosition;
        } else {
            // Try axis-separated sliding so the player can slide along a wall
            // instead of stopping dead.
            const slideX = { x: newPosition.x, y: this.position.y };
            const slideY = { x: this.position.x, y: newPosition.y };
            if (isWalkable(slideX, this.getBounds())) {
                this.position = slideX;
            } else if (isWalkable(slideY, this.getBounds())) {
                this.position = slideY;
            }
            // Both axes blocked → stay put.
        }

        // ── 7. Advance sprite animation frames. ───────────────────────────
        super.update(deltaTime);
    }

    set3DPosition(x: number, y: number, z: number): void {
        this.position3D = { x, y, z };
    }

    get3DPosition(): { x: number; y: number; z: number } {
        return { ...this.position3D };
    }

    setViewingProduct(productId?: string): void {
        this.viewingProductId = productId;
        if (productId) {
            this.currentAction = 'viewing_product';
            this.animationState = 'shopping';
        } else if (!this.isMoving) {
            this.currentAction = 'idle';
            this.animationState = 'idle';
        }
    }

    updateCustomization(customization: { bodyColor: string; skinTone: string; style: string }): void {
        this.avatarCustomization = customization;
    }

    getState() {
        return {
            // 2D world-space position (source of truth for the 2D engine)
            position_x: this.position.x,
            position_y: this.position.y,
            position_z: 0,
            // Camera yaw so remote clients know which way this player is facing.
            rotation_yaw: this.cameraYaw,
            direction: this.direction,
            is_moving: this.isMoving,
            current_action: this.currentAction,
            viewing_product_id: this.viewingProductId,
            avatar_customization: this.avatarCustomization,
            animation_state: this.animationState,
            animation: this.movementAnimation,
        };
    }
}

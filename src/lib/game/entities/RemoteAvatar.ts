import { Avatar } from './Avatar';
import type { Vector2D, Direction } from '../types';

export interface RemoteAvatarData {
    position?: {
        x: number;
        y: number;
        z?: number;
    };
    position_x?: number;
    position_y?: number;
    position_z?: number;
    direction?: Direction;
    is_moving: boolean;
    current_action?: 'idle' | 'walking' | 'viewing_product' | 'shopping';
    viewing_product_id?: string;
    avatar_customization?: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    animation_state?: 'idle' | 'walking' | 'waving' | 'shopping';
    rotation_yaw?: number;
    animation?: 'idle' | 'walk' | 'run';
}

export class RemoteAvatar extends Avatar {
    private targetPosition: Vector2D;
    private targetPositionZ: number = 0;
    private interpolationSpeed: number = 0.15;
    private yawInterpolationSpeed: number = 0.15;
    private yaw: number = 0;
    private targetYaw: number = 0;
    private movementAnimation: 'idle' | 'walk' | 'run' = 'idle';
    public currentAction: 'idle' | 'walking' | 'viewing_product' | 'shopping' = 'idle';
    public viewingProductId?: string;
    public avatarCustomization?: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    public animationState: 'idle' | 'walking' | 'waving' | 'shopping' = 'idle';
    private animationTime: number = 0;

    constructor(userId: string, username: string, position: Vector2D) {
        super(userId, username, position);
        this.targetPosition = { ...position };
    }

    private normalizeYaw(yaw: number): number {
        const twoPi = Math.PI * 2;
        return ((yaw % twoPi) + twoPi) % twoPi;
    }

    private lerpAngle(current: number, target: number, alpha: number): number {
        const twoPi = Math.PI * 2;
        let delta = (target - current) % twoPi;
        if (delta > Math.PI) delta -= twoPi;
        if (delta < -Math.PI) delta += twoPi;
        return this.normalizeYaw(current + delta * alpha);
    }

    private yawToDirection(yaw: number): Direction {
        const normalized = this.normalizeYaw(yaw);
        const quarter = Math.PI / 4;

        if (normalized >= 7 * quarter || normalized < quarter) return 'up';
        if (normalized < 3 * quarter) return 'right';
        if (normalized < 5 * quarter) return 'down';
        return 'left';
    }

    updateFromServer(data: RemoteAvatarData): void {
        const nextX = Number(data.position?.x ?? data.position_x ?? this.targetPosition.x);
        const nextY = Number(
            data.position?.y ??
            data.position_y ??
            data.position?.z ??
            this.targetPosition.y
        );

        this.targetPosition = {
            x: nextX,
            y: nextY,
        };
        this.targetPositionZ = Number(data.position_z ?? data.position?.z ?? 0);

        const serverYaw = Number(data.rotation_yaw ?? this.targetYaw);
        this.targetYaw = this.normalizeYaw(serverYaw);

        this.direction = data.direction || this.yawToDirection(this.targetYaw);
        this.isMoving = data.is_moving;
        this.currentAction = data.current_action || 'idle';
        this.viewingProductId = data.viewing_product_id;
        this.avatarCustomization = data.avatar_customization;

        this.movementAnimation = data.animation || (data.is_moving ? 'walk' : 'idle');
        this.animationState =
            data.animation_state ||
            (this.movementAnimation === 'idle' ? 'idle' : 'walking');
    }

    update(deltaTime: number): void {
        // Smooth interpolation to target position (lerp factor 0.15).
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.01) {
            this.position.x += dx * this.interpolationSpeed;
            this.position.y += dy * this.interpolationSpeed;
            this.isMoving = true;
        } else {
            this.position = { ...this.targetPosition };
            if (distance < 0.01) {
                this.isMoving = false;
            }
        }

        // Smooth rotation interpolation so remote players turn naturally.
        this.yaw = this.lerpAngle(this.yaw, this.targetYaw, this.yawInterpolationSpeed);
        this.direction = this.yawToDirection(this.yaw);

        this.animationTime += deltaTime;

        if (this.isMoving) {
            this.animationState = 'walking';
        } else if (this.currentAction === 'viewing_product') {
            this.animationState = 'shopping';
        } else {
            this.animationState = 'idle';
        }

        super.update(deltaTime);
    }

    getYaw(): number {
        return this.yaw;
    }

    getAnimationOffset(): { x: number; y: number; z: number } {
        // Generate procedural animation offsets based on state
        switch (this.animationState) {
            case 'walking':
                // Bobbing motion while walking
                return {
                    x: 0,
                    y: Math.sin(this.animationTime * 8) * 0.05,
                    z: 0,
                };
            case 'waving':
                // Arm waving motion
                return {
                    x: Math.sin(this.animationTime * 4) * 0.1,
                    y: 0,
                    z: 0,
                };
            case 'shopping':
                // Slight lean forward
                return {
                    x: 0,
                    y: -0.05,
                    z: 0.02,
                };
            case 'idle':
            default:
                // Subtle breathing motion
                return {
                    x: 0,
                    y: Math.sin(this.animationTime * 2) * 0.02,
                    z: 0,
                };
        }
    }

    get3DPosition(): { x: number; y: number; z: number } {
        return {
            x: this.position.x,
            y: this.position.y,
            z: this.targetPositionZ,
        };
    }
}

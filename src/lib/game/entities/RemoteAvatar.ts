import { Avatar } from './Avatar';
import type { Vector2D, Direction } from '../types';

export interface RemoteAvatarData {
    position_x: number;
    position_y: number;
    position_z?: number;
    direction: Direction;
    is_moving: boolean;
    current_action?: 'idle' | 'walking' | 'viewing_product' | 'shopping';
    viewing_product_id?: string;
    avatar_customization?: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    animation_state?: 'idle' | 'walking' | 'waving' | 'shopping';
}

export class RemoteAvatar extends Avatar {
    private targetPosition: Vector2D;
    private targetPositionZ: number = 0;
    private interpolationSpeed: number = 0.15; // Smoother for 60fps updates
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

    updateFromServer(data: RemoteAvatarData): void {
        // Update target position for smooth interpolation
        this.targetPosition = { 
            x: data.position_x, 
            y: data.position_y 
        };
        this.targetPositionZ = data.position_z || 0;
        
        // Update state immediately
        this.direction = data.direction;
        this.isMoving = data.is_moving;
        this.currentAction = data.current_action || 'idle';
        this.viewingProductId = data.viewing_product_id;
        this.avatarCustomization = data.avatar_customization;
        this.animationState = data.animation_state || (data.is_moving ? 'walking' : 'idle');
    }

    update(deltaTime: number): void {
        // Smooth interpolation to target position (for 60fps updates)
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.01) {
            // Use linear interpolation
            this.position.x += dx * this.interpolationSpeed;
            this.position.y += dy * this.interpolationSpeed;
            this.isMoving = true;
        } else {
            this.position = { ...this.targetPosition };
            if (distance < 0.01) {
                this.isMoving = false;
            }
        }

        // Update animation time for procedural animations
        this.animationTime += deltaTime;

        // Update animation state based on movement
        if (this.isMoving) {
            this.animationState = 'walking';
        } else if (this.currentAction === 'viewing_product') {
            this.animationState = 'shopping';
        } else {
            this.animationState = 'idle';
        }

        // Update base avatar
        super.update(deltaTime);
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

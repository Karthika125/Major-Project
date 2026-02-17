import { Avatar } from './Avatar';
import type { Vector2D, Direction } from '../types';
import { isWalkable } from '../Store';
import type { InputManager } from '../InputManager';

export class PlayerAvatar extends Avatar {
    private inputManager: InputManager;
    private velocity: Vector2D = { x: 0, y: 0 };
    public currentAction: 'idle' | 'walking' | 'viewing_product' | 'shopping' = 'idle';
    public viewingProductId?: string;
    public avatarCustomization: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    public animationState: 'idle' | 'walking' | 'waving' | 'shopping' = 'idle';
    private position3D: { x: number; y: number; z: number } = { x: 0, y: 1.6, z: 12 };

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

    update(deltaTime: number): void {
        // Get input
        this.velocity = { x: 0, y: 0 };
        let newDirection: Direction = this.direction;

        if (this.inputManager.isMovingUp()) {
            this.velocity.y = -this.speed;
            newDirection = 'up';
        } else if (this.inputManager.isMovingDown()) {
            this.velocity.y = this.speed;
            newDirection = 'down';
        }

        if (this.inputManager.isMovingLeft()) {
            this.velocity.x = -this.speed;
            newDirection = 'left';
        } else if (this.inputManager.isMovingRight()) {
            this.velocity.x = this.speed;
            newDirection = 'right';
        }

        // Normalize diagonal movement
        if (this.velocity.x !== 0 && this.velocity.y !== 0) {
            const length = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            this.velocity.x = (this.velocity.x / length) * this.speed;
            this.velocity.y = (this.velocity.y / length) * this.speed;
        }

        this.isMoving = this.velocity.x !== 0 || this.velocity.y !== 0;
        if (this.isMoving) {
            this.direction = newDirection;
            this.currentAction = 'walking';
            this.animationState = 'walking';
        } else {
            this.currentAction = this.viewingProductId ? 'viewing_product' : 'idle';
            this.animationState = this.viewingProductId ? 'shopping' : 'idle';
        }

        // Calculate new position
        const newPosition = {
            x: this.position.x + this.velocity.x * deltaTime,
            y: this.position.y + this.velocity.y * deltaTime,
        };

        // Check if new position is walkable
        if (isWalkable(newPosition, this.getBounds())) {
            this.position = newPosition;
        }

        // Update animation
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
            position_x: this.position3D.x,
            position_y: this.position3D.y,
            position_z: this.position3D.z,
            direction: this.direction,
            is_moving: this.isMoving,
            current_action: this.currentAction,
            viewing_product_id: this.viewingProductId,
            avatar_customization: this.avatarCustomization,
            animation_state: this.animationState,
        };
    }
}

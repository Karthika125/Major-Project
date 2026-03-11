import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { StoreRenderer } from './StoreRenderer';
import { PlayerAvatar } from './entities/PlayerAvatar';
import { RemoteAvatar } from './entities/RemoteAvatar';
import { ProductEntity } from './entities/ProductEntity';
import { SPAWN_POINT, isInCheckoutArea } from './Store';
import type { Database } from '../supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private camera: Camera;
    private inputManager: InputManager;
    private storeRenderer: StoreRenderer;

    private playerAvatar: PlayerAvatar | null = null;
    private remoteAvatars: Map<string, RemoteAvatar> = new Map();
    private products: ProductEntity[] = [];

    private lastTime: number = 0;
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;

    private onProductClick: ((product: Product) => void) | null = null;
    private onCheckoutEnter: (() => void) | null = null;
    private onPositionUpdate: ((position: any) => void) | null = null;
    private onPlayerClick: ((player: { user_id: string; username: string }) => void) | null = null;
    private readonly handleResize = () => this.resize();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        this.camera = new Camera(canvas.width, canvas.height);
        this.inputManager = new InputManager(canvas);
        this.storeRenderer = new StoreRenderer();

        this.resize();
        window.addEventListener('resize', this.handleResize);

        // Attach mouse-look pointer-lock to the canvas
        this.camera.mount(canvas);

        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.camera.adjustZoom(delta);
        }, { passive: false });
    }

    private resize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.resize(this.canvas.width, this.canvas.height);
    }

    initPlayer(userId: string, username: string): void {
        this.playerAvatar = new PlayerAvatar(
            userId,
            username,
            { ...SPAWN_POINT },
            this.inputManager
        );
    }

    setProducts(products: Product[]): void {
        this.products = products.map((p) => new ProductEntity(p));
    }

    updateRemotePlayer(userId: string, username: string, data: any): void {
        const initialX = Number(data?.position?.x ?? data?.position_x ?? 0);
        const initialY = Number(
            data?.position?.y ??
            data?.position_y ??
            data?.position?.z ??
            0,
        );

        let avatar = this.remoteAvatars.get(userId);
        if (!avatar) {
            avatar = new RemoteAvatar(userId, username, {
                x: initialX,
                y: initialY,
            });
            this.remoteAvatars.set(userId, avatar);
        }
        avatar.updateFromServer(data);
    }

    removeRemotePlayer(userId: string): void {
        this.remoteAvatars.delete(userId);
    }

    setOnProductClick(callback: (product: Product) => void): void {
        this.onProductClick = callback;
    }

    setOnCheckoutEnter(callback: () => void): void {
        this.onCheckoutEnter = callback;
    }

    setOnPositionUpdate(callback: (position: any) => void): void {
        this.onPositionUpdate = callback;
    }

    setOnPlayerClick(callback: (player: { user_id: string; username: string }) => void): void {
        this.onPlayerClick = callback;
    }

    updatePlayerCustomization(bodyColor: string, skinTone: string): void {
        if (this.playerAvatar) {
            this.playerAvatar.bodyColor = bodyColor;
            this.playerAvatar.skinTone = skinTone;
        }
    }

    getInputManager(): InputManager {
        return this.inputManager;
    }

    getCamera(): Camera {
        return this.camera;
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    stop(): void {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private gameLoop = (currentTime: number): void => {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    };

    private update(deltaTime: number): void {
        // Update player
        if (this.playerAvatar) {
            const wasInCheckout = isInCheckoutArea(this.playerAvatar.position);

            // Sync camera yaw so WASD movement is relative to facing direction
            this.playerAvatar.setYaw(this.camera.yaw);
            this.playerAvatar.update(deltaTime);

            // Check if entered checkout area
            const isInCheckout = isInCheckoutArea(this.playerAvatar.position);
            if (!wasInCheckout && isInCheckout && this.onCheckoutEnter) {
                this.onCheckoutEnter();
            }

            // First-person: camera position tracks the player exactly
            this.camera.follow(this.playerAvatar.position);

            // Broadcast position + rotation_yaw to other clients.
            // camera.yaw is included via playerAvatar.getState().rotation_yaw.
            if (this.onPositionUpdate) {
                this.onPositionUpdate(this.playerAvatar.getState());
            }

            // Check product proximity
            this.products.forEach((product) => {
                product.checkProximity(this.playerAvatar!.position);
            });
        }

        // Advance camera interpolation
        this.camera.update();

        // Update remote avatars
        this.remoteAvatars.forEach((avatar) => {
            avatar.update(deltaTime);
        });

        // Handle clicks - use SCREEN coordinates instead of world coordinates
        if (this.inputManager.wasClicked()) {
            const mousePos = this.inputManager.getMousePosition();
            console.log('Click at screen pos:', mousePos);

            let clickedPlayer = false;

            // Check remote players in SCREEN space
            this.remoteAvatars.forEach((avatar) => {
                const screenPos = this.camera.worldToScreen(avatar.position);
                const screenBounds = {
                    x: screenPos.x,
                    y: screenPos.y,
                    width: avatar.width * this.camera.zoom,
                    height: avatar.height * this.camera.zoom
                };

                const padding = 30;
                if (
                    mousePos.x >= screenBounds.x - padding &&
                    mousePos.x <= screenBounds.x + screenBounds.width + padding &&
                    mousePos.y >= screenBounds.y - padding &&
                    mousePos.y <= screenBounds.y + screenBounds.height + padding
                ) {
                    console.log('✅ Clicked on remote player:', avatar.username);
                    if (this.onPlayerClick) {
                        this.onPlayerClick({
                            user_id: avatar.userId,
                            username: avatar.username
                        });
                    }
                    clickedPlayer = true;
                }
            });

            // If didn't click a player, check products
            if (!clickedPlayer) {
                for (const product of this.products) {
                    if (product.containsPoint(mousePos, this.camera.position)) {
                        if (this.onProductClick) {
                            this.onProductClick(product.product);
                        }
                        break;
                    }
                }
            }
        }
    }

    private render(): void {
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Clear and fill the full screen before the world transform is applied.
        // This prevents transparent corners when the camera is rotated (yaw ≠ 0).
        this.ctx.fillStyle = '#0a0a0f';
        this.ctx.fillRect(0, 0, W, H);

        // ── First-person canvas transform ────────────────────────────────────
        // 1. Translate to screen centre so rotation pivots there.
        // 2. Rotate by −yaw: the world appears to turn as the player looks around.
        // 3. Scale by zoom.
        // 4. Translate so the player's world position maps to screen centre.
        //
        // After this transform every render call can pass { x:0, y:0 } as the
        // camera offset because the transform handles the full mapping.
        // ─────────────────────────────────────────────────────────────────────
        const cx = W / 2;
        const cy = H / 2;
        const zeroCam = { x: 0, y: 0 };

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(-this.camera.yaw);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.position.x, -this.camera.position.y);

        // Render store environment
        this.storeRenderer.render(this.ctx, zeroCam);

        // Render remote avatars (other players)
        this.remoteAvatars.forEach((avatar) => {
            avatar.render(this.ctx, zeroCam);
        });

        // Render products
        this.products.forEach((product) => {
            product.render(this.ctx, zeroCam);
        });

        // Local player avatar is NOT rendered in first-person view because
        // the camera is attached to the player's eye position.

        this.ctx.restore();
    }

    cleanup(): void {
        this.stop();
        this.camera.unmount();
        this.inputManager.cleanup();
        window.removeEventListener('resize', this.handleResize);
    }
}

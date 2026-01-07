import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { StoreRenderer } from './StoreRenderer';
import { PlayerAvatar } from './entities/PlayerAvatar';
import { RemoteAvatar } from './entities/RemoteAvatar';
import { NPCAvatar } from './entities/NPCAvatar';
import { ProductEntity } from './entities/ProductEntity';
import { SPAWN_POINT, isInCheckoutArea, STORE_WIDTH, STORE_HEIGHT, getStoreConfig } from './Store';
import { useGameStore } from '../store/gameStore';
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
    private npcAvatars: NPCAvatar[] = [];
    private products: ProductEntity[] = [];

    private lastTime: number = 0;
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;

    private onProductClick: ((product: Product) => void) | null = null;
    private onCheckoutEnter: (() => void) | null = null;
    private onPositionUpdate: ((position: any) => void) | null = null;
    private onPlayerClick: ((player: { user_id: string; username: string }) => void) | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        this.camera = new Camera(canvas.width, canvas.height);
        this.inputManager = new InputManager(canvas);
        this.storeRenderer = new StoreRenderer();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.camera.adjustZoom(delta);
        }, { passive: false });
        // Spawn NPCs
        //this.spawnNPCs();
    }

    // private spawnNPCs(): void {
    //     const npcNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey'];

    //     for (let i = 0; i < 5; i++) {
    //         const x = Math.random() * (STORE_WIDTH - 200) + 100;
    //         const y = Math.random() * (STORE_HEIGHT - 200) + 100;
    //         const npc = new NPCAvatar(
    //             `npc-${i}`,
    //             npcNames[i],
    //             { x, y }
    //         );
    //         this.npcAvatars.push(npc);
    //     }
    // }

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
        let avatar = this.remoteAvatars.get(userId);
        if (!avatar) {
            avatar = new RemoteAvatar(userId, username, {
                x: data.position_x,
                y: data.position_y,
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

            this.playerAvatar.update(deltaTime);

            // Check if entered checkout area
            const isInCheckout = isInCheckoutArea(this.playerAvatar.position);
            if (!wasInCheckout && isInCheckout && this.onCheckoutEnter) {
                this.onCheckoutEnter();
            }

            // DO NOT follow player - keep camera centered on store
            // Camera stays fixed to show entire store

            // Send position update (throttled by caller)
            if (this.onPositionUpdate) {
                this.onPositionUpdate(this.playerAvatar.getState());
            }

            // Check product proximity
            this.products.forEach((product) => {
                product.checkProximity(this.playerAvatar!.position);
            });
        }

        // Update camera (but don't follow player)
        this.camera.update();

        // Update remote avatars
        this.remoteAvatars.forEach((avatar) => {
            avatar.update(deltaTime);
        });

        // Update NPCs
        this.npcAvatars.forEach((npc) => {
            npc.update(deltaTime);
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

            // Check NPCs in SCREEN space
            if (!clickedPlayer) {
                this.npcAvatars.forEach((npc) => {
                    const screenPos = this.camera.worldToScreen(npc.position);
                    const screenBounds = {
                        x: screenPos.x,
                        y: screenPos.y,
                        width: npc.width * this.camera.zoom,
                        height: npc.height * this.camera.zoom
                    };

                    const padding = 30;
                    if (
                        mousePos.x >= screenBounds.x - padding &&
                        mousePos.x <= screenBounds.x + screenBounds.width + padding &&
                        mousePos.y >= screenBounds.y - padding &&
                        mousePos.y <= screenBounds.y + screenBounds.height + padding
                    ) {
                        console.log('✅ Clicked on NPC:', npc.username);
                        if (this.onPlayerClick) {
                            this.onPlayerClick({
                                user_id: npc.userId,
                                username: npc.username
                            });
                        }
                        clickedPlayer = true;
                    }
                });
            }

            // If didn't click a player, check products
            if (!clickedPlayer) {
                const worldPos = this.camera.screenToWorld(mousePos);
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
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render store
        this.storeRenderer.render(this.ctx, this.camera.position);

        // Render player avatar
        if (this.playerAvatar) {
            this.playerAvatar.render(this.ctx, this.camera.position);
        }

        // Render remote avatars (other players)
        this.remoteAvatars.forEach((avatar) => {
            avatar.render(this.ctx, this.camera.position);
        });

        // Render NPCs
        this.npcAvatars.forEach((npc) => {
            npc.render(this.ctx, this.camera.position);
        });

        // Render products
        this.products.forEach((product) => {
            product.render(this.ctx, this.camera.position);
        });
    }

    cleanup(): void {
        this.stop();
        this.inputManager.cleanup();
        window.removeEventListener('resize', () => this.resize());
    }
}

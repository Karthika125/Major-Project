import { supabase } from '../supabase/client';
import { useGameStore } from '../store/gameStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface Rotation {
    x: number;
    y: number;
    z: number;
}

export interface PlayerState {
    position: Vector3;
    rotation: Rotation;
    direction: string;
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

interface PresencePayload extends PlayerState {
    user_id: string;
    username: string;
    avatar_url: string | null;
    store_id: string;
    online_at: string;
}

interface PlayerMovePayload {
    user_id: string;
    position: Vector3;
    rotation: Rotation;
    is_moving?: boolean;
    current_action?: 'idle' | 'walking' | 'viewing_product' | 'shopping';
    animation_state?: 'idle' | 'walking' | 'waving' | 'shopping';
}

interface BroadcastChatMessage {
    user_id: string;
    username: string;
    message: string;
    timestamp: string;
}

interface PlayerInteractionPayload {
    user_id: string;
    username: string;
    type: string;
    target_user_id?: string;
    created_at: string;
}

interface PresenceManagerOptions {
    isStoreOwner?: boolean;
    avatarUrl?: string | null;
}

const DEFAULT_PLAYER_STATE: PlayerState = {
    position: { x: 0, y: 1.6, z: 12 },
    rotation: { x: 0, y: 0, z: 0 },
    direction: 'down',
    is_moving: false,
    current_action: 'idle',
    animation_state: 'idle',
};

export const STORE_ROOM_CAPACITY = 10;

export class PresenceManager {
    private channel: RealtimeChannel | null = null;
    private readonly userId: string;
    private readonly username: string;
    private readonly storeId: string;
    private readonly isStoreOwner: boolean;
    private readonly avatarUrl: string | null;
    private currentState: PlayerState;
    private lastMoveBroadcastAt = 0;
    private lastPresenceTrackAt = 0;

    private readonly roomCapacity = STORE_ROOM_CAPACITY;
    private readonly moveBroadcastInterval = 90;
    private readonly presenceTrackInterval = 2500;

    constructor(userId: string, username: string, storeId: string, options: PresenceManagerOptions = {}) {
        this.userId = userId;
        this.username = username;
        this.storeId = storeId;
        this.isStoreOwner = Boolean(options.isStoreOwner);
        this.avatarUrl = options.avatarUrl || null;
        this.currentState = { ...DEFAULT_PLAYER_STATE };
    }

    async initialize(): Promise<void> {
        useGameStore.getState().setOtherPlayers([]);
        useGameStore.getState().setChatMessages([]);

        this.channel = supabase.channel(`store-room-${this.storeId}`, {
            config: {
                presence: {
                    key: this.userId,
                },
                broadcast: {
                    self: false,
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                this.handlePresenceSync(this.channel?.presenceState() || {});
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                this.handlePresenceJoin(newPresences || []);
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                this.handlePresenceLeave(leftPresences || []);
            })
            .on('broadcast', { event: 'player_move' }, (payload) => {
                this.handlePlayerMove(payload.payload as PlayerMovePayload);
            })
            .on('broadcast', { event: 'chat_message' }, (payload) => {
                this.handleChatMessage(payload.payload as BroadcastChatMessage);
            })
            .on('broadcast', { event: 'player_interaction' }, (payload) => {
                this.handlePlayerInteraction(payload.payload as PlayerInteractionPayload);
            });

        await new Promise<void>((resolve, reject) => {
            let settled = false;

            this.channel?.subscribe(async (status, error) => {
                if (status === 'SUBSCRIBED') {
                    const occupancy = this.countPresentUsers(this.channel?.presenceState() || {});
                    if (occupancy >= this.roomCapacity && !this.isStoreOwner) {
                        await this.channel?.unsubscribe();
                        this.channel = null;

                        if (!settled) {
                            settled = true;
                            const storeFullError = new Error('Store Full') as Error & {
                                occupancy?: number;
                                capacity?: number;
                            };
                            storeFullError.occupancy = occupancy;
                            storeFullError.capacity = this.roomCapacity;
                            reject(storeFullError);
                        }
                        return;
                    }

                    await this.trackPresence(this.currentState);

                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                    return;
                }

                if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
                    settled = true;
                    reject(error || new Error('Failed to connect to store room.'));
                }
            });
        });
    }

    private countPresentUsers(state: Record<string, any>): number {
        const userIds = new Set<string>();

        Object.values(state).forEach((entries) => {
            (entries || []).forEach((presence: any) => {
                if (!presence?.user_id) {
                    return;
                }

                if (presence.store_id && presence.store_id !== this.storeId) {
                    return;
                }

                userIds.add(presence.user_id);
            });
        });

        return userIds.size;
    }

    private mapPresenceToPlayer(presence: any): any {
        const position = presence?.position || DEFAULT_PLAYER_STATE.position;
        const rotation = presence?.rotation || DEFAULT_PLAYER_STATE.rotation;

        return {
            user_id: presence.user_id,
            username: presence.username || 'Shopper',
            avatar_url: presence.avatar_url || null,
            store_id: presence.store_id || this.storeId,
            position,
            rotation,
            position_x: Number(position.x || 0),
            position_y: Number(position.z || 0),
            direction: presence.direction || 'down',
            is_moving: Boolean(presence.is_moving),
            current_action: presence.current_action || 'idle',
            viewing_product_id: presence.viewing_product_id,
            avatar_customization: presence.avatar_customization,
            animation_state: presence.animation_state || (presence.is_moving ? 'walking' : 'idle'),
            last_seen: presence.online_at || new Date().toISOString(),
        };
    }

    private handlePresenceSync(state: Record<string, any>): void {
        const players: any[] = [];

        Object.values(state).forEach((entries) => {
            (entries || []).forEach((presence: any) => {
                if (!presence?.user_id || presence.user_id === this.userId) {
                    return;
                }

                if (presence.store_id && presence.store_id !== this.storeId) {
                    return;
                }

                players.push(this.mapPresenceToPlayer(presence));
            });
        });

        useGameStore.getState().setOtherPlayers(players as any);
    }

    private handlePresenceJoin(newPresences: any[]): void {
        newPresences.forEach((presence) => {
            if (!presence?.user_id || presence.user_id === this.userId) {
                return;
            }

            if (presence.store_id && presence.store_id !== this.storeId) {
                return;
            }

            useGameStore.getState().updatePlayerPosition(
                presence.user_id,
                this.mapPresenceToPlayer(presence)
            );
        });
    }

    private handlePresenceLeave(leftPresences: any[]): void {
        leftPresences.forEach((presence) => {
            if (!presence?.user_id) {
                return;
            }

            useGameStore.getState().removePlayer(presence.user_id);
        });
    }

    private handlePlayerMove(payload: PlayerMovePayload): void {
        if (!payload?.user_id || payload.user_id === this.userId) {
            return;
        }

        if (!payload.position || !payload.rotation) {
            return;
        }

        useGameStore.getState().updatePlayerPosition(payload.user_id, {
            user_id: payload.user_id,
            position: payload.position,
            rotation: payload.rotation,
            position_x: payload.position.x,
            position_y: payload.position.z,
            is_moving: payload.is_moving ?? true,
            animation_state: payload.animation_state || ((payload.is_moving ?? true) ? 'walking' : 'idle'),
            current_action: payload.current_action,
            last_seen: new Date().toISOString(),
        } as any);
    }

    private handleChatMessage(message: BroadcastChatMessage): void {
        if (!message?.user_id || !message.username || !message.message || !message.timestamp) {
            return;
        }

        if (message.user_id === this.userId) {
            return;
        }

        useGameStore.getState().addChatMessage({
            id: `${message.user_id}-${message.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            user_id: message.user_id,
            username: message.username,
            message: message.message,
            timestamp: message.timestamp,
        });
    }

    private handlePlayerInteraction(payload: PlayerInteractionPayload): void {
        if (!payload?.user_id || payload.user_id === this.userId) {
            return;
        }

        if (payload.target_user_id && payload.target_user_id !== this.userId) {
            return;
        }

        const interactionType = payload.type || 'idle';
        useGameStore.getState().updatePlayerPosition(payload.user_id, {
            current_action: interactionType === 'chat' ? 'shopping' : 'idle',
            animation_state: interactionType === 'wave' ? 'waving' : 'idle',
        } as any);

        if (interactionType === 'wave') {
            setTimeout(() => {
                useGameStore.getState().updatePlayerPosition(payload.user_id, {
                    animation_state: 'idle',
                    current_action: 'idle',
                } as any);
            }, 1200);
        }
    }

    private async trackPresence(state: PlayerState): Promise<void> {
        if (!this.channel) {
            return;
        }

        const payload: PresencePayload = {
            user_id: this.userId,
            username: this.username,
            avatar_url: this.avatarUrl,
            store_id: this.storeId,
            online_at: new Date().toISOString(),
            ...state,
        };

        await this.channel.track(payload);
    }

    async updateState(state: Partial<PlayerState>): Promise<void> {
        const now = Date.now();

        this.currentState = {
            ...this.currentState,
            ...state,
            position: {
                ...this.currentState.position,
                ...(state.position || {}),
            },
            rotation: {
                ...this.currentState.rotation,
                ...(state.rotation || {}),
            },
        };

        if (this.channel && now - this.lastMoveBroadcastAt >= this.moveBroadcastInterval) {
            this.lastMoveBroadcastAt = now;

            await this.channel.send({
                type: 'broadcast',
                event: 'player_move',
                payload: {
                    user_id: this.userId,
                    position: this.currentState.position,
                    rotation: this.currentState.rotation,
                    is_moving: this.currentState.is_moving,
                    current_action: this.currentState.current_action,
                    animation_state: this.currentState.animation_state,
                } as PlayerMovePayload,
            });
        }

        if (now - this.lastPresenceTrackAt >= this.presenceTrackInterval) {
            this.lastPresenceTrackAt = now;
            await this.trackPresence(this.currentState);
        }
    }

    async sendMessage(message: string): Promise<void> {
        if (!this.channel) {
            throw new Error('Not connected to store room.');
        }

        const timestamp = new Date().toISOString();
        const payload: BroadcastChatMessage = {
            user_id: this.userId,
            username: this.username,
            message,
            timestamp,
        };

        await this.channel.send({
            type: 'broadcast',
            event: 'chat_message',
            payload,
        });

        useGameStore.getState().addChatMessage({
            id: `${this.userId}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            user_id: this.userId,
            username: this.username,
            message,
            timestamp,
        });
    }

    async sendPlayerInteraction(type: 'wave' | 'chat' | 'follow', targetUserId?: string): Promise<void> {
        if (!this.channel) {
            return;
        }

        const payload: PlayerInteractionPayload = {
            user_id: this.userId,
            username: this.username,
            type,
            target_user_id: targetUserId,
            created_at: new Date().toISOString(),
        };

        await this.channel.send({
            type: 'broadcast',
            event: 'player_interaction',
            payload,
        });
    }

    async updatePosition(position: {
        position_x: number;
        position_y: number;
        direction: string;
        is_moving: boolean;
    }): Promise<void> {
        await this.updateState({
            position: {
                x: position.position_x,
                y: 1.6,
                z: position.position_y,
            },
            direction: position.direction,
            is_moving: position.is_moving,
            animation_state: position.is_moving ? 'walking' : 'idle',
        });
    }

    async updateAction(action: 'idle' | 'walking' | 'viewing_product' | 'shopping', productId?: string): Promise<void> {
        await this.updateState({
            current_action: action,
            viewing_product_id: productId,
        });
    }

    async updateAvatar(customization: { bodyColor: string; skinTone: string; style: string }): Promise<void> {
        await this.updateState({
            avatar_customization: customization,
        });
    }

    async updateAnimation(animation: 'idle' | 'walking' | 'waving' | 'shopping'): Promise<void> {
        await this.updateState({
            animation_state: animation,
        });
    }

    getCurrentState(): PlayerState {
        return this.currentState;
    }

    async cleanup(): Promise<void> {
        useGameStore.getState().setChatMessages([]);

        if (this.channel) {
            try {
                await this.channel.untrack();
                await this.channel.unsubscribe();
            } catch (error) {
                console.error('❌ Error unsubscribing from store room:', error);
            }
        }

        this.channel = null;
    }
}

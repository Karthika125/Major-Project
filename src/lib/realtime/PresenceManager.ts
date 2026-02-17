import { supabase } from '../supabase/client';
import { useGameStore } from '../store/gameStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PlayerState {
    position_x: number;
    position_y: number;
    position_z?: number;
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

export class PresenceManager {
    private channel: RealtimeChannel | null = null;
    private userId: string;
    private username: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private lastRealtimeUpdate: number = 0;
    private lastDbUpdate: number = 0;
    private currentState: PlayerState | null = null;
    
    // 60fps = ~16ms per frame, we'll send updates every frame
    private readonly REALTIME_UPDATE_INTERVAL = 16; // ~60fps
    private readonly DB_UPDATE_INTERVAL = 5000; // 5 seconds for persistence
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    constructor(userId: string, username: string) {
        this.userId = userId;
        this.username = username;
    }

    async initialize(): Promise<void> {
        try {
            // Subscribe to presence channel with auto-reconnect
            this.channel = supabase.channel('store-presence', {
                config: {
                    presence: {
                        key: this.userId,
                    },
                },
            });

            // Listen for presence changes
            this.channel
                .on('presence', { event: 'sync' }, () => {
                    const state = this.channel!.presenceState();
                    this.handlePresenceSync(state);
                })
                .on('presence', { event: 'join' }, ({ newPresences }) => {
                    console.log('👋 Player joined:', newPresences);
                    newPresences.forEach((presence: any) => {
                        if (presence.user_id !== this.userId) {
                            useGameStore.getState().updatePlayerPosition(presence.user_id, presence);
                        }
                    });
                })
                .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                    console.log('👋 Player left:', leftPresences);
                    leftPresences.forEach((presence: any) => {
                        useGameStore.getState().removePlayer(presence.user_id);
                    });
                })
                .subscribe(async (status, error) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Presence channel connected');
                        this.reconnectAttempts = 0;
                        
                        // Track initial presence
                        const initialState: PlayerState = {
                            position_x: 0,
                            position_y: 1.6,
                            position_z: 12,
                            direction: 'down',
                            is_moving: false,
                            current_action: 'idle',
                            animation_state: 'idle',
                        };
                        await this.updateState(initialState);
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Presence channel error:', error);
                        this.handleReconnect();
                    } else if (status === 'TIMED_OUT') {
                        console.warn('⏱️ Presence channel timed out');
                        this.handleReconnect();
                    }
                });

            // Subscribe to database changes for persistence fallback
            supabase
                .channel('user_presence_db')
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'user_presence',
                    },
                    (payload) => {
                        const data = payload.old as any;
                        useGameStore.getState().removePlayer(data.user_id);
                    }
                )
                .subscribe();

            // Load existing users from database (initial snapshot)
            const { data: existingUsers, error: fetchError } = await supabase
                .from('user_presence')
                .select('*')
                .neq('user_id', this.userId);

            if (fetchError) {
                console.error('❌ Failed to load existing users:', fetchError);
            } else if (existingUsers && existingUsers.length > 0) {
                console.log(`✅ Loaded ${existingUsers.length} existing players`);
                useGameStore.getState().setOtherPlayers(existingUsers);
            }
        } catch (error) {
            console.error('❌ Presence initialization failed:', error);
            throw error;
        }
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('❌ Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

        setTimeout(() => {
            this.initialize().catch(err => {
                console.error('❌ Reconnection failed:', err);
            });
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000)); // Exponential backoff
    }

    private handlePresenceSync(state: any): void {
        const players: any[] = [];

        Object.keys(state).forEach((key) => {
            const presences = state[key];
            presences.forEach((presence: any) => {
                if (presence.user_id !== this.userId) {
                    players.push(presence);
                }
            });
        });

        // Batch update all remote players
        if (players.length > 0) {
            console.log(`🔄 Syncing ${players.length} players`);
            players.forEach((player) => {
                useGameStore.getState().updatePlayerPosition(player.user_id, player);
            });
        }
    }

    private async trackPresence(data: PlayerState): Promise<void> {
        if (this.channel) {
            try {
                await this.channel.track({
                    user_id: this.userId,
                    username: this.username,
                    ...data,
                    online_at: new Date().toISOString(),
                });
            } catch (error) {
                console.error('❌ Failed to track presence:', error);
            }
        }
    }

    private async updateDatabase(data: PlayerState): Promise<void> {
        try {
            const { error } = await supabase.from('user_presence').upsert({
                user_id: this.userId,
                username: this.username,
                position_x: data.position_x,
                position_y: data.position_y,
                direction: data.direction,
                is_moving: data.is_moving,
                last_seen: new Date().toISOString(),
            } as any); // Type assertion needed due to schema type inference

            if (error) {
                console.error('❌ Database update failed:', error);
            }
        } catch (error) {
            console.error('❌ Database update exception:', error);
        }
    }

    // New unified state update method
    async updateState(state: Partial<PlayerState>): Promise<void> {
        const now = Date.now();

        // Merge with current state
        this.currentState = {
            ...this.currentState,
            ...state,
        } as PlayerState;

        // Send to Realtime (60fps - controlled by caller throttling)
        if (now - this.lastRealtimeUpdate >= this.REALTIME_UPDATE_INTERVAL) {
            this.lastRealtimeUpdate = now;
            await this.trackPresence(this.currentState);
        }

        // Throttle database writes (every 5 seconds)
        if (now - this.lastDbUpdate >= this.DB_UPDATE_INTERVAL) {
            this.lastDbUpdate = now;
            // Fire and forget to avoid blocking
            this.updateDatabase(this.currentState).catch(err => 
                console.error('DB update failed', err)
            );
        }
    }

    // Legacy method for backward compatibility
    async updatePosition(position: {
        position_x: number;
        position_y: number;
        direction: string;
        is_moving: boolean;
    }): Promise<void> {
        await this.updateState({
            position_x: position.position_x,
            position_y: position.position_y,
            direction: position.direction,
            is_moving: position.is_moving,
            animation_state: position.is_moving ? 'walking' : 'idle',
        });
    }

    // New methods for enhanced multiplayer
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

    getCurrentState(): PlayerState | null {
        return this.currentState;
    }

    async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up presence manager...');
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.channel) {
            try {
                await this.channel.untrack();
                await this.channel.unsubscribe();
                console.log('✅ Unsubscribed from presence channel');
            } catch (error) {
                console.error('❌ Error unsubscribing:', error);
            }
        }

        // Final database update on exit
        if (this.currentState) {
            try {
                await this.updateDatabase(this.currentState);
            } catch (error) {
                console.error('❌ Final DB update failed:', error);
            }
        }

        // Optional: Remove from DB to show as offline
        try {
            await supabase.from('user_presence').delete().eq('user_id', this.userId);
            console.log('✅ Removed from user_presence');
        } catch (error) {
            console.error('❌ Failed to remove presence:', error);
        }
    }
}

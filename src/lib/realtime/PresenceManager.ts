import { supabase } from '../supabase/client';
import { useGameStore } from '../store/gameStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class PresenceManager {
    private channel: RealtimeChannel | null = null;
    private userId: string;
    private username: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private lastPosition: any = null;

    private lastDbUpdate: number = 0;
    private readonly DB_UPDATE_INTERVAL = 5000; // 5 seconds

    constructor(userId: string, username: string) {
        this.userId = userId;
        this.username = username;
    }

    async initialize(): Promise<void> {
        // Subscribe to presence channel
        this.channel = supabase.channel('store-presence');

        // Listen for presence changes
        this.channel
            .on('presence', { event: 'sync' }, () => {
                const state = this.channel!.presenceState();
                this.handlePresenceSync(state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', leftPresences);
                leftPresences.forEach((presence: any) => {
                    useGameStore.getState().removePlayer(presence.user_id);
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Track our presence
                    await this.trackPresence({
                        position_x: 400,
                        position_y: 300,
                        direction: 'down',
                        is_moving: false
                    });
                }
            });

        // Also subscribe to user_presence table for persistence
        // optimize: only listen for DELETE or rare INSERTs (new users)
        // frequent UPDATEs from other users might come via DB if they are not on Realtime?
        // But for this game, Realtime is the source of truth for movement.
        supabase
            .channel('user_presence_db')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence',
                },
                (payload) => {
                    // We prioritize Realtime Presence for movement
                    // But if a user is NOT in presence state (maybe different server region?),
                    // we could fall back to DB. However, mixing them causes jitter.
                    // For now, we only handle DELETE to clean up ghosts.
                    if (payload.eventType === 'DELETE') {
                        const data = payload.old as any;
                        useGameStore.getState().removePlayer(data.user_id);
                    }
                }
            )
            .subscribe();

        // Insert initial presence in database
        await this.updateDatabase({
            position_x: 400,
            position_y: 300,
            direction: 'down',
            is_moving: false
        });

        // Load existing users (snapshot)
        const { data: existingUsers } = await supabase
            .from('user_presence')
            .select('*')
            .neq('user_id', this.userId);

        if (existingUsers) {
            useGameStore.getState().setOtherPlayers(existingUsers);
        }
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

        // Update store with all remote players
        players.forEach((player) => {
            useGameStore.getState().updatePlayerPosition(player.user_id, player);
        });
    }

    private async trackPresence(data: any) {
        if (this.channel) {
            await this.channel.track({
                user_id: this.userId,
                username: this.username,
                ...data,
                online_at: new Date().toISOString(),
            });
        }
    }

    private async updateDatabase(data: any) {
        await supabase.from('user_presence').upsert({
            user_id: this.userId,
            username: this.username,
            ...data,
            last_seen: new Date().toISOString(),
        });
    }

    async updatePosition(position: {
        position_x: number;
        position_y: number;
        direction: string;
        is_moving: boolean;
    }): Promise<void> {
        const now = Date.now();

        // 1. Always update Realtime Presence (throttled by check below)

        // Check if changed significantly
        if (this.lastPosition) {
            const dx = Math.abs(position.position_x - this.lastPosition.position_x);
            const dy = Math.abs(position.position_y - this.lastPosition.position_y);
            const moved = dx > 2 || dy > 2; // Threshold
            const stateChanged = position.is_moving !== this.lastPosition.is_moving;
            const directionChanged = position.direction !== this.lastPosition.direction;

            if (!moved && !stateChanged && !directionChanged) {
                return;
            }
        }

        this.lastPosition = position;

        // Send to Supabase Realtime (Fast)
        await this.trackPresence(position);

        // 2. Throttle Database Writes (Slow, Persistent)
        if (now - this.lastDbUpdate > this.DB_UPDATE_INTERVAL) {
            this.lastDbUpdate = now;
            // Fire and forget - don't await to avoid lagging the game loop
            this.updateDatabase(position).catch(err => console.error('DB update failed', err));
        }
    }

    async cleanup(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.channel) {
            await this.channel.untrack();
            await this.channel.unsubscribe();
        }

        // Final db update on exit
        if (this.lastPosition) {
            await this.updateDatabase(this.lastPosition);
        }

        // Optional: Remove from DB effectively "logging out"
        // await supabase.from('user_presence').delete().eq('user_id', this.userId);
    }
}

import { supabase } from '../supabase/client';
import { useGameStore } from '../store/gameStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
    id: string;
    user_id: string;
    username: string;
    message: string;
    position_x?: number;
    position_y?: number;
    position_z?: number;
    created_at: string;
    is_proximity?: boolean; // Temporary proximity-based message
    target_user_id?: string; // For direct messages to nearby players
}

export class ChatManager {
    private channel: RealtimeChannel | null = null;
    private userId: string;
    private username: string;
    private proximityMessages: Map<string, ChatMessage> = new Map();
    private readonly PROXIMITY_RADIUS = 5.0; // units in 3D space
    private readonly MESSAGE_LIFETIME = 30000; // 30 seconds for proximity messages

    constructor(userId: string, username: string) {
        this.userId = userId;
        this.username = username;
    }

    async initialize(): Promise<void> {
        console.log('💬 Initializing chat manager...');
        
        try {
            // Load recent persistent messages (global chat)
            const { data: messages, error: fetchError } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(50);

            if (fetchError) {
                console.error('❌ Failed to load chat messages:', fetchError);
            } else if (messages) {
                useGameStore.getState().setChatMessages(messages);
                console.log(`✅ Loaded ${messages.length} chat messages`);
            }

            // Subscribe to persistent chat (database)
            this.channel = supabase
                .channel('chat-messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                    },
                    (payload) => {
                        const message = payload.new as any;
                        useGameStore.getState().addChatMessage(message);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Chat channel connected');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Chat channel error');
                    }
                });

            // Subscribe to proximity chat (realtime broadcast only)
            supabase
                .channel('proximity-chat')
                .on('broadcast', { event: 'proximity-message' }, (payload) => {
                    this.handleProximityMessage(payload.payload as ChatMessage);
                })
                .subscribe();

        } catch (error) {
            console.error('❌ Chat initialization failed:', error);
            throw error;
        }
    }

    private handleProximityMessage(message: ChatMessage): void {
        // Ignore our own messages
        if (message.user_id === this.userId) return;

        // Check if message is targeted to us or if we're in range
        const shouldReceive = this.isPlayerInRange(
            message.position_x || 0,
            message.position_y || 0,
            message.position_z || 0
        );

        if (!shouldReceive) {
            return; // Too far away
        }

        // Add to proximity messages
        const msgId = message.id || `prox-${Date.now()}-${Math.random()}`;
        this.proximityMessages.set(msgId, {
            ...message,
            is_proximity: true,
            created_at: new Date().toISOString(),
        });

        // Add to store for display
        useGameStore.getState().addChatMessage({
            ...message,
            id: msgId,
            is_proximity: true,
        } as any);

        // Auto-remove after lifetime
        setTimeout(() => {
            this.proximityMessages.delete(msgId);
            // TODO: Remove from game store display
        }, this.MESSAGE_LIFETIME);

        console.log(`💬 Proximity message from ${message.username}: ${message.message}`);
    }

    private isPlayerInRange(x: number, y: number, z: number): boolean {
        const currentUser = useGameStore.getState().currentUser;
        if (!currentUser) return false;

        // Get current player position from presence manager or store
        // For now, we'll get it from the first other player (this should be improved)
        const otherPlayers = useGameStore.getState().otherPlayers;
        
        // Calculate distance (simplified - should use actual player position)
        // This is a placeholder - the actual position should come from the game state
        const distance = Math.sqrt(
            Math.pow(x, 2) +
            Math.pow(y - 1.6, 2) +
            Math.pow(z, 2)
        );

        return distance <= this.PROXIMITY_RADIUS;
    }

    // Send persistent global message (saved to database)
    async sendMessage(message: string, position?: { x: number; y: number }): Promise<void> {
        try {
            const { error } = await supabase.from('chat_messages').insert({
                user_id: this.userId,
                username: this.username,
                message,
                position_x: position?.x || null,
                position_y: position?.y || null,
            });

            if (error) {
                console.error('❌ Error sending message:', error);
                throw error;
            }
            
            console.log('✅ Message sent');
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            throw error;
        }
    }

    // Send proximity-based temporary message (realtime only, not saved)
    async sendProximityMessage(
        message: string, 
        position: { x: number; y: number; z: number },
        targetUserId?: string
    ): Promise<void> {
        try {
            const chatMessage: ChatMessage = {
                id: `temp-${Date.now()}-${Math.random()}`,
                user_id: this.userId,
                username: this.username,
                message,
                position_x: position.x,
                position_y: position.y,
                position_z: position.z,
                created_at: new Date().toISOString(),
                is_proximity: true,
                target_user_id: targetUserId,
            };

            // Broadcast via realtime (no database)
            await supabase.channel('proximity-chat').send({
                type: 'broadcast',
                event: 'proximity-message',
                payload: chatMessage,
            });

            // Also add to our own view
            this.proximityMessages.set(chatMessage.id, chatMessage);
            useGameStore.getState().addChatMessage(chatMessage as any);

            // Auto-remove after lifetime
            setTimeout(() => {
                this.proximityMessages.delete(chatMessage.id);
            }, this.MESSAGE_LIFETIME);

            console.log('✅ Proximity message sent');
        } catch (error) {
            console.error('❌ Failed to send proximity message:', error);
            throw error;
        }
    }

    // Get players within proximity range
    getNearbyPlayers(): Array<{ user_id: string; username: string; distance: number }> {
        const otherPlayers = useGameStore.getState().otherPlayers;
        const nearbyPlayers: Array<{ user_id: string; username: string; distance: number }> = [];

        // TODO: Get actual current player position
        const currentPosition = { x: 0, y: 1.6, z: 12 };

        otherPlayers.forEach(player => {
            const distance = Math.sqrt(
                Math.pow((player.position_x || 0) - currentPosition.x, 2) +
                Math.pow((player.position_y || 1.6) - currentPosition.y, 2) +
                Math.pow((player.position_z || 0) - currentPosition.z, 2)
            );

            if (distance <= this.PROXIMITY_RADIUS) {
                nearbyPlayers.push({
                    user_id: player.user_id,
                    username: player.username,
                    distance,
                });
            }
        });

        return nearbyPlayers.sort((a, b) => a.distance - b.distance);
    }

    // Clear proximity messages
    clearProximityMessages(): void {
        this.proximityMessages.clear();
    }

    async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up chat manager...');
        
        if (this.channel) {
            try {
                await this.channel.unsubscribe();
                console.log('✅ Unsubscribed from chat channel');
            } catch (error) {
                console.error('❌ Error unsubscribing from chat:', error);
            }
        }

        this.clearProximityMessages();
    }
}

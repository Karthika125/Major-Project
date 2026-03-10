import { create } from 'zustand';
import type { Database } from '../supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type CartItem = Database['public']['Tables']['cart_items']['Row'] & {
    product: Product;
};
type ChatMessage = {
    id: string;
    user_id: string;
    username: string;
    message: string;
    timestamp: string;
};
type UserPresence = Database['public']['Tables']['user_presence']['Row'] & {
    avatar_url?: string | null;
    store_id?: string;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    rotation?: {
        x: number;
        y: number;
        z: number;
    };
    current_action?: 'idle' | 'walking' | 'viewing_product' | 'shopping';
    viewing_product_id?: string;
    avatar_customization?: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    animation_state?: 'idle' | 'walking' | 'waving' | 'shopping';
};

interface GameState {
    // User
    currentUser: { id: string; username: string; avatar_type: string } | null;
    setCurrentUser: (user: { id: string; username: string; avatar_type: string } | null) => void;

    // Products
    products: Product[];
    setProducts: (products: Product[]) => void;

    // Cart
    cartItems: CartItem[];
    setCartItems: (items: CartItem[]) => void;
    addToCart: (item: CartItem) => void;
    removeFromCart: (itemId: string) => void;
    updateCartQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;

    // Chat
    chatMessages: ChatMessage[];
    addChatMessage: (message: ChatMessage) => void;
    setChatMessages: (messages: ChatMessage[]) => void;

    // Presence
    otherPlayers: UserPresence[];
    setOtherPlayers: (players: UserPresence[]) => void;
    updatePlayerPosition: (userId: string, position: Partial<UserPresence>) => void;
    removePlayer: (userId: string) => void;

    // UI State
    selectedProduct: Product | null;
    setSelectedProduct: (product: Product | null) => void;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    isCheckoutOpen: boolean;
    setIsCheckoutOpen: (isOpen: boolean) => void;
    isAIAssistantOpen: boolean;
    setIsAIAssistantOpen: (isOpen: boolean) => void;

    // Recommendations
    recommendations: Product[];
    setRecommendations: (products: Product[]) => void;

    // Scene State (3D)
    currentScene: 'entrance' | 'store';
    setCurrentScene: (scene: 'entrance' | 'store') => void;
    hasCompletedEntrance: boolean;
    setHasCompletedEntrance: (completed: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
    // User
    currentUser: null,
    setCurrentUser: (user) => set({ currentUser: user }),

    // Products
    products: [],
    setProducts: (products) => set({ products }),

    // Cart
    cartItems: [],
    setCartItems: (items) => set({ cartItems: items }),
    addToCart: (item) =>
        set((state) => {
            const existingItem = state.cartItems.find((i) => i.product_id === item.product_id);
            if (existingItem) {
                return {
                    cartItems: state.cartItems.map((i) =>
                        i.product_id === item.product_id
                            ? { ...i, ...item, quantity: item.quantity }
                            : i
                    ),
                };
            }
            return { cartItems: [...state.cartItems, item] };
        }),
    removeFromCart: (itemId) =>
        set((state) => ({
            cartItems: state.cartItems.filter((i) => i.id !== itemId),
        })),
    updateCartQuantity: (itemId, quantity) =>
        set((state) => ({
            cartItems: state.cartItems.map((i) =>
                i.id === itemId ? { ...i, quantity } : i
            ),
        })),
    clearCart: () => set({ cartItems: [] }),

    // Chat
    chatMessages: [],
    addChatMessage: (message) =>
        set((state) => ({
            chatMessages: [...state.chatMessages, message],
        })),
    setChatMessages: (messages) => set({ chatMessages: messages }),

    // Presence
    otherPlayers: [],
    setOtherPlayers: (players) => set({ otherPlayers: players }),
    updatePlayerPosition: (userId, position) =>
        set((state) => {
            const existingPlayer = state.otherPlayers.find((p) => p.user_id === userId);

            if (!existingPlayer) {
                const fallbackPosition = (position as any).position || {
                    x: Number((position as any).position_x || 0),
                    y: 1.6,
                    z: Number((position as any).position_y || 0),
                };

                const newPlayer: UserPresence = {
                    user_id: userId,
                    username: (position as any).username || 'Shopper',
                    position_x: Number((position as any).position_x ?? fallbackPosition.x ?? 0),
                    position_y: Number((position as any).position_y ?? fallbackPosition.z ?? 0),
                    direction: (position as any).direction ?? 'down',
                    is_moving: (position as any).is_moving ?? false,
                    last_seen: (position as any).last_seen ?? new Date().toISOString(),
                    ...(position as any),
                };

                return {
                    otherPlayers: [...state.otherPlayers, newPlayer],
                };
            }

            return {
                otherPlayers: state.otherPlayers.map((player) =>
                    player.user_id === userId
                        ? ({ ...player, ...(position as any) } as UserPresence)
                        : player
                ),
            };
        }),
    removePlayer: (userId) =>
        set((state) => ({
            otherPlayers: state.otherPlayers.filter((p) => p.user_id !== userId),
        })),

    // UI State
    selectedProduct: null,
    setSelectedProduct: (product) => set({ selectedProduct: product }),
    isCartOpen: false,
    setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),
    isChatOpen: true,
    setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
    isCheckoutOpen: false,
    setIsCheckoutOpen: (isOpen) => set({ isCheckoutOpen: isOpen }),
    isAIAssistantOpen: false,
    setIsAIAssistantOpen: (isOpen) => set({ isAIAssistantOpen: isOpen }),

    // Recommendations
    recommendations: [],
    setRecommendations: (products) => set({ recommendations: products }),

    // Scene State (3D)
    currentScene: 'entrance',
    setCurrentScene: (scene) => set({ currentScene: scene }),
    hasCompletedEntrance: false,
    setHasCompletedEntrance: (completed) => set({ hasCompletedEntrance: completed }),
}));

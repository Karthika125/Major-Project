//StorePage.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { PresenceManager } from '../lib/realtime/PresenceManager';
import { ChatManager } from '../lib/realtime/ChatManager';
import { supabase } from '../lib/supabase/client';
import { useGameStore } from '../lib/store/gameStore';
import { useAuth } from '../lib/auth/AuthProvider';
import { ProductModal } from '../components/ProductModal';
import { CartPanel } from '../components/CartPanel';
import { ChatPanel } from '../components/ChatPanel';
import { HUD } from '../components/HUD';
import { CheckoutModal } from '../components/CheckoutModal';
import { AIAssistant } from '../components/AIAssistant';
import { PlayerInteraction } from '../components/PlayerInteraction';
import { AvatarCustomization, AvatarCustomization as AvatarCustomizationType } from '../components/AvatarCustomization';
import { NotificationSystem } from '@/components/NotificationSystem';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { CameraStyleAdvisor } from '../components/CameraStyleAdvisor';
import { Store3D } from '../components/Store3D';
import { ProductProximityHUD } from '../components/ProductProximityHUD';
import styles from './StorePage.module.css';

interface StoreTheme {
    name: string;
    gradient: string;
    accentColor: string;
}

const THEME_PALETTE: Array<{ accentColor: string; gradient: string }> = [
    { accentColor: '#667eea', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { accentColor: '#4ECDC4', gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)' },
    { accentColor: '#FEC163', gradient: 'linear-gradient(135deg, #FEC163 0%, #DE4313 100%)' },
    { accentColor: '#9EC6F3', gradient: 'linear-gradient(135deg, #9EC6F3 0%, #7BA8D9 100%)' },
    { accentColor: '#f093fb', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { accentColor: '#FA8BFF', gradient: 'linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 90%, #2BFF88 100%)' },
];

const getThemeSeed = (value: string, modulo: number): number => {
    return value
        .split('')
        .reduce((acc, char) => (acc + char.charCodeAt(0)) % modulo, 0);
};

const buildStoreTheme = (storeId: string, storeName?: string): StoreTheme => {
    const paletteIndex = getThemeSeed(storeId, THEME_PALETTE.length);
    const palette = THEME_PALETTE[paletteIndex];

    return {
        name: storeName?.trim() || 'Store',
        accentColor: palette.accentColor,
        gradient: palette.gradient,
    };
};

export const StorePage: React.FC = () => {
    const presenceManagerRef = useRef<PresenceManager | null>(null);
    const chatManagerRef = useRef<ChatManager | null>(null);

    const { user } = useAuth();
    const navigate = useNavigate();
    const { storeId } = useParams<{ storeId: string }>();

    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [storeTheme, setStoreTheme] = useState<StoreTheme>(() =>
        buildStoreTheme(storeId || 'store', 'Store')
    );
    const [showPerformance, setShowPerformance] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<{ user_id: string; username: string } | null>(null);
    const [showCustomization, setShowCustomization] = useState(false);
    const [showStyleAdvisor, setShowStyleAdvisor] = useState(false);
    const [closestProduct, setClosestProduct] = useState<typeof products[0] | null>(null);
    const [avatarCustomization, setAvatarCustomization] = useState<AvatarCustomizationType>({
        bodyColor: '#4A90E2',
        skinTone: '#FFD1A3',
        style: 'casual'
    });

    const {
        products,
        setProducts,
        setChatMessages,
        setOtherPlayers,
        selectedProduct,
        setSelectedProduct,
        isCheckoutOpen,
        setIsCheckoutOpen,
        setCurrentScene,
    } = useGameStore();

    // Optimized notification system
    const addNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = `notif-${Date.now()}-${Math.random()}`;
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    // Player interaction handlers
    const handleWave = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`👋 You waved at ${selectedPlayer.username}!`, 'success');
        // TODO: Send wave event to other player via Supabase
        setSelectedPlayer(null);
    }, [selectedPlayer, addNotification]);

    const handleChat = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`💬 Starting chat with ${selectedPlayer.username}...`, 'info');
        setSelectedPlayer(null);
        // Open chat panel
        useGameStore.getState().setIsChatOpen(true);
    }, [selectedPlayer, addNotification]);

    const handleFollow = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`👥 Following ${selectedPlayer.username}...`, 'info');
        setSelectedPlayer(null);
    }, [selectedPlayer, addNotification]);

    // Fullscreen toggle
    const toggleFullscreen = useCallback(async () => {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Keyboard shortcut for testing player interaction
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                setSelectedPlayer({ user_id: 'test-npc', username: 'Alex (Test NPC)' });
                addNotification('Testing player interaction! 🎮', 'info');
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [addNotification]);
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        setCurrentScene('store');
        setOtherPlayers([]);
        setChatMessages([]);

        const initializeStore = async () => {
            console.log('🚀 3D Store initialization started');
            setLoadingProgress(10);

            try {
                const db = supabase as any;

                // ✅ Load user profile (supports both legacy users and new profiles table)
                setLoadingProgress(30);
                let username: string | null = null;

                const { data: usersProfile, error: usersError } = await db
                    .from('users')
                    .select('username')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!usersError && usersProfile?.username) {
                    username = usersProfile.username;
                }

                if (!username) {
                    const { data: publicProfile, error: profilesError } = await db
                        .from('profiles')
                        .select('username')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (!profilesError && publicProfile?.username) {
                        username = publicProfile.username;
                    }
                }

                if (!username) {
                    username = user.email?.split('@')[0] || 'Player';
                    addNotification('Using fallback username for this session.', 'warning');
                }
                console.log('✅ Profile loaded');
                setLoadingProgress(60);

                // ✅ Load store metadata
                setLoadingProgress(70);
                const { data: storeData, error: storeError } = await db
                    .from('stores')
                    .select('id, store_name')
                    .eq('id', storeId)
                    .maybeSingle();

                if (storeError) {
                    throw storeError;
                }

                if (!storeData) {
                    addNotification('Store not found', 'error');
                    navigate('/mall');
                    return;
                }

                setStoreTheme(buildStoreTheme(storeData.id, storeData.store_name));

                // ✅ Load store products only
                const { data: productsData, error: productError } = await db
                    .from('products')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('created_at', { ascending: false });

                if (productError) {
                    console.error('❌ Failed to load products', productError);
                    addNotification('Some products failed to load', 'warning');
                } else if (productsData) {
                    setProducts(productsData);
                    console.log('✅ Products loaded:', productsData.length);
                }
                setLoadingProgress(80);

                // 🌐 Initialize presence manager
                const presenceManager = new PresenceManager(user.id, username, storeId || 'unknown-store');
                presenceManagerRef.current = presenceManager;
                presenceManager.initialize().catch((err) =>
                    console.error('❌ Presence init failed', err)
                );

                // 💬 Initialize chat manager
                const chatManager = new ChatManager(user.id, username, storeData.id);
                chatManagerRef.current = chatManager;
                chatManager.initialize().catch((err) =>
                    console.error('❌ Chat init failed', err)
                );

                setLoadingProgress(100);
                console.log('✅ 3D Store ready');

                setTimeout(() => {
                    setLoading(false);
                    addNotification(`Welcome to ${storeTheme.name}! 🎉`, 'success');
                }, 300);
            } catch (error) {
                console.error('❌ Store initialization failed', error);
                setLoading(false);
                addNotification('Failed to initialize store', 'error');
            }
        };

        initializeStore();

        return () => {
            void presenceManagerRef.current?.cleanup();
            void chatManagerRef.current?.cleanup();
            setChatMessages([]);
            setOtherPlayers([]);
        };
    }, [user, navigate, setProducts, setChatMessages, addNotification, storeId, setCurrentScene, setOtherPlayers]);

    // Handle product click in 3D store
    const handleProductClick = useCallback((product: typeof products[0]) => {
        if (!product) {
            addNotification('Unable to load product details', 'warning');
            return;
        }

        setSelectedProduct(product as any);
        addNotification(`Viewing ${product.name}`, 'info');
    }, [setSelectedProduct, addNotification]);

    const handleCheckoutCounterClick = useCallback(() => {
        setIsCheckoutOpen(true);
        addNotification('Checkout counter selected. Review your invoice before confirming.', 'info');
    }, [setIsCheckoutOpen, addNotification]);

    // ⏳ Enhanced loading screen
    if (loading) {
        return (
            <LoadingScreen
                progress={loadingProgress}
                message="Loading 3D virtual store..."
            />
        );
    }

    // 🏬 3D Store UI
    return (
        <div className={styles.container}>
            <Canvas shadows className={styles.canvas}>
                <PerspectiveCamera makeDefault position={[0, 1.6, 12]} fov={75} />
                <Store3D
                    products={products}
                    onProductClick={handleProductClick}
                    onCheckoutCounterClick={handleCheckoutCounterClick}
                    storeTheme={storeTheme}
                    avatarCustomization={avatarCustomization}
                    presenceManager={presenceManagerRef.current}
                    onPlayerSelect={setSelectedPlayer}
                    onClosestProductChange={setClosestProduct}
                />
            </Canvas>

            {/* Product Proximity HUD */}
            <ProductProximityHUD product={closestProduct} />


            {/* Back to Mall Button */}
            <button
                className={styles.backToMallBtn}
                onClick={() => navigate('/mall')}
                title="Back to Mall"
            >
                ← Back to Mall
            </button>

            {/* Store Name Badge */}
            <div className={styles.storeBadge} style={{ background: storeTheme.gradient }}>
                <span className={styles.storeIcon}>🏪</span>
                <span className={styles.storeName}>{storeTheme.name}</span>
            </div>

            <>
                <HUD />

                <ChatPanel
                    chatManager={chatManagerRef.current}
                    inputManager={null}
                />

                <CartPanel />
            </>

            {/* Notifications */}
            <NotificationSystem notifications={notifications} />

            {/* Modals */}
            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                />
            )}

            {isCheckoutOpen && <CheckoutModal />}

            {/* AI Assistant */}
            <AIAssistant />

            <div className={styles.quickActions}>
                <button
                    className={styles.quickActionBtn}
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen (Ctrl+F)"
                >
                    {isFullscreen ? '⊡' : '⛶'}
                </button>
                <button
                    className={styles.quickActionBtn}
                    onClick={() => setShowPerformance(!showPerformance)}
                    title="Performance Monitor (Ctrl+P)"
                >
                    📊
                </button>
                <button
                    className={styles.quickActionBtn}
                    onClick={() => setShowCustomization(true)}
                    title="Customize Avatar"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
                >
                    🎨
                </button>
                {/*<button
                    className={styles.quickActionBtn}
                    onClick={() => {
                        console.log('📸 Camera button clicked, opening Style Advisor');
                        setShowStyleAdvisor(true);
                    }}
                    title="AI Style Advisor - Camera"
                    style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
                >
                    📸
                </button>*/}
            </div>

            {/* Performance Monitor (Dev tool) */}
            {showPerformance && (
                <PerformanceMonitor
                    onClose={() => setShowPerformance(false)}
                />
            )}

            {/* Player Interaction Modal */}
            {selectedPlayer && (
                <PlayerInteraction
                    player={selectedPlayer}
                    onWave={handleWave}
                    onChat={handleChat}
                    onFollow={handleFollow}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}

            {/* Avatar Customization */}
            {showCustomization && (
                <AvatarCustomization
                    currentCustomization={avatarCustomization}
                    onApply={(custom) => {
                        setAvatarCustomization(custom);
                        addNotification('Avatar customized! 🎨', 'success');
                    }}
                    onClose={() => setShowCustomization(false)}
                />
            )}

            {/* Camera Style Advisor */}
            {showStyleAdvisor && (
                <CameraStyleAdvisor onClose={() => setShowStyleAdvisor(false)} />
            )}

            <div className={styles.instructions3D}>
                <p>🎮 WASD - Move | Mouse - Look | Click - Interact</p>
            </div>
        </div>
    );
};
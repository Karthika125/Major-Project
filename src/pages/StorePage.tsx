//StorePage.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { PresenceManager, STORE_ROOM_CAPACITY } from '../lib/realtime/PresenceManager';
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
import { SmartRecommendationPanel } from '../components/SmartRecommendationPanel';
import { ProductIdentifier } from '../components/ProductIdentifier';
import { StoreNpcHelper } from '../components/StoreNpcHelper';
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

    const { user } = useAuth();
    const userId = user?.id;
    const userEmail = user?.email;
    const navigate = useNavigate();
    const { storeId } = useParams<{ storeId: string }>();
    const [searchParams] = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [entryBlockedMessage, setEntryBlockedMessage] = useState<string | null>(null);
    const [blockedOccupancy, setBlockedOccupancy] = useState<number>(STORE_ROOM_CAPACITY);
    const [storeTheme, setStoreTheme] = useState<StoreTheme>(() =>
        buildStoreTheme(storeId || 'store', 'Store')
    );
    const [showPerformance, setShowPerformance] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<{ user_id: string; username: string } | null>(null);
    const [showCustomization, setShowCustomization] = useState(false);
    const [showStyleAdvisor, setShowStyleAdvisor] = useState(false);
    const [showProductIdentifier, setShowProductIdentifier] = useState(false);
    const [showNpcHelper, setShowNpcHelper] = useState(false);
    const scannedItem = (searchParams.get('scanItem') || '').trim();
    const [closestProduct, setClosestProduct] = useState<typeof products[0] | null>(null);
    const [avatarCustomization, setAvatarCustomization] = useState<AvatarCustomizationType>({
        bodyColor: '#4A90E2',
        skinTone: '#FFD1A3',
        style: 'casual'
    });

    const {
        products,
        otherPlayers,
        setProducts,
        setChatMessages,
        setOtherPlayers,
        selectedProduct,
        setSelectedProduct,
        isCheckoutOpen,
        setIsCheckoutOpen,
        setCurrentScene,
    } = useGameStore();

    const usersInside = otherPlayers.length + 1;

    // Optimized notification system
    const addNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = `notif-${Date.now()}-${Math.random()}`;
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    useEffect(() => {
        const scannedItem = (searchParams.get('scanItem') || '').trim();
        if (!scannedItem) {
            return;
        }

        addNotification(`Hope you find the ${scannedItem} you are looking for.`, 'success');
    }, [searchParams, addNotification]);

    // Player interaction handlers
    const handleWave = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`👋 You waved at ${selectedPlayer.username}!`, 'success');
        void presenceManagerRef.current?.sendPlayerInteraction('wave', selectedPlayer.user_id);
        setSelectedPlayer(null);
    }, [selectedPlayer, addNotification]);

    const handleChat = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`💬 Starting chat with ${selectedPlayer.username}...`, 'info');
        void presenceManagerRef.current?.sendPlayerInteraction('chat', selectedPlayer.user_id);
        setSelectedPlayer(null);
        // Open chat panel
        useGameStore.getState().setIsChatOpen(true);
    }, [selectedPlayer, addNotification]);

    const handleFollow = useCallback(() => {
        if (!selectedPlayer) return;
        addNotification(`👥 Following ${selectedPlayer.username}...`, 'info');
        void presenceManagerRef.current?.sendPlayerInteraction('follow', selectedPlayer.user_id);
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

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }

        if (!storeId) {
            navigate('/mall');
            return;
        }

        let isDisposed = false;

        setCurrentScene('store');
        setOtherPlayers([]);
        setChatMessages([]);
        setEntryBlockedMessage(null);
        setBlockedOccupancy(STORE_ROOM_CAPACITY);

        const initializeStore = async () => {
            console.log('🚀 3D Store initialization started');
            setLoadingProgress(10);

            try {
                const db = supabase as any;

                // ✅ Load user profile (supports both legacy users and new profiles table)
                setLoadingProgress(30);
                let username: string | null = null;
            let avatarUrl: string | null = null;

                const { data: usersProfile, error: usersError } = await db
                    .from('users')
                    .select('username')
                    .eq('id', userId)
                    .maybeSingle();

                if (!usersError && usersProfile?.username) {
                    username = usersProfile.username;
                }

                if (!username) {
                    const { data: publicProfile, error: profilesError } = await db
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', userId)
                        .maybeSingle();

                    if (!profilesError && publicProfile?.username) {
                        username = publicProfile.username;
                        avatarUrl = publicProfile.avatar_url || null;
                    }
                }

                if (!username) {
                    username = userEmail?.split('@')[0] || 'Player';
                    addNotification('Using fallback username for this session.', 'warning');
                }
                console.log('✅ Profile loaded');
                setLoadingProgress(60);

                // ✅ Load store metadata
                setLoadingProgress(70);
                const { data: storeData, error: storeError } = await db
                    .from('stores')
                    .select('id, store_name, owner_id')
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

                if (isDisposed) {
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

                if (isDisposed) {
                    return;
                }

                const existingManager = presenceManagerRef.current;
                if (existingManager) {
                    presenceManagerRef.current = null;
                    await existingManager.cleanup();
                }

                if (isDisposed) {
                    return;
                }

                // 🌐 Initialize unified store room manager (presence + movement + chat + interactions)
                const presenceManager = new PresenceManager(userId, username, storeData.id, {
                    isStoreOwner: storeData.owner_id === userId,
                    avatarUrl,
                });
                presenceManagerRef.current = presenceManager;
                await presenceManager.initialize();

                if (isDisposed) {
                    if (presenceManagerRef.current === presenceManager) {
                        presenceManagerRef.current = null;
                    }
                    await presenceManager.cleanup();
                    return;
                }

                setLoadingProgress(100);
                console.log('✅ 3D Store ready');

                setTimeout(() => {
                    if (isDisposed) {
                        return;
                    }
                    setLoading(false);
                    addNotification(`Welcome to ${storeData.store_name}! 🎉`, 'success');
                }, 300);
            } catch (error: any) {
                if (isDisposed) {
                    return;
                }

                console.error('❌ Store initialization failed', error);

                if ((error?.message || '').toLowerCase().includes('store full')) {
                    const occupancyValue = Number(error?.occupancy);
                    if (Number.isFinite(occupancyValue) && occupancyValue > 0) {
                        setBlockedOccupancy(Math.min(occupancyValue, STORE_ROOM_CAPACITY));
                    } else {
                        setBlockedOccupancy(STORE_ROOM_CAPACITY);
                    }
                    setEntryBlockedMessage('Store Full');
                    setLoading(false);
                    addNotification('Store Full', 'warning');
                    return;
                }

                setLoading(false);
                addNotification('Failed to initialize store', 'error');
            }
        };

        void initializeStore();

        return () => {
            isDisposed = true;
            const manager = presenceManagerRef.current;
            presenceManagerRef.current = null;
            if (manager) {
                void manager.cleanup();
            }
            setChatMessages([]);
            setOtherPlayers([]);
        };
    }, [userId, userEmail, navigate, setProducts, setChatMessages, addNotification, storeId, setCurrentScene, setOtherPlayers]);

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

    if (entryBlockedMessage) {
        return (
            <div className={styles.blockedState}>
                <div className={styles.blockedCard}>
                    <h2>{entryBlockedMessage}</h2>
                    <p>This store has reached the maximum of {STORE_ROOM_CAPACITY} active shoppers.</p>
                    <p className={styles.blockedOccupancy}>Users inside: {blockedOccupancy} / {STORE_ROOM_CAPACITY}</p>
                    <button
                        className={styles.blockedButton}
                        onClick={() => navigate('/mall')}
                    >
                        ← Back to Mall
                    </button>
                </div>
            </div>
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
                    onNpcInteract={() => setShowNpcHelper(true)}
                    storeTheme={storeTheme}
                    avatarCustomization={avatarCustomization}
                    presenceManager={presenceManagerRef.current}
                    onPlayerSelect={setSelectedPlayer}
                    onClosestProductChange={setClosestProduct}
                />
            </Canvas>

            {/* Centre-screen crosshair */}
            <div className={styles.centerCrosshair} aria-hidden="true" />

            {/* Product Proximity HUD */}
            <ProductProximityHUD product={closestProduct} />

            {/* Smart Recommendation Panel */}
            <SmartRecommendationPanel
                storeId={storeId}
                scannedItem={scannedItem}
            />


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

            <div className={styles.occupancyBadge}>
                Users inside: {usersInside} / {STORE_ROOM_CAPACITY}
            </div>

            <>
                <HUD />

                <ChatPanel
                    chatManager={presenceManagerRef.current}
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

            {/* NPC Shop Guide */}
            <StoreNpcHelper
                storeName={storeTheme.name}
                products={products as any}
                open={showNpcHelper}
                onOpenChange={setShowNpcHelper}
                showDockButton={false}
            />

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
                <button
                    className={styles.quickActionBtn}
                    onClick={() => setShowProductIdentifier(true)}
                    title="Scan Product with Camera"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                    📸
                </button>
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

            {/* Product Scanner */}
            {showProductIdentifier && (
                <ProductIdentifier onClose={() => setShowProductIdentifier(false)} />
            )}

            <div className={styles.instructions3D}>
                <p>🎮 WASD - Move | Mouse - Look | Click / E - Interact</p>
            </div>
        </div>
    );
};
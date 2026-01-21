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
import { RecommendationPanel } from '../components/RecommendationPanel';
import { PlayerInteraction } from '../components/PlayerInteraction';
import { AvatarCustomization, AvatarCustomization as AvatarCustomizationType } from '../components/AvatarCustomization';
import { NotificationSystem } from '@/components/NotificationSystem';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { CameraStyleAdvisor } from '../components/CameraStyleAdvisor';
import { EntranceScene } from '../components/EntranceScene';
import { Store3D } from '../components/Store3D';
import { ProductProximityHUD } from '../components/ProductProximityHUD';
import styles from './StorePage.module.css';

interface StoreTheme {
    name: string;
    gradient: string;
    accentColor: string;
}

const STORE_THEMES: Record<string, StoreTheme> = {
    'hm': {
        name: 'H&M',
        gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
        accentColor: '#FF6B6B'
    },
    'lulu': {
        name: 'LULU Hypermarket',
        gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
        accentColor: '#4ECDC4'
    },
    'zara': {
        name: 'ZARA',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        accentColor: '#667eea'
    },
    'sephora': {
        name: 'Sephora',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        accentColor: '#f093fb'
    },
    'nike': {
        name: 'Nike Store',
        gradient: 'linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 90%, #2BFF88 100%)',
        accentColor: '#FA8BFF'
    },
    'ikea': {
        name: 'IKEA',
        gradient: 'linear-gradient(135deg, #FEC163 0%, #DE4313 100%)',
        accentColor: '#FEC163'
    }
};

export const StorePage: React.FC = () => {
    const presenceManagerRef = useRef<PresenceManager | null>(null);
    const chatManagerRef = useRef<ChatManager | null>(null);

    const { user } = useAuth();
    const navigate = useNavigate();
    const { storeId } = useParams<{ storeId: string }>();
    const storeTheme = STORE_THEMES[storeId || 'hm'] || STORE_THEMES['hm'];

    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
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
        selectedProduct,
        setSelectedProduct,
        setIsCheckoutOpen,
        isCheckoutOpen,
        currentScene,
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

        const initializeStore = async () => {
            console.log('🚀 3D Store initialization started');
            setLoadingProgress(10);

            try {
                // ✅ Load user profile
                setLoadingProgress(30);
                const { data: profiles, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id);

                if (profileError || !profiles || profiles.length === 0) {
                    console.error('❌ User profile missing', profileError);
                    setLoading(false);
                    addNotification('Failed to load user profile', 'error');
                    navigate('/login');
                    return;
                }

                const profile = profiles[0];
                console.log('✅ Profile loaded');
                setLoadingProgress(60);

                // ✅ Load products
                const { data: productsData, error: productError } = await supabase
                    .from('products')
                    .select('*');

                if (productError) {
                    console.error('❌ Failed to load products', productError);
                    addNotification('Some products failed to load', 'warning');
                } else if (productsData) {
                    setProducts(productsData);
                    console.log('✅ Products loaded:', productsData.length);
                }
                setLoadingProgress(80);

                // 🌐 Initialize presence manager
                const presenceManager = new PresenceManager(user.id, profile.username);
                presenceManagerRef.current = presenceManager;
                presenceManager.initialize().catch((err) =>
                    console.error('❌ Presence init failed', err)
                );

                // 💬 Initialize chat manager
                const chatManager = new ChatManager(user.id, profile.username);
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
            presenceManagerRef.current?.cleanup();
            chatManagerRef.current?.cleanup();
        };
    }, [user, navigate, setProducts, addNotification, storeTheme.name]);

    // ⏳ Enhanced loading screen
    if (loading) {
        return (
            <LoadingScreen
                progress={loadingProgress}
                message="Loading 3D virtual store..."
            />
        );
    }

    // Handle entrance completion
    const handleEntranceComplete = () => {
        setCurrentScene('store');
        addNotification('Welcome to the store! Use WASD to move and mouse to look around.', 'info');
    };

    // Handle product click in 3D store
    const handleProductClick = (product: typeof products[0]) => {
        setSelectedProduct(product);
        addNotification(`Viewing ${product.name}`, 'info');
    };

    // 🏬 3D Store UI
    return (
        <div className={styles.container}>
            {/* 3D Scene - Entrance or Store */}
            {currentScene === 'entrance' ? (
                <EntranceScene
                    storeName={storeTheme.name}
                    storeTheme={storeTheme}
                    onComplete={handleEntranceComplete}
                />
            ) : (
                <Canvas shadows className={styles.canvas}>
                    <PerspectiveCamera makeDefault position={[0, 1.6, 12]} fov={75} />
                    <Store3D
                        products={products}
                        onProductClick={handleProductClick}
                        storeTheme={storeTheme}
                        avatarCustomization={avatarCustomization}
                        presenceManager={presenceManagerRef.current}
                        onPlayerSelect={setSelectedPlayer}
                        onClosestProductChange={setClosestProduct}
                    />
                </Canvas>
            )}

            {/* Product Proximity HUD */}
            {currentScene === 'store' && <ProductProximityHUD product={closestProduct} />}


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

            {/* Core UI Components - Only show in store scene */}
            {currentScene === 'store' && (
                <>
                    <HUD />

                    <ChatPanel
                        chatManager={chatManagerRef.current}
                        inputManager={null}
                    />

                    <CartPanel />
                    <RecommendationPanel />
                </>
            )}

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

            {/* Quick Actions Bar - Only in store scene */}
            {currentScene === 'store' && (
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
                        onClick={() => {
                            console.log('📸 Camera button clicked, opening Style Advisor');
                            setShowStyleAdvisor(true);
                        }}
                        title="AI Style Advisor - Camera"
                        style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
                    >
                        📸
                    </button>
                </div>
            )}

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

            {/* Instructions overlay for 3D store */}
            {currentScene === 'store' && (
                <div className={styles.instructions3D}>
                    <p>🎮 WASD - Move | Mouse - Look | Click - Interact</p>
                </div>
            )}
        </div>
    );
};
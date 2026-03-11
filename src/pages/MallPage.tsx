import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { useGameStore } from '../lib/store/gameStore';
import styles from './MallPage.module.css';

interface StoreCard {
    id: string;
    name: string;
    description: string;
    icon: string;
    gradient: string;
    category: string;
    ownerId: string;
}

interface StoreRow {
    id: string;
    owner_id: string;
    store_name: string;
    description: string | null;
}

const STORE_ICONS = ['🏬', '🛍️', '👗', '🛒', '🎮', '👟', '💄', '🧢'];
const STORE_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
    'linear-gradient(135deg, #FEC163 0%, #DE4313 100%)',
    'linear-gradient(135deg, #9EC6F3 0%, #7BA8D9 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 90%, #2BFF88 100%)',
];

const getSeed = (value: string, modulo: number): number => {
    return value
        .split('')
        .reduce((acc, char) => (acc + char.charCodeAt(0)) % modulo, 0);
};

const mapStoreToCard = (store: StoreRow): StoreCard => {
    const iconSeed = getSeed(store.id, STORE_ICONS.length);
    const gradientSeed = getSeed(store.store_name || store.id, STORE_GRADIENTS.length);

    return {
        id: store.id,
        name: store.store_name,
        description: store.description || 'Step into this virtual store and explore products in 3D.',
        icon: STORE_ICONS[iconSeed],
        gradient: STORE_GRADIENTS[gradientSeed],
        category: 'Store',
        ownerId: store.owner_id,
    };
};

export const MallPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const setCurrentScene = useGameStore((state) => state.setCurrentScene);
    const [stores, setStores] = useState<StoreCard[]>([]);
    const [storesLoading, setStoresLoading] = useState(true);
    const [storesError, setStoresError] = useState('');

    useEffect(() => {
        if (!user) {
            return;
        }

        const loadStores = async () => {
            setStoresLoading(true);
            setStoresError('');

            try {
                const db = supabase as any;
                const { data, error } = await db
                    .from('stores')
                    .select('id, owner_id, store_name, description')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setStores((data || []).map(mapStoreToCard));
            } catch (error: any) {
                console.error('Failed to load stores:', error);
                setStoresError(error?.message || 'Failed to load stores.');
                setStores([]);
            } finally {
                setStoresLoading(false);
            }
        };

        void loadStores();
    }, [user]);

    const handleStoreClick = (storeId: string) => {
        setCurrentScene('store');
        navigate(`/store/${storeId}`);
    };

    const handleCreateStore = () => {
        navigate('/stores/create');
    };

    const handleManageStore = (id: string) => {
        navigate(`/stores/${id}/dashboard`);
    };

    const handleProfile = () => {
        navigate('/profile');
    };

    const handleLogout = async () => {
        navigate('/login');
    };

    if (!user) {
        navigate('/login');
        return null;
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>🏬</span>
                        <h1>Store Home</h1>
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.welcome}>Welcome, {user.email?.split('@')[0]}!</span>
                        <button className={styles.profileBtn} onClick={handleProfile}>
                            My Profile
                        </button>
                        <button className={styles.createStoreBtn} onClick={handleCreateStore}>
                            + Create Store
                        </button>
                        <button className={styles.logoutBtn} onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h2 className={styles.heroTitle}>
                        Available Stores
                    </h2>
                    <p className={styles.heroSubtitle}>
                        Pick any store below and enter directly.
                    </p>
                </div>
            </section>

            {/* Store Grid */}
            <main className={styles.main}>
                <div className={styles.storeGrid}>
                    {storesLoading ? (
                        <div className={styles.statusMessage}>Loading stores...</div>
                    ) : storesError ? (
                        <div className={styles.statusMessage}>{storesError}</div>
                    ) : stores.length === 0 ? (
                        <div className={styles.statusMessage}>No stores available yet. Create your first store.</div>
                    ) : (
                        stores.map((store) => (
                            <article key={store.id} className={styles.storeCard}>
                                <div
                                    className={styles.storeCardOverlay}
                                    style={{
                                        background: store.gradient,
                                        opacity: 0.15,
                                    }}
                                />
                                <div className={styles.storeCardContent}>
                                    <div>
                                        <div className={styles.storeIcon}>{store.icon}</div>
                                        <h3 className={styles.storeName}>{store.name}</h3>
                                        <p className={styles.storeDescription}>{store.description}</p>
                                    </div>

                                    <div className={styles.storeActions}>
                                        <button
                                            className={styles.enterBtn}
                                            onClick={() => handleStoreClick(store.id)}
                                        >
                                            Enter Store
                                        </button>
                                        {user.id === store.ownerId && (
                                            <button
                                                className={styles.manageBtn}
                                                onClick={() => handleManageStore(store.id)}
                                            >
                                                Manage Store
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <p>© 2026 Virtual Store - Choose a store and start shopping</p>
            </footer>
        </div>
    );
};

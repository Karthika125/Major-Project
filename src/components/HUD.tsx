import React, { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth/AuthProvider';
import { useGameStore } from '../lib/store/gameStore';
import styles from './HUD.module.css';

export const HUD: React.FC = () => {
    const { signOut } = useAuth();
    const { currentUser, coins } = useGameStore();
    const prevCoinsRef = useRef(coins);
    const coinRef = useRef<HTMLDivElement>(null);

    // Animate coin counter when coins change
    useEffect(() => {
        if (coins !== prevCoinsRef.current && coinRef.current) {
            coinRef.current.classList.remove(styles.coinBounce);
            void coinRef.current.offsetWidth;
            coinRef.current.classList.add(styles.coinBounce);
        }
        prevCoinsRef.current = coins;
    }, [coins]);

    return (
        <div className={styles.hud}>
            <div className={styles.topLeft}>
                <div className={styles.userInfo}>
                    <span className={styles.username}>👤 {currentUser?.username || 'Player'}</span>
                    <button className={styles.logoutBtn} onClick={signOut}>
                        Logout
                    </button>
                </div>

                {/* Coin counter — under user info, left side */}
                <div className={styles.coinBadge} ref={coinRef}>
                    <span className={styles.coinIcon}>🪙</span>
                    <div className={styles.coinInfo}>
                        <span className={styles.coinLabel}>COINS</span>
                        <span className={styles.coinValue}>{coins.toLocaleString()}</span>
                    </div>
                </div>

                <div className={styles.controls}>
                    <div className={styles.controlHint}>
                        <kbd>WASD</kbd> or <kbd>Arrows</kbd> to move
                    </div>
                    <div className={styles.controlHint}>
                        <kbd>Click</kbd> products to view
                    </div>
                </div>
            </div>

            <div className={styles.topCenter}>
                <h1 className={styles.storeTitle}>🏬 Virtual Shopping Store</h1>
            </div>

            <div className={styles.bottomCenter}>
                {/*<button
                    className={styles.aiButton}
                    onClick={() => setIsAIAssistantOpen(true)}
                >
                    🤖 AI Shopping Assistant
                </button>*/}
            </div>
        </div>
    );
};

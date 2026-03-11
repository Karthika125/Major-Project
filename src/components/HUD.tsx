import React from 'react';
import { useAuth } from '../lib/auth/AuthProvider';
import { useGameStore } from '../lib/store/gameStore';
import styles from './HUD.module.css';

export const HUD: React.FC = () => {
    const { user, signOut } = useAuth();
    const { currentUser, setIsAIAssistantOpen } = useGameStore();

    return (
        <div className={styles.hud}>
            <div className={styles.topLeft}>
                <div className={styles.userInfo}>
                    <span className={styles.username}>👤 {currentUser?.username || 'Player'}</span>
                    <button className={styles.logoutBtn} onClick={signOut}>
                        Logout
                    </button>
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

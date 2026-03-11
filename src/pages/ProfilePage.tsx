import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { OrderHistory } from '../components/OrderHistory';
import styles from './ProfilePage.module.css';

interface ProfileSummary {
    username: string;
}

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<ProfileSummary | null>(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const loadProfile = async () => {
            try {
                const db = supabase as any;

                const { data: usersProfile, error: usersError } = await db
                    .from('users')
                    .select('username')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!usersError && usersProfile?.username) {
                    setProfile({ username: usersProfile.username });
                    return;
                }

                const { data: publicProfile, error: profilesError } = await db
                    .from('profiles')
                    .select('username')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!profilesError && publicProfile?.username) {
                    setProfile({ username: publicProfile.username });
                    return;
                }

                setProfile(null);
            } catch (error) {
                console.error('Failed to load profile details:', error);
                setProfile(null);
            }
        };

        void loadProfile();
    }, [user, navigate]);

    if (!user) {
        return null;
    }

    const fallbackName = user.email?.split('@')[0] || 'Player';

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>My Profile</h1>
                    <p className={styles.subtitle}>Account details and purchase history</p>
                </div>

                <div className={styles.actions}>
                    <button className={styles.secondaryButton} onClick={() => navigate('/mall')}>
                        Back to Mall
                    </button>
                    <button
                        className={styles.secondaryButton}
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                    >
                        Logout
                    </button>
                </div>
            </header>

            <section className={styles.profileCard}>
                <p><strong>Username:</strong> {profile?.username || fallbackName}</p>
                <p><strong>Email:</strong> {user.email || 'N/A'}</p>
                <p><strong>User ID:</strong> {user.id}</p>
            </section>

            <OrderHistory />
        </div>
    );
};

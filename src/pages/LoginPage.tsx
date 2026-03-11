import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import styles from './Auth.module.css';

export const LoginPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                const trimmedUsername = username.trim();
                if (!trimmedUsername) {
                    throw new Error('Username is required');
                }

                // Sign up
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/`,
                        data: {
                            username: trimmedUsername,
                        },
                    },
                });

                if (signUpError) throw signUpError;
                if (!data.user) throw new Error('No user returned');

                if (data.session) {
                    // Create user profile for legacy schema compatibility.
                    // Newer schema can auto-create profiles via auth trigger.
                    const { error: usersProfileError } = await supabase
                        .from('users')
                        .upsert(
                            {
                                id: data.user.id,
                                username: trimmedUsername,
                                avatar_type: 'default',
                            },
                            { onConflict: 'id' }
                        );

                    if (
                        usersProfileError &&
                        usersProfileError.code !== '23505' &&
                        usersProfileError.code !== '42P01'
                    ) {
                        throw usersProfileError;
                    }

                    const { error: publicProfileError } = await (supabase as any)
                        .from('profiles')
                        .upsert(
                            {
                                id: data.user.id,
                                username: trimmedUsername,
                            },
                            { onConflict: 'id' }
                        );

                    if (
                        publicProfileError &&
                        publicProfileError.code !== '23505' &&
                        publicProfileError.code !== '42P01'
                    ) {
                        throw publicProfileError;
                    }

                    navigate('/mall');
                } else {
                    setError('Signup successful. Please check your email to confirm your account.');
                }
            } else {
                // Sign in
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInError) throw signInError;

                navigate('/mall');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>🛍️ Virtual Shopping Store</h1>
                <p className={styles.subtitle}>
                    Step into a 2D virtual store, shop with others in real-time!
                </p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {isSignUp && (
                        <div className={styles.field}>
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="Choose a username"
                            />
                        </div>
                    )}

                    <div className={styles.field}>
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="your@email.com"
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                    </button>

                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                        }}
                    >
                        {isSignUp
                            ? 'Already have an account? Sign In'
                            : "Don't have an account? Sign Up"}
                    </button>
                </form>
            </div>
        </div>
    );
};

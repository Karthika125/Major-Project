import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import styles from './CreateStorePage.module.css';

export const CreateStorePage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [storeName, setStoreName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

    const handleCreateStore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError('');

        const trimmedName = storeName.trim();
        if (!trimmedName) {
            setError('Store name is required.');
            return;
        }

        setSubmitting(true);

        try {
            const db = supabase as any;
            const { data, error: createError } = await db
                .from('stores')
                .insert({
                    owner_id: user.id,
                    store_name: trimmedName,
                    description: description.trim() || null,
                })
                .select('id')
                .single();

            if (createError) throw createError;
            if (!data?.id) throw new Error('Store was created but id was not returned.');

            navigate(`/stores/${data.id}/dashboard`);
        } catch (err: any) {
            console.error('Failed to create store:', err);
            setError(err?.message || 'Failed to create store. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Create Your Store</h1>
                <p className={styles.subtitle}>Set up a new storefront and start adding products.</p>

                <form onSubmit={handleCreateStore} className={styles.form}>
                    <div className={styles.field}>
                        <label htmlFor="storeName">Store Name *</label>
                        <input
                            id="storeName"
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="e.g. Jerin Fashion Hub"
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            placeholder="Tell shoppers what your store offers"
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => navigate('/mall')}
                            disabled={submitting}
                        >
                            Back to Mall
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={submitting}>
                            {submitting ? 'Creating...' : 'Create Store'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

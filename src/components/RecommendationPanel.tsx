import React, { useEffect } from 'react';
import { useGameStore } from '../lib/store/gameStore';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/auth/AuthProvider';
import styles from './RecommendationPanel.module.css';

export const RecommendationPanel: React.FC = () => {
    const { user } = useAuth();
    const { recommendations, setRecommendations, products, setSelectedProduct } = useGameStore();

    useEffect(() => {
        if (!user || products.length === 0) return;

        const fetchRecommendations = async () => {
            try {
                // Get user's recent activity
                const { data: activity } = await supabase
                    .from('user_activity')
                    .select('product_id')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!activity || activity.length === 0) {
                    // No activity yet, show random products
                    const random = products.sort(() => 0.5 - Math.random()).slice(0, 3);
                    setRecommendations(random);
                    return;
                }

                // Get viewed product IDs
                const viewedIds = activity.map((a) => a.product_id).filter(Boolean);

                // Simple recommendation: products from same categories
                const viewedProducts = products.filter((p) => viewedIds.includes(p.id));
                const categories = [...new Set(viewedProducts.map((p) => p.category))];

                const recommended = products
                    .filter((p) => !viewedIds.includes(p.id) && categories.includes(p.category))
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3);

                setRecommendations(recommended);
            } catch (error) {
                console.error('Error fetching recommendations:', error);
            }
        };

        fetchRecommendations();
        const interval = setInterval(fetchRecommendations, 30000); // Update every 30 seconds

        return () => clearInterval(interval);
    }, [user, products, setRecommendations]);

    if (recommendations.length === 0) return null;

    return (
        <div className={styles.panel}>
            <h4>🎯 Recommended for You</h4>
            <div className={styles.items}>
                {recommendations.map((product) => (
                    <div
                        key={product.id}
                        className={styles.item}
                        onClick={() => setSelectedProduct(product)}
                    >
                        <div className={styles.icon}>📦</div>
                        <div className={styles.info}>
                            <div className={styles.name}>{product.name}</div>
                            <div className={styles.price}>₹{product.price}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

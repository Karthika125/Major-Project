import React from 'react';
import { useGameStore } from '../lib/store/gameStore';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/auth/AuthProvider';
import type { Database } from '../lib/supabase/types';
import styles from './ProductModal.module.css';

type Product = Database['public']['Tables']['products']['Row'];

interface Props {
    product: Product;
    onClose: () => void;
}

export const ProductModal: React.FC<Props> = ({ product, onClose }) => {
    const { user } = useAuth();
    const { addToCart } = useGameStore();
    const [adding, setAdding] = React.useState(false);

    const handleAddToCart = async () => {
        if (!user) return;

        setAdding(true);
        try {
            // Check if item already exists
            const { data: existing } = await supabase
                .from('cart_items')
                .select('*')
                .eq('user_id', user.id)
                .eq('product_id', product.id)
                .single();

            if (existing) {
                // Update quantity
                const { data, error } = await supabase
                    .from('cart_items')
                    .update({ quantity: existing.quantity + 1 })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;

                // Update local state
                addToCart({ ...data, product } as any);
            } else {
                // Insert new item
                const { data, error } = await supabase
                    .from('cart_items')
                    .insert({
                        user_id: user.id,
                        product_id: product.id,
                        quantity: 1,
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Add to local state with product details
                addToCart({ ...data, product } as any);
            }

            // Track activity
            await supabase.from('user_activity').insert({
                user_id: user.id,
                product_id: product.id,
                action_type: 'add_to_cart',
            });

            console.log('✅ Added to cart successfully!');
            onClose();
        } catch (error) {
            console.error('❌ Error adding to cart:', error);
            alert('Failed to add to cart. Please try again.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    ✕
                </button>

                <div className={styles.content}>
                    <div className={styles.imageContainer}>
                        {product.image_url ? (
                            <img
                                src={product.image_url}
                                alt={product.name}
                                className={styles.productImage}
                            />
                        ) : (
                            <div className={styles.imagePlaceholder}>
                                📦
                            </div>
                        )}
                    </div>

                    <div className={styles.details}>
                        <h2 className={styles.name}>{product.name}</h2>
                        <p className={styles.category}>{product.category}</p>
                        <p className={styles.description}>
                            {product.description || 'No description available'}
                        </p>
                        <div className={styles.price}>${product.price}</div>

                        <button
                            className={styles.addButton}
                            onClick={handleAddToCart}
                            disabled={adding}
                        >
                            {adding ? 'Adding...' : '🛒 Add to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

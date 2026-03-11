import React from 'react';
import { useGameStore } from '../lib/store/gameStore';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/auth/AuthProvider';
import { addProductToStoreCart } from '../lib/supabase/cartService';
import type { Database } from '../lib/supabase/types';
import styles from './ProductModal.module.css';

type Product = Database['public']['Tables']['products']['Row'] & {
    stock?: number | null;
    store_id?: string;
};

interface Props {
    product: Product;
    onClose: () => void;
}

export const ProductModal: React.FC<Props> = ({ product, onClose }) => {
    const { user } = useAuth();
    const { setCartItems, setIsCartOpen } = useGameStore();
    const [adding, setAdding] = React.useState(false);

    const stock = typeof product.stock === 'number' ? product.stock : null;
    const isOutOfStock = stock !== null && stock <= 0;

    const handleAddToCart = async () => {
        if (!user || isOutOfStock) return;

        setAdding(true);
        try {
            const { items } = await addProductToStoreCart({
                userId: user.id,
                productId: product.id,
                storeId: product.store_id,
                quantity: 1,
            });

            setCartItems(items as any);
            setIsCartOpen(true);

            // Track activity
            const db = supabase as any;
            await db.from('user_activity').insert({
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
                        <div className={styles.price}>₹{product.price}</div>
                        <p className={styles.stock}>
                            Stock: {stock === null ? 'N/A' : stock}
                        </p>

                        <button
                            className={styles.addButton}
                            onClick={handleAddToCart}
                            disabled={adding || isOutOfStock}
                        >
                            {isOutOfStock ? 'Out of Stock' : adding ? 'Adding...' : '🛒 Add to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../lib/store/gameStore';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/auth/AuthProvider';
import {
    fetchStoreCartItems,
    removeStoreCartItem,
    updateStoreCartItemQuantity,
} from '../lib/supabase/cartService';
import styles from './CartPanel.module.css';

export const CartPanel: React.FC = () => {
    const { user } = useAuth();
    const { storeId } = useParams<{ storeId: string }>();
    const { cartItems, setCartItems, isCartOpen, setIsCartOpen, setIsCheckoutOpen } = useGameStore();
    const [activeCartId, setActiveCartId] = useState<string | null>(null);

    const loadCartItems = useCallback(async () => {
        if (!user || !storeId) {
            setActiveCartId(null);
            setCartItems([] as any);
            return;
        }

        try {
            const { cartId, items } = await fetchStoreCartItems(user.id, storeId);
            setActiveCartId(cartId);
            setCartItems(items as any);
        } catch (error) {
            console.error('Error loading cart items:', error);
            setActiveCartId(null);
            setCartItems([] as any);
        }
    }, [user, storeId, setCartItems]);

    useEffect(() => {
        void loadCartItems();
    }, [loadCartItems]);

    useEffect(() => {
        if (!activeCartId) return;

        const channel = supabase
            .channel(`cart-sync-${activeCartId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cart_items',
                    filter: `cart_id=eq.${activeCartId}`,
                },
                () => {
                    void loadCartItems();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [activeCartId, loadCartItems]);

    const total = useMemo(
        () => cartItems.reduce((sum, item: any) => sum + (item.product?.price || 0) * item.quantity, 0),
        [cartItems]
    );

    const totalItemCount = useMemo(
        () => cartItems.reduce((sum, item: any) => sum + item.quantity, 0),
        [cartItems]
    );

    const handleRemove = async (itemId: string) => {
        try {
            await removeStoreCartItem(itemId);
            await loadCartItems();
        } catch (error) {
            console.error('Error removing item:', error);
        }
    };

    const handleQuantityChange = async (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) return;

        try {
            await updateStoreCartItemQuantity(itemId, newQuantity);
            await loadCartItems();
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    };

    return (
        <>
            <button
                className={styles.cartButton}
                onClick={() => setIsCartOpen(!isCartOpen)}
            >
                🛒 {totalItemCount > 0 && <span className={styles.badge}>{totalItemCount}</span>}
            </button>

            {isCartOpen && (
                <div className={styles.panel}>
                    <div className={styles.header}>
                        <h3>Shopping Cart</h3>
                        <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)}>
                            ✕
                        </button>
                    </div>

                    <div className={styles.items}>
                        {cartItems.length === 0 ? (
                            <div className={styles.empty}>
                                <p>Your cart is empty</p>
                                <p className={styles.emptyHint}>Walk around and click on products to add them!</p>
                            </div>
                        ) : (
                            cartItems.map((item: any) => (
                                <div key={item.id} className={styles.item}>
                                    <div className={styles.imageWrap}>
                                        {item.product?.image_url ? (
                                            <img
                                                src={item.product.image_url}
                                                alt={item.product.name}
                                                className={styles.itemImage}
                                            />
                                        ) : (
                                            <div className={styles.itemImagePlaceholder}>📦</div>
                                        )}
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.itemName}>{item.product.name}</div>
                                        <div className={styles.itemPrice}>₹{item.product.price}</div>
                                    </div>

                                    <div className={styles.itemActions}>
                                        <div className={styles.quantity}>
                                            <button
                                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                                disabled={item.quantity <= 1}
                                            >
                                                −
                                            </button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>
                                                +
                                            </button>
                                        </div>
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => handleRemove(item.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {cartItems.length > 0 && (
                        <div className={styles.footer}>
                            <div className={styles.total}>
                                <span>Total:</span>
                                <span className={styles.totalAmount}>₹{total.toFixed(2)}</span>
                            </div>
                            <button
                                className={styles.checkoutButton}
                                onClick={() => setIsCheckoutOpen(true)}
                            >
                                Checkout
                            </button>
                            <p className={styles.checkoutHint}>
                                💡 Walk to the checkout counter to complete your purchase!
                            </p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

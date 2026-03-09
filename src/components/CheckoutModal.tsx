import React from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../lib/store/gameStore';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import {
    calculateCartTotal,
    checkoutStoreCart,
    fetchStoreCartItems,
    type StoreCartItem,
} from '../lib/supabase/cartService';
import styles from './CheckoutModal.module.css';

export const CheckoutModal: React.FC = () => {
    const { user } = useAuth();
    const { storeId } = useParams<{ storeId: string }>();
    const { setCartItems, setIsCheckoutOpen, recommendations, setProducts } = useGameStore();
    const [cartItems, setCheckoutItems] = React.useState<StoreCartItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [processing, setProcessing] = React.useState(false);
    const [completed, setCompleted] = React.useState(false);
    const [checkoutMessage, setCheckoutMessage] = React.useState('');
    const [errorMessage, setErrorMessage] = React.useState('');
    const [invoicePreview, setInvoicePreview] = React.useState(false);
    const invoiceNumber = React.useMemo(() => `INV-${Date.now().toString().slice(-8)}`, []);

    React.useEffect(() => {
        const loadCheckoutItems = async () => {
            if (!user || !storeId) {
                setCheckoutItems([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage('');
            try {
                const { items } = await fetchStoreCartItems(user.id, storeId);
                setCheckoutItems(items);
                setCartItems(items as any);
                setInvoicePreview(false);
            } catch (error: any) {
                console.error('Error loading checkout items:', error);
                setErrorMessage(error?.message || 'Failed to load cart for checkout.');
                setCheckoutItems([]);
                setInvoicePreview(false);
            } finally {
                setLoading(false);
            }
        };

        void loadCheckoutItems();
    }, [user, storeId, setCartItems]);

    const total = calculateCartTotal(cartItems);

    const handleCheckout = async () => {
        if (!user || !storeId || cartItems.length === 0) return;

        setProcessing(true);
        setErrorMessage('');
        try {
            const result = await checkoutStoreCart(user.id, storeId);
            setCheckoutItems([]);
            setCartItems([] as any);

            const db = supabase as any;
            const { data: updatedProducts, error: productsError } = await db
                .from('products')
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (!productsError && updatedProducts) {
                setProducts(updatedProducts);
            }

            setCheckoutMessage(
                `Order ${result.orderId.slice(0, 8)} completed for ₹${result.totalPrice.toFixed(2)} (${result.itemCount} items).`
            );
            setCompleted(true);

            setTimeout(() => {
                setIsCheckoutOpen(false);
                setCompleted(false);
                setCheckoutMessage('');
                setInvoicePreview(false);
            }, 3000);
        } catch (error: any) {
            console.error('Error during checkout:', error);
            setErrorMessage(error?.message || 'Checkout failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    if (completed) {
        return (
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <div className={styles.success}>
                        <div className={styles.successIcon}>✓</div>
                        <h2>Order Completed!</h2>
                        <p>{checkoutMessage || 'Thank you for shopping with us!'}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={() => setIsCheckoutOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={() => setIsCheckoutOpen(false)}>
                    ✕
                </button>

                <h2 className={styles.title}>Checkout</h2>

                {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                {loading ? (
                    <p className={styles.hint}>Loading cart...</p>
                ) : (
                    <>
                        <div className={styles.section}>
                            <h3>Order Summary</h3>
                            <div className={styles.items}>
                                {cartItems.length === 0 ? (
                                    <p className={styles.hint}>Your cart is empty.</p>
                                ) : (
                                    cartItems.map((item) => (
                                        <div key={item.id} className={styles.item}>
                                            <span>{item.product.name} x{item.quantity}</span>
                                            <span>₹{(item.product.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className={styles.total}>
                                <span>Total:</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>

                        {invoicePreview && cartItems.length > 0 && (
                            <div className={styles.section}>
                                <h3>Invoice Preview</h3>
                                <p className={styles.hint}>Invoice #{invoiceNumber}</p>
                                <div className={styles.items}>
                                    {cartItems.map((item) => (
                                        <div key={`invoice-${item.id}`} className={styles.item}>
                                            <span>{item.product.name} × {item.quantity}</span>
                                            <span>₹{(item.product.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.total}>
                                    <span>Grand Total:</span>
                                    <span>₹{total.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {recommendations.length > 0 && (
                            <div className={styles.section}>
                                <h3>🤖 AI Recommendations</h3>
                                <p className={styles.hint}>You might also like:</p>
                                <div className={styles.recommendations}>
                                    {recommendations.slice(0, 3).map((product) => (
                                        <div key={product.id} className={styles.recommendation}>
                                            <div className={styles.recName}>{product.name}</div>
                                            <div className={styles.recPrice}>₹{product.price}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!invoicePreview ? (
                            <button
                                className={styles.checkoutButton}
                                onClick={() => setInvoicePreview(true)}
                                disabled={cartItems.length === 0 || loading}
                            >
                                Show Invoice
                            </button>
                        ) : (
                            <div className={styles.actionRow}>
                                <button
                                    className={styles.secondaryButton}
                                    onClick={() => setInvoicePreview(false)}
                                    disabled={processing}
                                >
                                    Back
                                </button>
                                <button
                                    className={styles.checkoutButton}
                                    onClick={handleCheckout}
                                    disabled={processing || cartItems.length === 0 || loading}
                                >
                                    {processing ? 'Processing...' : `Confirm Checkout (₹${total.toFixed(2)})`}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

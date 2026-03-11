import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import styles from './OrderHistory.module.css';

interface OrderItem {
    productName: string;
    price: number;
    quantity: number;
}

interface PurchaseOrder {
    id: string;
    createdAt: string;
    totalPrice: number;
    items: OrderItem[];
}

interface LegacyOrderItem {
    product_name?: string;
    name?: string;
    product_price?: number;
    price?: number;
    quantity?: number;
}

const mapLegacyItems = (rawItems: unknown): OrderItem[] => {
    if (!Array.isArray(rawItems)) {
        return [];
    }

    return (rawItems as LegacyOrderItem[])
        .map((entry) => {
            const productName = (entry.product_name || entry.name || '').trim();
            const price = Number(entry.product_price ?? entry.price ?? 0);
            const quantity = Number(entry.quantity ?? 0);

            if (!productName || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
                return null;
            }

            return {
                productName,
                price,
                quantity,
            };
        })
        .filter((entry): entry is OrderItem => entry !== null);
};

export const OrderHistory: React.FC = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadOrderHistory = async () => {
            if (!user) {
                setOrders([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const db = supabase as any;

                const { data: orderRows, error: ordersError } = await db
                    .from('orders')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (ordersError) {
                    throw ordersError;
                }

                const safeOrderRows = orderRows || [];
                const orderIds: string[] = safeOrderRows.map((order: any) => order.id);
                const itemsByOrder = new Map<string, OrderItem[]>();

                if (orderIds.length > 0) {
                    const { data: orderItemRows, error: orderItemsError } = await db
                        .from('order_items')
                        .select('order_id, product_name, product_price, quantity')
                        .in('order_id', orderIds);

                    if (!orderItemsError) {
                        (orderItemRows || []).forEach((row: any) => {
                            const normalized: OrderItem = {
                                productName: row.product_name,
                                price: Number(row.product_price || 0),
                                quantity: Number(row.quantity || 0),
                            };

                            if (!itemsByOrder.has(row.order_id)) {
                                itemsByOrder.set(row.order_id, []);
                            }

                            itemsByOrder.get(row.order_id)!.push(normalized);
                        });
                    }
                }

                const normalizedOrders: PurchaseOrder[] = safeOrderRows.map((order: any) => {
                    const fallbackItems = mapLegacyItems(order.items);
                    const items = itemsByOrder.get(order.id) || fallbackItems;

                    const explicitTotal = Number(order.total_price ?? order.total);
                    const computedTotal = items.reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0
                    );

                    return {
                        id: order.id,
                        createdAt: order.created_at,
                        totalPrice: Number.isFinite(explicitTotal) ? explicitTotal : computedTotal,
                        items,
                    };
                });

                setOrders(normalizedOrders);
            } catch (loadError: any) {
                console.error('Failed to load order history:', loadError);
                setError(loadError?.message || 'Failed to load order history.');
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };

        void loadOrderHistory();
    }, [user]);

    return (
        <section className={styles.section}>
            <h2 className={styles.title}>Purchase History</h2>

            {loading && <p className={styles.status}>Loading orders...</p>}
            {!loading && error && <p className={styles.error}>{error}</p>}

            {!loading && !error && orders.length === 0 && (
                <p className={styles.status}>No purchases yet.</p>
            )}

            {!loading && !error && orders.length > 0 && (
                <div className={styles.orderList}>
                    {orders.map((order) => (
                        <article key={order.id} className={styles.orderCard}>
                            <div className={styles.metaRow}>
                                <span><strong>Order ID:</strong> {order.id}</span>
                            </div>
                            <div className={styles.metaRow}>
                                <span><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</span>
                            </div>
                            <div className={styles.metaRow}>
                                <span><strong>Total Price:</strong> ₹{order.totalPrice.toFixed(2)}</span>
                            </div>

                            <div className={styles.itemsWrap}>
                                <h3 className={styles.itemsTitle}>Items</h3>
                                {order.items.length === 0 ? (
                                    <p className={styles.noItems}>No item details available for this order.</p>
                                ) : (
                                    <ul className={styles.itemsList}>
                                        {order.items.map((item, index) => (
                                            <li key={`${order.id}-${index}`} className={styles.itemRow}>
                                                <span className={styles.itemName}>{item.productName}</span>
                                                <span className={styles.itemMeta}>₹{item.price.toFixed(2)}</span>
                                                <span className={styles.itemMeta}>Qty: {item.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};

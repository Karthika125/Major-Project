import React from 'react';
import { supabase } from '../lib/supabase/client';
import styles from './StoreOrders.module.css';

interface StoreOrdersProps {
    storeId?: string;
    canManageStore: boolean;
}

interface StoreOrderItem {
    order_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
}

interface StoreOrder {
    id: string;
    buyerUsername: string;
    totalPrice: number;
    createdAt: string;
    items: StoreOrderItem[];
}

const formatCurrency = (value: number): string => {
    return `₹${value.toFixed(2)}`;
};

const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
};

export const StoreOrders: React.FC<StoreOrdersProps> = ({ storeId, canManageStore }) => {
    const [orders, setOrders] = React.useState<StoreOrder[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadStoreOrders = async () => {
            if (!storeId) {
                setOrders([]);
                setLoading(false);
                setError('Store id is missing.');
                return;
            }

            if (!canManageStore) {
                setOrders([]);
                setLoading(false);
                setError('Only the store owner can view orders for this store.');
                return;
            }

            setLoading(true);
            setError('');

            try {
                const db = supabase as any;
                const { data, error: queryError } = await db
                    .from('orders')
                    .select(`
                        id,
                        total_price,
                        created_at,
                        buyer:profiles!orders_user_id_fkey(username),
                        order_items(order_id, product_name, product_price, quantity)
                    `)
                    .eq('store_id', storeId)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (queryError) {
                    throw queryError;
                }

                const normalizedOrders: StoreOrder[] = (data || []).map((row: any) => ({
                    id: row.id,
                    buyerUsername: row?.buyer?.username || 'Unknown',
                    totalPrice: Number(row?.total_price || 0),
                    createdAt: row.created_at,
                    items: (row.order_items || []).map((item: any) => ({
                        order_id: item.order_id,
                        product_name: item.product_name,
                        product_price: Number(item.product_price || 0),
                        quantity: Number(item.quantity || 0),
                    })),
                }));

                setOrders(normalizedOrders);
            } catch (err: any) {
                console.error('Error loading store orders:', err);
                setError(err?.message || 'Failed to load store orders.');
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };

        void loadStoreOrders();
    }, [storeId, canManageStore]);

    const toggleExpandedOrder = (orderId: string) => {
        setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
    };

    if (loading) {
        return <div className={styles.emptyState}>Loading orders...</div>;
    }

    if (error) {
        return <div className={styles.emptyState}>{error}</div>;
    }

    if (orders.length === 0) {
        return <div className={styles.emptyState}>No orders yet for this store.</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Buyer</th>
                            <th>Items Purchased</th>
                            <th>Total Price</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => {
                            const isExpanded = expandedOrderId === order.id;

                            return (
                                <React.Fragment key={order.id}>
                                    <tr className={styles.summaryRow}>
                                        <td>#{order.id.slice(0, 8)}</td>
                                        <td>{order.buyerUsername}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className={styles.expandButton}
                                                onClick={() => toggleExpandedOrder(order.id)}
                                            >
                                                {isExpanded
                                                    ? 'Hide items'
                                                    : `View items (${order.items.length})`}
                                            </button>
                                        </td>
                                        <td>{formatCurrency(order.totalPrice)}</td>
                                        <td>{formatDate(order.createdAt)}</td>
                                    </tr>

                                    {isExpanded && (
                                        <tr className={styles.itemsRow}>
                                            <td colSpan={5}>
                                                {order.items.length === 0 ? (
                                                    <div className={styles.emptyItems}>No item snapshot found.</div>
                                                ) : (
                                                    <ul className={styles.itemsList}>
                                                        {order.items.map((item, index) => (
                                                            <li key={`${order.id}-${index}`} className={styles.itemLine}>
                                                                <span>{item.product_name}</span>
                                                                <span>
                                                                    {item.quantity} × {formatCurrency(item.product_price)}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

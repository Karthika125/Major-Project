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

    const loadStoreOrders = React.useCallback(async () => {
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
            const { data: orderRows, error: ordersError } = await db
                .from('orders')
                .select('id, user_id, total_price, created_at')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (ordersError) {
                throw ordersError;
            }

            const safeOrderRows = orderRows || [];
            const orderIds: string[] = safeOrderRows.map((order: any) => order.id).filter(Boolean);
            const userIds: string[] = Array.from(
                new Set(safeOrderRows.map((order: any) => order.user_id).filter(Boolean))
            );

            const itemsByOrder = new Map<string, StoreOrderItem[]>();
            if (orderIds.length > 0) {
                const { data: orderItemRows, error: orderItemsError } = await db
                    .from('order_items')
                    .select('order_id, product_name, product_price, quantity')
                    .in('order_id', orderIds);

                if (orderItemsError) {
                    console.warn('Unable to load order items for store orders:', orderItemsError);
                } else {
                    (orderItemRows || []).forEach((row: any) => {
                        const existing = itemsByOrder.get(row.order_id) || [];
                        existing.push({
                            order_id: row.order_id,
                            product_name: row.product_name,
                            product_price: Number(row.product_price || 0),
                            quantity: Number(row.quantity || 0),
                        });
                        itemsByOrder.set(row.order_id, existing);
                    });
                }
            }

            const usernamesByUserId = new Map<string, string>();
            if (userIds.length > 0) {
                const { data: profileRows, error: profilesError } = await db
                    .from('profiles')
                    .select('id, username')
                    .in('id', userIds);

                if (!profilesError) {
                    (profileRows || []).forEach((row: any) => {
                        usernamesByUserId.set(row.id, row.username);
                    });
                } else {
                    const { data: userRows, error: usersError } = await db
                        .from('users')
                        .select('id, username')
                        .in('id', userIds);

                    if (!usersError) {
                        (userRows || []).forEach((row: any) => {
                            usernamesByUserId.set(row.id, row.username);
                        });
                    }
                }
            }

            const normalizedOrders: StoreOrder[] = safeOrderRows.map((row: any) => ({
                id: row.id,
                buyerUsername: usernamesByUserId.get(row.user_id) || 'Unknown',
                totalPrice: Number(row?.total_price || 0),
                createdAt: row.created_at,
                items: itemsByOrder.get(row.id) || [],
            }));

            setOrders(normalizedOrders);
        } catch (err: any) {
            console.error('Error loading store orders:', err);
            setError(err?.message || 'Failed to load store orders.');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [storeId, canManageStore]);

    React.useEffect(() => {
        void loadStoreOrders();
    }, [loadStoreOrders]);

    React.useEffect(() => {
        if (!storeId || !canManageStore) {
            return;
        }

        const channel = supabase
            .channel(`store-orders-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `store_id=eq.${storeId}`,
                },
                () => {
                    void loadStoreOrders();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [storeId, canManageStore, loadStoreOrders]);

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

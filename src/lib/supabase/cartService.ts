import { supabase } from './client';
import type { Database } from './types';

type Product = Database['public']['Tables']['products']['Row'] & {
    stock?: number | null;
    store_id?: string;
};

export interface StoreCartItem {
    id: string;
    cart_id: string;
    product_id: string;
    quantity: number;
    product: Product;
}

export interface CheckoutResult {
    orderId: string;
    totalPrice: number;
    itemCount: number;
}

interface AddProductToCartInput {
    userId: string;
    productId: string;
    storeId?: string;
    quantity?: number;
}

const mapCartItem = (row: any): StoreCartItem => {
    const product = (row.product || row.products) as Product;

    return {
        id: row.id,
        cart_id: row.cart_id,
        product_id: row.product_id,
        quantity: row.quantity,
        product,
    };
};

const resolveStoreIdFromProduct = async (productId: string): Promise<string> => {
    const db = supabase as any;
    const { data, error } = await db
        .from('products')
        .select('id, store_id')
        .eq('id', productId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data?.store_id) {
        throw new Error('Unable to resolve store for this product.');
    }

    return data.store_id;
};

export const getActiveCart = async (userId: string, storeId: string): Promise<{ id: string } | null> => {
    const db = supabase as any;
    const { data, error } = await db
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
};

export const getOrCreateActiveCart = async (userId: string, storeId: string): Promise<string> => {
    const existing = await getActiveCart(userId, storeId);
    if (existing?.id) {
        return existing.id;
    }

    const db = supabase as any;
    const { data, error } = await db
        .from('carts')
        .insert({
            user_id: userId,
            store_id: storeId,
            is_active: true,
        })
        .select('id')
        .single();

    if (error) {
        throw error;
    }

    if (!data?.id) {
        throw new Error('Failed to create active cart for store.');
    }

    return data.id;
};

export const fetchCartItemsByCartId = async (cartId: string): Promise<StoreCartItem[]> => {
    const db = supabase as any;
    const { data, error } = await db
        .from('cart_items')
        .select('id, cart_id, product_id, quantity, product:products(*)')
        .eq('cart_id', cartId)
        .order('id', { ascending: true });

    if (error) {
        throw error;
    }

    return (data || []).map(mapCartItem);
};

export const fetchStoreCartItems = async (
    userId: string,
    storeId: string
): Promise<{ cartId: string | null; items: StoreCartItem[] }> => {
    const activeCart = await getActiveCart(userId, storeId);
    if (!activeCart?.id) {
        return { cartId: null, items: [] };
    }

    const items = await fetchCartItemsByCartId(activeCart.id);
    return {
        cartId: activeCart.id,
        items,
    };
};

export const addProductToStoreCart = async (
    input: AddProductToCartInput
): Promise<{ cartId: string; items: StoreCartItem[] }> => {
    const db = supabase as any;
    const quantityToAdd = Math.max(1, input.quantity || 1);
    const storeId = input.storeId || (await resolveStoreIdFromProduct(input.productId));

    const cartId = await getOrCreateActiveCart(input.userId, storeId);

    const { data: existingItem, error: existingError } = await db
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', input.productId)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existingItem?.id) {
        const { error: updateError } = await db
            .from('cart_items')
            .update({ quantity: existingItem.quantity + quantityToAdd })
            .eq('id', existingItem.id);

        if (updateError) {
            throw updateError;
        }
    } else {
        const { error: insertError } = await db
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: input.productId,
                quantity: quantityToAdd,
            });

        if (insertError) {
            throw insertError;
        }
    }

    const items = await fetchCartItemsByCartId(cartId);
    return { cartId, items };
};

export const updateStoreCartItemQuantity = async (itemId: string, quantity: number): Promise<void> => {
    const db = supabase as any;
    const { error } = await db
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

    if (error) {
        throw error;
    }
};

export const removeStoreCartItem = async (itemId: string): Promise<void> => {
    const db = supabase as any;
    const { error } = await db
        .from('cart_items')
        .delete()
        .eq('id', itemId);

    if (error) {
        throw error;
    }
};

export const calculateCartTotal = (items: StoreCartItem[]): number => {
    return items.reduce((sum, item) => {
        const price = Number(item.product?.price || 0);
        return sum + price * item.quantity;
    }, 0);
};

export const checkoutStoreCart = async (userId: string, storeId: string): Promise<CheckoutResult> => {
    const db = supabase as any;
    const { cartId, items } = await fetchStoreCartItems(userId, storeId);

    if (!cartId || items.length === 0) {
        throw new Error('Your cart is empty.');
    }

    const totalPrice = calculateCartTotal(items);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    const { data: order, error: orderError } = await db
        .from('orders')
        .insert({
            user_id: userId,
            store_id: storeId,
            status: 'pending',
            total_price: totalPrice,
        })
        .select('id')
        .single();

    if (orderError) {
        throw orderError;
    }

    if (!order?.id) {
        throw new Error('Checkout failed: order was not created.');
    }

    // Clear cart items after order snapshot/stock updates are completed.
    const { error: clearError } = await db
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

    if (clearError) {
        throw clearError;
    }

    return {
        orderId: order.id,
        totalPrice,
        itemCount,
    };
};

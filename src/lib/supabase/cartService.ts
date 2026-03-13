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

const deriveFallbackUsername = (userId: string, email?: string | null): string => {
    const emailPrefix = (email || '').split('@')[0]?.trim().toLowerCase();
    const base = (emailPrefix || 'user').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    const safeBase = base || 'user';
    const suffix = userId.replace(/-/g, '').slice(0, 6);
    return `${safeBase}_${suffix}`;
};

const ensureProfileExists = async (userId: string): Promise<void> => {
    const db = supabase as any;

    const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        if (profileError.code === '42P01') {
            return;
        }
        throw profileError;
    }

    if (profile?.id) {
        return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const username = deriveFallbackUsername(userId, authData.user?.email);

    const { error: upsertError } = await db
        .from('profiles')
        .upsert(
            {
                id: userId,
                username,
            },
            { onConflict: 'id' }
        );

    if (
        upsertError &&
        upsertError.code !== '23505' &&
        upsertError.code !== '42P01'
    ) {
        throw upsertError;
    }
};

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
    await ensureProfileExists(userId);

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

const toCheckoutError = (error: any): Error => {
    const rawMessage = `${error?.message || ''} ${error?.details || ''}`.trim();
    const errorCode = String(error?.code || '').toUpperCase();

    if (/insufficient stock|out of stock/i.test(rawMessage) || (errorCode === 'P0001' && /stock/i.test(rawMessage))) {
        return new Error('Some items are out of stock. Please update your cart and try again.');
    }

    if (/cart is empty|no active cart/i.test(rawMessage)) {
        return new Error('Your cart is empty.');
    }

    if (rawMessage) {
        return new Error(rawMessage);
    }

    return new Error('Checkout failed. Please try again.');
};

const shouldFallbackToLegacyCheckoutRpc = (error: any): boolean => {
    const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();

    return (
        raw.includes('could not find the function public.checkout_cart') ||
        raw.includes('function public.checkout_cart') ||
        raw.includes('unknown') && raw.includes('p_store_id')
    );
};

export const checkoutStoreCart = async (userId: string, storeId: string): Promise<CheckoutResult> => {
    const db = supabase as any;
    let { data: createdOrderId, error: checkoutError } = await db
        .rpc('checkout_cart', {
            p_user_id: userId,
            p_store_id: storeId,
        });

    if (checkoutError && shouldFallbackToLegacyCheckoutRpc(checkoutError)) {
        const legacyResult = await db
            .rpc('checkout_cart', {
                p_user_id: userId,
            });

        createdOrderId = legacyResult.data;
        checkoutError = legacyResult.error;
    }

    if (checkoutError) {
        throw toCheckoutError(checkoutError);
    }

    if (!createdOrderId) {
        throw new Error('Checkout failed: order was not created.');
    }

    let totalPrice = 0;
    let itemCount = 0;

    const { data: orderData } = await db
        .from('orders')
        .select('total_price')
        .eq('id', createdOrderId)
        .maybeSingle();

    const { data: orderItemsData } = await db
        .from('order_items')
        .select('quantity')
        .eq('order_id', createdOrderId);

    totalPrice = Number(orderData?.total_price || 0);
    itemCount = (orderItemsData || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

    return {
        orderId: createdOrderId,
        totalPrice,
        itemCount,
    };
};

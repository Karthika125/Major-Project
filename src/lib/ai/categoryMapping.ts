import { supabase } from '../supabase/client';

export interface CategoryStoreMapping {
    category: string;
    storeId?: string | null;
    storeName?: string;
    description: string;
}

/**
 * Find stores by category
 * Searches for stores with names containing category keywords
 */
export const findStoreByCategory = async (
    category: string
): Promise<{ id: string; name: string } | null> => {
    try {
        const db = supabase as any;
        const { data: stores, error } = await db
            .from('stores')
            .select('id, store_name')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stores:', error);
            return null;
        }

        if (!stores || stores.length === 0) {
            return null;
        }

        // Category keywords for matching
        const categoryKeywords: Record<string, string[]> = {
            Electronics: ['electron', 'electromics', 'tech', 'gadget', 'computer', 'phone', 'digital', 'device'],
            Fashion: ['fashion', 'cloth', 'clothes', 'shoe', 'apparel', 'style', 'boutique', 'wear'],
            Home: ['home', 'furniture', 'living', 'decor', 'kitchen', 'interior'],
            Sports: ['sport', 'athletic', 'outdoor', 'fitness', 'gym', 'exercise'],
            Accessories: ['access', 'jewelry', 'watch', 'bag', 'craft'],
            Hypermarket: ['hyper', 'market', 'super', 'grocery', 'groceries', 'general', 'mall'],
        };

        const keywords = categoryKeywords[category] || [];

        // Find best matching store
        for (const store of stores) {
            const storeName = (store.store_name || '').toLowerCase();
            if (keywords.some((kw) => storeName.includes(kw))) {
                return {
                    id: store.id,
                    name: store.store_name,
                };
            }
        }

        // If no keyword match, return first store as fallback
        if (stores.length > 0) {
            return {
                id: stores[0].id,
                name: stores[0].store_name,
            };
        }

        return null;
    } catch (error) {
        console.error('Error finding store by category:', error);
        return null;
    }
};

/**
 * Get all available stores for browsing
 */
export const getAllStores = async (): Promise<
    Array<{ id: string; name: string }> | null
> => {
    try {
        const db = supabase as any;
        const { data: stores, error } = await db
            .from('stores')
            .select('id, store_name')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stores:', error);
            return null;
        }

        return (stores || []).map((s: any) => ({
            id: s.id,
            name: s.store_name,
        }));
    } catch (error) {
        console.error('Error getting all stores:', error);
        return null;
    }
};

/**
 * Find products by category across all stores
 */
export const findProductsByCategory = async (
    category: string
): Promise<
    Array<{
        id: string;
        name: string;
        storeId: string;
        storeName: string;
        price: number;
        image_url: string | null;
    }> | null
> => {
    try {
        const db = supabase as any;
        const { data: products, error } = await db
            .from('products')
            .select(`
                id,
                name,
                store_id,
                stores:store_id(store_name),
                price,
                image_url,
                category
            `)
            .eq('category', category)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching products:', error);
            return null;
        }

        return (products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            storeId: p.store_id,
            storeName: p.stores?.store_name || 'Unknown Store',
            price: p.price,
            image_url: p.image_url,
        }));
    } catch (error) {
        console.error('Error finding products by category:', error);
        return null;
    }
};

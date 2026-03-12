/**
 * Smart Recommendation Engine  v3
 *
 * Signals:
 *   40% — Order history  (actual product names purchased)
 *   25% — Cart history   (actual product names added to cart)
 *   20% — View history   (product the user spent real time on)
 *   15% — Trending       (real order counts from all users, last 30 days)
 */

import { supabase } from '../supabase/client';
import type {
    ScoredProduct,
    UserBehaviorProfile,
    RecommendationSignal,
    TrendingProduct,
    RecommendationEngineResult,
} from './types';

// ── Raw product shape coming from the game store ──────────────────────────────
type RawProduct = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string;
    image_url: string | null;
    store_id?: string;
    stock?: number | null;
    created_at?: string | null;
    position_x?: number;
    position_y?: number;
};

const WEIGHTS = {
    orderHistory: 0.40,
    cartHistory:  0.25,
    viewHistory:  0.20,
    trending:     0.15,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

const inc = (m: Map<string, number>, k: string, by = 1) =>
    m.set(k, (m.get(k) ?? 0) + by);

const normalise = (m: Map<string, number>): Map<string, number> => {
    const max = Math.max(1, ...m.values());
    const out = new Map<string, number>();
    m.forEach((v, k) => out.set(k, v / max));
    return out;
};

/** Return up to N names from a Map<id,name>, formatted as a quoted list */
const quoteNames = (nameMap: Map<string, string>, limit = 2): string => {
    const names = [...nameMap.values()].slice(0, limit);
    if (names.length === 0) return '';
    if (names.length === 1) return `"${names[0]}"`;
    return names.map(n => `"${n}"`).join(' and ');
};

const fmtSec = (s: number) =>
    s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`;

// ─────────────────────────────────────────────────────────────────────────────
// Build user behaviour profile — stores NAMES not just IDs
// ─────────────────────────────────────────────────────────────────────────────

export const buildUserBehaviorProfile = async (
    userId: string,
    storeProducts: RawProduct[]
): Promise<UserBehaviorProfile> => {
    const db = supabase as any;

    const profile: UserBehaviorProfile = {
        purchasedProductIds:   new Set(),
        purchasedProductNames: new Map(),
        purchasedCategories:   new Map(),
        cartedProductIds:      new Set(),
        cartedProductNames:    new Map(),
        cartedCategories:      new Map(),
        viewedProductIds:      new Map(),
        viewedProductNames:    new Map(),
        viewedCategories:      new Map(),
    };

    // keyed by ID for O(1) look-up
    const byId = new Map<string, RawProduct>(storeProducts.map(p => [p.id, p]));

    // ── 1. Order history ─────────────────────────────────────────────────────
    //
    // We try reading `orders.items` (a JSON array of {product_id, name, price, qty}).
    // If that fails (different schema), fall back to order_items joined with orders.
    try {
        const { data: orders } = await db
            .from('orders')
            .select('id, items')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (orders?.length) {
            for (const order of orders) {
                // items is JSON — may be [{product_id, name, ...}] or similar
                const items: Array<{ product_id?: string; name?: string }> =
                    Array.isArray(order.items) ? order.items : [];

                for (const item of items) {
                    if (!item.product_id) continue;

                    profile.purchasedProductIds.add(item.product_id);

                    // Prefer the product name stored in the order snapshot;
                    // fall back to looking it up in the current store's product list.
                    const productName =
                        item.name?.trim() ||
                        byId.get(item.product_id)?.name ||
                        null;

                    if (productName) {
                        profile.purchasedProductNames.set(item.product_id, productName);
                    }

                    const cat = byId.get(item.product_id)?.category;
                    if (cat) inc(profile.purchasedCategories, cat);
                }
            }
        }
    } catch {
        // Fallback path: order_items table with product_name column
        try {
            const { data: ois } = await db
                .from('order_items')
                .select('product_name, product_price, orders!inner(user_id)')
                .eq('orders.user_id', userId)
                .limit(100);

            if (ois?.length) {
                for (const oi of ois) {
                    const matched = storeProducts.find(p => p.name === oi.product_name);
                    if (matched) {
                        profile.purchasedProductIds.add(matched.id);
                        profile.purchasedProductNames.set(matched.id, matched.name);
                        inc(profile.purchasedCategories, matched.category);
                    }
                }
            }
        } catch { /* silently continue */ }
    }

    // ── 2. Cart history (including past inactive carts) ───────────────────────
    try {
        const { data: carts } = await db
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .limit(20);

        if (carts?.length) {
            const cartIds = carts.map((c: any) => c.id);

            // Join cart_items with products to get the name in one query
            const { data: cartItems } = await db
                .from('cart_items')
                .select('product_id, products(name, category)')
                .in('cart_id', cartIds)
                .limit(200);

            if (cartItems?.length) {
                for (const ci of cartItems) {
                    if (!ci.product_id) continue;

                    const pName: string | undefined =
                        ci.products?.name || byId.get(ci.product_id)?.name;
                    const pCat: string | undefined =
                        ci.products?.category || byId.get(ci.product_id)?.category;

                    profile.cartedProductIds.add(ci.product_id);
                    if (pName) profile.cartedProductNames.set(ci.product_id, pName);
                    if (pCat) inc(profile.cartedCategories, pCat);
                }
            }
        }
    } catch { /* silently continue */ }

    // ── 3. View history (user_activity table) ────────────────────────────────
    try {
        const { data: activity } = await db
            .from('user_activity')
            .select('product_id, action_type, duration')
            .eq('user_id', userId)
            .not('product_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100);

        if (activity?.length) {
            for (const act of activity) {
                if (!act.product_id) continue;

                const dur = Number(act.duration ?? 5);
                inc(profile.viewedProductIds, act.product_id, dur);

                const p = byId.get(act.product_id);
                if (p) {
                    profile.viewedProductNames.set(act.product_id, p.name);
                    inc(profile.viewedCategories, p.category, dur);
                }
            }
        }
    } catch { /* silently continue */ }

    return profile;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch trending — real order counts, last 30 days
// ─────────────────────────────────────────────────────────────────────────────

const fetchTrendingProductIds = async (): Promise<TrendingProduct[]> => {
    const db = supabase as any;
    const trendMap = new Map<string, number>();

    try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: orders } = await db
            .from('orders')
            .select('items')
            .gte('created_at', since)
            .limit(1000);

        if (orders?.length) {
            for (const order of orders) {
                const items: Array<{ product_id?: string }> =
                    Array.isArray(order.items) ? order.items : [];
                for (const item of items) {
                    if (item.product_id) inc(trendMap, item.product_id);
                }
            }
        }
    } catch { /* silently continue */ }

    return [...trendMap.entries()]
        .map(([product_id, order_count]) => ({ product_id, order_count }))
        .sort((a, b) => b.order_count - a.order_count);
};

// ─────────────────────────────────────────────────────────────────────────────
// Track product view
// ─────────────────────────────────────────────────────────────────────────────

export const trackProductView = async (
    userId: string,
    productId: string,
    duration = 10
): Promise<void> => {
    const db = supabase as any;
    try {
        await db.from('user_activity').insert({
            user_id: userId,
            product_id: productId,
            action_type: 'view',
            duration,
        });
    } catch { /* Non-critical */ }
};

// ─────────────────────────────────────────────────────────────────────────────
// Score + generate specific reason detail naming real products
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreResult {
    score:        number;
    signals:      RecommendationSignal[];
    reason:       string;
    reasonDetail: string;
}

const scoreProduct = (
    product: RawProduct,
    profile: UserBehaviorProfile,
    normPurchaseCat:    Map<string, number>,
    normCartCat:        Map<string, number>,
    normViewProd:       Map<string, number>,
    normViewCat:        Map<string, number>,
    trendScoreMap:      Map<string, number>,
    trendCountMap:      Map<string, number>,
    // productId → category, for correctly filtering names by category
    productCategoryMap: Map<string, string>
): ScoreResult => {
    const signals: RecommendationSignal[] = [];

    // ── Order history (40%) ──────────────────────────────────────────────────
    const orderCatScore = normPurchaseCat.get(product.category) ?? 0;
    if (orderCatScore > 0) {
        signals.push({
            type:   'order_history',
            weight: orderCatScore * WEIGHTS.orderHistory,
            label:  'Based on past orders',
        });
    }

    // ── Cart history (25%) ──────────────────────────────────────────────────
    const cartCatScore = normCartCat.get(product.category) ?? 0;
    if (cartCatScore > 0) {
        signals.push({
            type:   'cart_history',
            weight: cartCatScore * WEIGHTS.cartHistory,
            label:  "You've added similar items",
        });
    }

    // ── View history (20%) ──────────────────────────────────────────────────
    const viewProdScore = normViewProd.get(product.id) ?? 0;
    const viewCatScore  = normViewCat.get(product.category) ?? 0;
    const viewScore     = Math.max(viewProdScore, viewCatScore * 0.6);
    if (viewScore > 0) {
        signals.push({
            type:   'view_history',
            weight: viewScore * WEIGHTS.viewHistory,
            label:  'You viewed similar items',
        });
    }

    // ── Trending (15%) ──────────────────────────────────────────────────────
    const trendScore = trendScoreMap.get(product.id) ?? 0;
    if (trendScore > 0.05) {
        signals.push({
            type:   'trending',
            weight: trendScore * WEIGHTS.trending,
            label:  'Trending now',
        });
    }

    const totalScore  = signals.reduce((s, sig) => s + sig.weight, 0);
    const topSignal   = [...signals].sort((a, b) => b.weight - a.weight)[0];
    const trendCount  = trendCountMap.get(product.id) ?? 0;

    // ── Build specific reason strings naming actual products ──────────────────

    let reason       = 'Recommended for you';
    let reasonDetail = `Relevance score: ${Math.round(totalScore * 100)}%`;

    if (topSignal?.type === 'order_history') {
        // Names of products the user bought that share this EXACT category
        const sameCatBought = [...profile.purchasedProductNames.entries()]
            .filter(([id]) => productCategoryMap.get(id) === product.category)
            .map(([, name]) => name);

        // Also show names from other categories if nothing matches (still relevant)
        const allBought = [...profile.purchasedProductNames.values()];
        const namesArr  = sameCatBought.length > 0 ? sameCatBought : allBought;
        const nameStr   = quoteNames(new Map(namesArr.map((n, i) => [String(i), n])), 2);

        if (nameStr) {
            reason       = `Because you bought ${nameStr.replace(/"/g, '\u201c').replace(/"/g, '\u201d')}`;
            reasonDetail = `You previously purchased ${nameStr} — "${product.name}" is from the same "${product.category}" category you enjoy shopping in.`;
        } else {
            reason       = 'Matches your order history';
            reasonDetail = `You've ordered from the "${product.category}" category before. This is a similar product we think you'll like.`;
        }

    } else if (topSignal?.type === 'cart_history') {
        // Names of products carted that share this category
        const sameCatCarted = [...profile.cartedProductNames.entries()]
            .filter(([id]) => productCategoryMap.get(id) === product.category)
            .map(([, name]) => name);

        const allCarted   = [...profile.cartedProductNames.values()];
        const namesArr    = sameCatCarted.length > 0 ? sameCatCarted : allCarted;
        const nameStr     = quoteNames(new Map(namesArr.map((n, i) => [String(i), n])), 2);

        if (nameStr) {
            reason       = `You carted ${nameStr.replace(/"/g, '')}`;
            reasonDetail = `You added ${nameStr} to your cart but didn't purchase it. "${product.name}" is a similar "${product.category}" item — maybe this is what you were looking for?`;
        } else {
            reason       = 'Similar to your cart picks';
            reasonDetail = `You've added "${product.category}" items to your cart before. This is a comparable option.`;
        }

    } else if (topSignal?.type === 'view_history') {
        const rawSeconds  = profile.viewedProductIds.get(product.id) ?? 0;
        const viewedName  = profile.viewedProductNames.get(product.id);

        if (viewedName && rawSeconds > 0) {
            // user viewed THIS exact product
            reason       = `You viewed this for ${fmtSec(rawSeconds)}`;
            reasonDetail = `You spent ${fmtSec(rawSeconds)} viewing "${viewedName}" — we kept it here because it looked like you were interested!`;
        } else {
            // user viewed OTHER products in the same category — name those
            const sameCatViewed = [...profile.viewedProductNames.entries()]
                .filter(([id]) => productCategoryMap.get(id) === product.category)
                .sort(([idA], [idB]) =>
                    (profile.viewedProductIds.get(idB) ?? 0) -
                    (profile.viewedProductIds.get(idA) ?? 0) // most-viewed first
                )
                .map(([, name]) => name)
                .slice(0, 2);

            const nameStr = quoteNames(
                new Map(sameCatViewed.map((n, i) => [String(i), n])), 2
            );

            if (nameStr) {
                // Shorten the name for the badge if it's too long
                const shortName = sameCatViewed[0].length > 18
                    ? sameCatViewed[0].slice(0, 18) + '…'
                    : sameCatViewed[0];
                reason       = `Since you viewed "${shortName}"`;
                reasonDetail = `You previously browsed ${nameStr} in the "${product.category}" category. "${product.name}" is a similar product from the same section.`;
            } else {
                reason       = `Browsed "${product.category}"`;
                reasonDetail = `You spent time looking at "${product.category}" products. This is one of the top picks from that section.`;
            }
        }

    } else if (topSignal?.type === 'trending') {
        reason       = '🔥 Trending now';
        reasonDetail = trendCount > 0
            ? `Ordered by ${trendCount} shopper${trendCount !== 1 ? 's' : ''} in the last 30 days — one of the most purchased items in the store right now.`
            : 'One of the most popular products in the store.';
    }

    // Append trending note as secondary context
    if (trendCount > 1 && topSignal?.type !== 'trending') {
        reasonDetail += ` Also trending — ${trendCount} shopper${trendCount !== 1 ? 's' : ''} ordered this in the last 30 days.`;
    }

    return { score: totalScore, signals, reason, reasonDetail };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Engine Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export const runRecommendationEngine = async (
    userId: string,
    _currentStoreId: string,
    storeProducts: RawProduct[],
    viewedProductId?: string
): Promise<RecommendationEngineResult> => {
    if (storeProducts.length === 0) {
        return { forYou: [], trending: [], similar: [], userProfile: null };
    }

    const [userProfile, trendingRaw] = await Promise.all([
        buildUserBehaviorProfile(userId, storeProducts),
        fetchTrendingProductIds(),
    ]);

    // Normalised maps (0–1 range, for scoring weights)
    const normPurchaseCat = normalise(userProfile.purchasedCategories);
    const normCartCat     = normalise(userProfile.cartedCategories);
    const normViewProd    = normalise(userProfile.viewedProductIds);
    const normViewCat     = normalise(userProfile.viewedCategories);

    // Trend score map (normalised) and raw count map
    const maxTrend      = Math.max(1, ...trendingRaw.map(t => t.order_count));
    const trendScoreMap = new Map<string, number>(
        trendingRaw.map(t => [t.product_id, t.order_count / maxTrend])
    );
    const trendCountMap = new Map<string, number>(
        trendingRaw.map(t => [t.product_id, t.order_count])
    );

    const hasHistory =
        userProfile.purchasedCategories.size > 0 ||
        userProfile.cartedCategories.size > 0 ||
        userProfile.viewedProductIds.size > 0;

    // productId → category lookup (covers products from ALL orders/carts, not just current store)
    const productCategoryMap = new Map<string, string>(
        storeProducts.map(p => [p.id, p.category])
    );

    // Score every product in the store
    const scoredAll: ScoredProduct[] = storeProducts.map(product => {
        const res = scoreProduct(
            product,
            userProfile,
            normPurchaseCat,
            normCartCat,
            normViewProd,
            normViewCat,
            trendScoreMap,
            trendCountMap,
            productCategoryMap
        );
        return {
            ...product,
            score:        res.score,
            signals:      res.signals,
            reason:       res.reason,
            reasonDetail: res.reasonDetail,
            trendCount:   trendCountMap.get(product.id) ?? 0,
        };
    });

    // ── For You ───────────────────────────────────────────────────────────────
    let forYou: ScoredProduct[];

    if (hasHistory) {
        forYou = scoredAll
            .filter(p => !userProfile.purchasedProductIds.has(p.id))   // exclude already bought
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // Pad if fewer than 3 personalised results
        if (forYou.length < 3) {
            const padded = scoredAll
                .filter(p => !forYou.some(f => f.id === p.id))
                .sort(() => Math.random() - 0.5)
                .slice(0, 3 - forYou.length)
                .map(p => ({
                    ...p,
                    reason:       'Explore this',
                    reasonDetail: 'A hand-picked product from this store worth checking out.',
                    signals:      [{ type: 'new_arrival' as const, weight: 0.1, label: 'Pick' }],
                }));
            forYou = [...forYou, ...padded];
        }
    } else {
        // Cold start — no history yet
        forYou = [...storeProducts]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(p => ({
                ...p,
                score:        Math.random(),
                signals:      [{ type: 'new_arrival' as const, weight: 0.1, label: 'New' }],
                reason:       'Start exploring!',
                reasonDetail: "We don't know your taste yet — browse products, add things to cart, and make a purchase. Your recommendations will personalise automatically.",
                trendCount:   trendCountMap.get(p.id) ?? 0,
            }));
    }

    // ── Trending — sorted by real order count ─────────────────────────────────
    const trendingWithCounts = trendingRaw
        .filter(t => storeProducts.some(p => p.id === t.product_id));

    let trending: ScoredProduct[] = trendingWithCounts.slice(0, 5).map(t => {
        const product = storeProducts.find(p => p.id === t.product_id)!;
        const count   = t.order_count;
        return {
            ...product,
            score:        t.order_count / maxTrend,
            signals:      [{ type: 'trending' as const, weight: 1, label: 'Trending' }],
            reason:       `🔥 ${count} order${count !== 1 ? 's' : ''} this month`,
            reasonDetail: `"${product.name}" has been ordered by ${count} shopper${count !== 1 ? 's' : ''} in the last 30 days — making it one of the most popular products in this store right now.`,
            trendCount:   count,
        };
    });

    // Pad trending when order history is sparse
    if (trending.length < 3) {
        const pads = storeProducts
            .filter(p => !trending.some(t => t.id === p.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, 5 - trending.length)
            .map(p => ({
                ...p,
                score:        0.3,
                signals:      [{ type: 'new_arrival' as const, weight: 0.1, label: 'Popular' }],
                reason:       'Popular in this store',
                reasonDetail: 'No orders have been placed here yet. Once shoppers start buying, real trending data will appear. This is a featured product for now.',
                trendCount:   0,
            }));
        trending = [...trending, ...pads];
    }

    // ── Similar ───────────────────────────────────────────────────────────────
    let similar: ScoredProduct[] = [];
    if (viewedProductId) {
        const base = storeProducts.find(p => p.id === viewedProductId);
        if (base) {
            similar = storeProducts
                .filter(p => p.id !== viewedProductId && p.category === base.category)
                .sort((a, b) =>
                    Math.abs(a.price - base.price) - Math.abs(b.price - base.price)
                )
                .slice(0, 5)
                .map(p => {
                    const diff   = Math.abs(p.price - base.price);
                    const tc     = trendCountMap.get(p.id) ?? 0;
                    const cheaper = p.price < base.price;
                    return {
                        ...p,
                        score:   1 - diff / Math.max(base.price, 1),
                        signals: [{ type: 'category_match' as const, weight: 0.8, label: base.category }],
                        reason:  `Similar to "${base.name}"`,
                        reasonDetail:
                            `"${p.name}" and "${base.name}" are both in the "${base.category}" category` +
                            (diff === 0
                                ? ', priced the same.'
                                : `, with "${p.name}" being ₹${diff.toLocaleString('en-IN')} ${cheaper ? 'cheaper' : 'more expensive'}.`) +
                            (tc > 0
                                ? ` It's also trending — ${tc} shopper${tc !== 1 ? 's' : ''} have ordered it.`
                                : ''),
                        trendCount: tc,
                    };
                });
        }
    }

    if (similar.length === 0) {
        similar = forYou.slice(0, 3).map(p => ({
            ...p,
            reason:       'You might also like',
            reasonDetail: 'Click on a product in the 3D store to see items similar to it here.',
        }));
    }

    return { forYou, trending, similar, userProfile };
};

// Types for the Smart Recommendation Engine

export interface ScoredProduct {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string;
    image_url: string | null;
    store_id?: string;
    stock?: number | null;
    // Recommendation metadata
    score: number;
    signals: RecommendationSignal[];
    reason: string;          // Short badge text
    reasonDetail: string;    // Specific long explanation naming actual products
    trendCount?: number;     // Actual order count (for trending tab)
}

export interface RecommendationSignal {
    type: 'order_history' | 'cart_history' | 'view_history' | 'trending' | 'category_match' | 'new_arrival';
    weight: number;
    label: string;
}

export type RecommendationTab = 'for_you' | 'trending' | 'similar';

export interface UserBehaviorProfile {
    // What the user has bought — actual product IDs and names
    purchasedProductIds:   Set<string>;
    purchasedProductNames: Map<string, string>;   // productId -> product name
    purchasedCategories:   Map<string, number>;   // category  -> times purchased

    // What the user has added to cart
    cartedProductIds:   Set<string>;
    cartedProductNames: Map<string, string>;      // productId -> product name
    cartedCategories:   Map<string, number>;      // category  -> times carted

    // What the user has viewed
    viewedProductIds:   Map<string, number>;      // productId -> total seconds viewed
    viewedProductNames: Map<string, string>;      // productId -> product name
    viewedCategories:   Map<string, number>;      // category  -> total seconds
}

export interface TrendingProduct {
    product_id:  string;
    order_count: number;   // real order count from Supabase
}

export interface RecommendationEngineResult {
    forYou:      ScoredProduct[];
    trending:    ScoredProduct[];
    similar:     ScoredProduct[];
    userProfile: UserBehaviorProfile | null;
}

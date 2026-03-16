import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '../lib/store/gameStore';
import { useAuth } from '../lib/auth/AuthProvider';
import {
    runRecommendationEngine,
    trackProductView,
} from '../lib/recommendations/recommendationEngine';
import type {
    ScoredProduct,
    RecommendationTab,
    RecommendationEngineResult,
} from '../lib/recommendations/types';
import styles from './SmartRecommendationPanel.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Signal icons
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<string, string> = {
    order_history:  '🛒',
    cart_history:   '🧺',
    view_history:   '👁',
    trending:       '🔥',
    category_match: '🏷️',
    new_arrival:    '✨',
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────────────────────────────────────

interface ProductCardProps {
    product: ScoredProduct;
    onView:     (p: ScoredProduct) => void;
    onAddToCart:(p: ScoredProduct) => void;
    maxScore:   number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onView, onAddToCart, maxScore }) => {
    const topSignal   = [...product.signals].sort((a, b) => b.weight - a.weight)[0];
    const signalType  = topSignal?.type ?? 'new_arrival';
    const signalIcon  = SIGNAL_ICONS[signalType] ?? '✨';
    const fillWidth   = Math.max(10, Math.min(100, maxScore > 0 ? (product.score / maxScore) * 100 : 30));
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={styles.card}
            onClick={() => onView(product)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onView(product)}
        >
            {/* Subtle gradient glow */}
            <div
                className={styles.cardGlow}
                style={{
                    background: 'radial-gradient(ellipse at 80% 50%, rgba(102,126,234,0.12) 0%, transparent 70%)',
                }}
            />

            {/* ── Row: image + info ── */}
            <div className={styles.cardBody}>
                <div className={styles.productImageWrap}>
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className={styles.productImage}
                            loading="lazy"
                        />
                    ) : (
                        <span className={styles.productPlaceholder}>📦</span>
                    )}
                </div>

                <div className={styles.cardInfo}>
                    <div className={styles.productName} title={product.name}>
                        {product.name}
                    </div>
                    <div className={styles.productCategory}>{product.category}</div>
                    <div className={styles.productPrice}>
                        ₹{Number(product.price).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>

            {/* ── Trend count badge (only when meaningful) ── */}
            {(product.trendCount ?? 0) > 0 && (
                <div className={styles.trendBadge}>
                    🔥 {product.trendCount} order{product.trendCount !== 1 ? 's' : ''} this month
                </div>
            )}

            {/* ── Short reason badge with "why?" expand toggle ── */}
            <div className={styles.reasonRow}>
                <div className={`${styles.reasonBadge} ${styles[signalType]}`}>
                    {signalIcon} {product.reason}
                </div>
                <button
                    className={styles.whyBtn}
                    onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                    title="Why is this recommended?"
                    aria-label="Show recommendation reason"
                >
                    {expanded ? '▲' : 'why?'}
                </button>
            </div>

            {/* ── Expanded reason detail ── */}
            {expanded && (
                <div className={styles.reasonDetail}>
                    {product.reasonDetail}
                </div>
            )}

            {/* ── Score bar ── */}
            <div className={styles.scoreBar}>
                <div className={styles.scoreBarFill} style={{ width: `${fillWidth}%` }} />
            </div>

            {/* ── Quick add button (visible on hover) ── */}
            <button
                className={styles.quickAdd}
                onClick={e => { e.stopPropagation(); onAddToCart(product); }}
                title="Add to cart"
            >
                + Cart
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

interface SmartRecommendationPanelProps {
    storeId?: string;
    scannedItem?: string;
}

export const SmartRecommendationPanel: React.FC<SmartRecommendationPanelProps> = ({ storeId, scannedItem }) => {
    const { user }   = useAuth();
    const { products, selectedProduct, setSelectedProduct } = useGameStore();

    const [result,    setResult]    = useState<RecommendationEngineResult | null>(null);
    const [loading,   setLoading]   = useState(false);
    const [activeTab, setActiveTab] = useState<RecommendationTab>('for_you');
    const [collapsed, setCollapsed] = useState(false);

    const lastRunRef  = useRef<number>(0);
    const runCounter  = useRef<number>(0);

    // ── Run the engine ────────────────────────────────────────────────────────
    const runEngine = useCallback(async (viewedId?: string) => {
        if (!user || products.length === 0) return;

        const now        = Date.now();
        const minInterval = viewedId ? 0 : 15_000;
        if (now - lastRunRef.current < minInterval) return;
        lastRunRef.current = now;

        const runId = ++runCounter.current;
        setLoading(true);

        try {
            const engineResult = await runRecommendationEngine(
                user.id,
                storeId ?? '',
                products as any,
                viewedId
            );
            if (runCounter.current === runId) {
                setResult(engineResult);
            }
        } catch (err) {
            console.error('[SmartRec] Engine error:', err);
        } finally {
            if (runCounter.current === runId) setLoading(false);
        }
    }, [user, products, storeId]);

    // Initial run + when products list changes
    useEffect(() => { void runEngine(); }, [runEngine]);

    // Re-run with "similar" context when a product is opened
    useEffect(() => {
        if (selectedProduct?.id) {
            void runEngine(selectedProduct.id);
            if (user?.id) void trackProductView(user.id, selectedProduct.id, 15);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProduct?.id, user?.id]);

    // Auto-refresh every 2 minutes
    useEffect(() => {
        const iv = setInterval(() => {
            lastRunRef.current = 0;
            void runEngine(selectedProduct?.id);
        }, 2 * 60 * 1000);
        return () => clearInterval(iv);
    }, [runEngine, selectedProduct?.id]);

    // Switch to "similar" tab when a product is selected and similar results exist
    useEffect(() => {
        if (selectedProduct?.id && result?.similar && result.similar.length > 0) {
            setActiveTab('similar');
        }
    }, [selectedProduct?.id, result?.similar]);


    const handleView = useCallback((product: ScoredProduct) => {
        setSelectedProduct(product as any);
    }, [setSelectedProduct]);

    const handleAddToCart = useCallback((product: ScoredProduct) => {
        setSelectedProduct(product as any);
    }, [setSelectedProduct]);

    if (!user) return null;
    if (!loading && (!result || (result.forYou.length === 0 && result.trending.length === 0))) {
        if (products.length === 0) return null;
    }

    const tabItems: ScoredProduct[] =
        activeTab === 'for_you'  ? result?.forYou   ?? [] :
        activeTab === 'trending' ? result?.trending  ?? [] :
                                   result?.similar   ?? [];

    const maxScore = tabItems.length > 0 ? Math.max(...tabItems.map(p => p.score), 0.01) : 1;
    const brandPriority = ['samsung', 'vivo', 'oneplus'];
    const phoneFallbackProducts = (products as any[])
        .filter((p) => {
            const name = (p?.name || '').toString().toLowerCase();
            const category = (p?.category || '').toString().toLowerCase();
            return (
                category.includes('elect') ||
                /(samsung|vivo|oneplus|phone|mobile)/.test(name)
            );
        })
        .sort((a, b) => {
            const aName = (a?.name || '').toString().toLowerCase();
            const bName = (b?.name || '').toString().toLowerCase();
            const aBrand = brandPriority.findIndex((brand) => aName.includes(brand));
            const bBrand = brandPriority.findIndex((brand) => bName.includes(brand));
            const aBrandRank = aBrand === -1 ? 999 : aBrand;
            const bBrandRank = bBrand === -1 ? 999 : bBrand;

            if (aBrandRank !== bBrandRank) return aBrandRank - bBrandRank;

            const aHasImage = a?.image_url ? 1 : 0;
            const bHasImage = b?.image_url ? 1 : 0;
            if (aHasImage !== bHasImage) return bHasImage - aHasImage;

            return aName.localeCompare(bName);
        })
        .slice(0, 8);
    const availableItemTypes = Array.from(
        new Set(
            products
                .map((p: any) => (p?.category || '').toString().trim())
                .filter((v: string) => v.length > 0)
        )
    ).sort((a, b) => a.localeCompare(b));

    // ── Collapsed ────────────────────────────────────────────────────────────
    if (collapsed) {
        return (
            <div className={`${styles.panel} ${styles.collapsed}`}>
                <div
                    className={styles.collapsedButton}
                    onClick={() => setCollapsed(false)}
                    role="button"
                    tabIndex={0}
                    title="Expand Recommendations"
                >
                    <span className={styles.collapsedIcon}>✨</span>
                    <span className={styles.collapsedLabel}>FOR YOU</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.panel} role="complementary" aria-label="Product Recommendations">

            {/* ── Header ── */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <span className={styles.sparkleIcon}>✨</span>
                    <div>
                        <div className={styles.title}>Just for You</div>
                        <div className={styles.subtitle}>AI-powered picks</div>
                    </div>
                </div>
                <button
                    className={styles.collapseBtn}
                    onClick={() => setCollapsed(true)}
                    title="Collapse"
                    aria-label="Collapse recommendations"
                >
                    ›
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className={styles.tabs} role="tablist">
                <button
                    id="tab-for-you"
                    className={`${styles.tab} ${activeTab === 'for_you'  ? styles.active : ''}`}
                    onClick={() => setActiveTab('for_you')}
                    role="tab"
                    aria-selected={activeTab === 'for_you'}
                >
                    🎯 For You
                </button>
                <button
                    id="tab-trending"
                    className={`${styles.tab} ${activeTab === 'trending' ? styles.active : ''}`}
                    onClick={() => setActiveTab('trending')}
                    role="tab"
                    aria-selected={activeTab === 'trending'}
                >
                    🔥 Trending
                </button>
                <button
                    id="tab-similar"
                    className={`${styles.tab} ${activeTab === 'similar'  ? styles.active : ''}`}
                    onClick={() => setActiveTab('similar')}
                    role="tab"
                    aria-selected={activeTab === 'similar'}
                >
                    🏷 Similar
                </button>
            </div>

            {/* ── Content ── */}
            <div className={styles.content} role="tabpanel">
                {(scannedItem || availableItemTypes.length > 0) && (
                    <div className={styles.availableSection}>
                        {scannedItem && (
                            <div className={styles.scannedContext}>
                                Looking for: <strong>{scannedItem}</strong>
                            </div>
                        )}
                        <div className={styles.availableTitle}>All item types available</div>
                        <div className={styles.availableChips}>
                            {availableItemTypes.length > 0 ? (
                                availableItemTypes.map((type) => (
                                    <span key={type} className={styles.availableChip}>{type}</span>
                                ))
                            ) : (
                                <span className={styles.availableEmpty}>No item types found yet.</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab description blurb */}
                <div className={styles.tabBlurb}>
                    {activeTab === 'for_you'  && '🎯 Products scored from your order history, cart, and browsing.'}
                    {activeTab === 'trending' && '🔥 Ranked by real order counts from all shoppers this month.'}
                    {activeTab === 'similar'  && '🏷 Items in the same category as what you\'re viewing.'}
                </div>

                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.loadingDots}>
                            <span /><span /><span />
                        </div>
                        <div className={styles.loadingText}>Finding your picks…</div>
                    </div>
                ) : tabItems.length === 0 && phoneFallbackProducts.length > 0 ? (
                    <>
                        <div className={styles.phoneFallbackTitle}>
                            📱 Mobiles available (Samsung / Vivo / OnePlus)
                        </div>
                        {phoneFallbackProducts.map((product) => (
                            <div
                                key={product.id}
                                className={styles.card}
                                onClick={() => setSelectedProduct(product as any)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && setSelectedProduct(product as any)}
                            >
                                <div
                                    className={styles.cardGlow}
                                    style={{
                                        background: 'radial-gradient(ellipse at 80% 50%, rgba(102,126,234,0.12) 0%, transparent 70%)',
                                    }}
                                />

                                <div className={styles.cardBody}>
                                    <div className={styles.productImageWrap}>
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className={styles.productImage}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className={styles.productPlaceholder}>📦</span>
                                        )}
                                    </div>

                                    <div className={styles.cardInfo}>
                                        <div className={styles.productName} title={product.name}>
                                            {product.name}
                                        </div>
                                        <div className={styles.productCategory}>{product.category || 'Electronics'}</div>
                                        <div className={styles.productPrice}>
                                            ₹{Number(product.price || 0).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.reasonRow}>
                                    <div className={`${styles.reasonBadge} ${styles.category_match}`}>
                                        📱 Shown based on your scanned phone
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : tabItems.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>
                            {activeTab === 'trending' ? '📈' : activeTab === 'similar' ? '🏷️' : '🛍️'}
                        </div>
                        <div className={styles.emptyText}>
                            {activeTab === 'similar'
                                ? 'Click any product in the store to see similar items here.'
                                : activeTab === 'trending'
                                ? 'No orders placed yet. Be the first shopper!'
                                : 'Explore the store to get personalised picks.'}
                        </div>
                    </div>
                ) : (
                    tabItems.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onView={handleView}
                            onAddToCart={handleAddToCart}
                            maxScore={maxScore}
                        />
                    ))
                )}
            </div>

            {/* ── Footer ── */}
            <div className={styles.footer}>
                <div className={styles.footerDot} />
                <span className={styles.footerText}>
                    {result?.userProfile?.purchasedCategories.size
                        ? `Based on ${result.userProfile.purchasedCategories.size} category preference${result.userProfile.purchasedCategories.size > 1 ? 's' : ''}`
                        : 'Personalises as you shop'}
                </span>
                <div className={styles.footerDot} />
            </div>
        </div>
    );
};

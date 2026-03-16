import React, { useMemo, useRef, useState } from 'react';
import type { Database } from '../lib/supabase/types';
import styles from './StoreNpcHelper.module.css';

type Product = Database['public']['Tables']['products']['Row'];

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

interface StoreNpcHelperProps {
    storeName: string;
    products: Product[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showDockButton?: boolean;
}

const formatPrice = (price: number | null | undefined): string => {
    return `Rs ${Number(price || 0).toLocaleString('en-IN')}`;
};

const uniqueCategories = (products: Product[]): string[] => {
    return Array.from(
        new Set(
            products
                .map((p) => (p.category || '').trim())
                .filter((c) => c.length > 0)
        )
    ).sort((a, b) => a.localeCompare(b));
};

const normalize = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const CATEGORY_ALIASES: Record<string, string[]> = {
    electronics: ['electronic', 'electronics', 'phone', 'mobile', 'laptop', 'gadget', 'tech'],
    fashion: ['fashion', 'clothes', 'cloth', 'dress', 'shirt', 'shoe', 'apparel', 'wear'],
    home: ['home', 'kitchen', 'furniture', 'decor'],
    sports: ['sports', 'sport', 'fitness', 'gym', 'athletic'],
    accessories: ['accessories', 'accessory', 'watch', 'bag', 'jewellery', 'jewelry'],
    hypermarket: ['hypermarket', 'grocery', 'groceries', 'daily', 'essentials'],
};

const toPrice = (p: Product): number => Number(p.price || 0);

const hasStock = (p: Product): boolean => {
    const stock = Number((p as any).stock);
    if (Number.isNaN(stock)) return true;
    return stock > 0;
};

const summarizeProducts = (items: Product[], limit = 5): string =>
    items
        .slice(0, limit)
        .map((p) => `${p.name} (${formatPrice(p.price)}${hasStock(p) ? '' : ', out of stock'})`)
        .join(', ');

export const StoreNpcHelper: React.FC<StoreNpcHelperProps> = ({
    storeName,
    products,
    open,
    onOpenChange,
    showDockButton = true,
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: `Hi, I am your shop guide for ${storeName}. Ask me about products, prices, categories, and recommendations.`,
        },
    ]);
    const lastPoolRef = useRef<Product[]>([]);
    const lastCursorRef = useRef(0);

    const categories = useMemo(() => uniqueCategories(products), [products]);

    const isOpen = open ?? internalOpen;
    const setOpen = (next: boolean) => {
        if (typeof open === 'boolean') {
            onOpenChange?.(next);
            return;
        }
        setInternalOpen(next);
        onOpenChange?.(next);
    };

    const setSuggestionPool = (pool: Product[]) => {
        lastPoolRef.current = pool;
        lastCursorRef.current = Math.min(5, pool.length);
    };

    const getCategoryMatches = (q: string): Product[] => {
        const normalizedQuery = normalize(q);
        const directCategory = categories.find((c) => normalizedQuery.includes(normalize(c)));
        if (directCategory) {
            return products.filter((p) => normalize(p.category || '') === normalize(directCategory));
        }

        const aliasCategory = Object.entries(CATEGORY_ALIASES).find(([, aliases]) =>
            aliases.some((a) => normalizedQuery.includes(a))
        )?.[0];

        if (!aliasCategory) return [];

        return products.filter((p) => {
            const cat = normalize(p.category || '');
            if (cat.includes(aliasCategory)) return true;
            return CATEGORY_ALIASES[aliasCategory].some((alias) => cat.includes(alias));
        });
    };

    const respond = (query: string): string => {
        const q = query.toLowerCase().trim();
        const normalizedQuery = normalize(query);

        if (!q) {
            return 'Please ask me anything about this shop.';
        }

        if (q.includes('help') || q.includes('what can you do')) {
            return 'I can help with category search, budget filters, cheapest/premium picks, stock status, comparisons, and smart recommendations.';
        }

        if (/(hi|hello|hey|good morning|good evening)\b/.test(normalizedQuery)) {
            return `Hello. Welcome to ${storeName}. Tell me what you want and your budget, and I will shortlist the best options.`;
        }

        if (/(thanks|thank you)\b/.test(normalizedQuery)) {
            return 'You are welcome. Ask me if you want alternatives or a better value option.';
        }

        if (q.includes('category') || q.includes('categories')) {
            return categories.length > 0
                ? `Available categories: ${categories.join(', ')}.`
                : 'No categories are available in this shop right now.';
        }

        if (q.includes('how many') || q.includes('count') || q.includes('total')) {
            return `This store currently has ${products.length} products.`;
        }

        if (/(more|show more|next)/.test(normalizedQuery)) {
            const pool = lastPoolRef.current;
            if (!pool.length) {
                return 'I can show more after you ask for a category, budget, or recommendation first.';
            }

            const start = lastCursorRef.current;
            const more = pool.slice(start, start + 5);
            if (!more.length) {
                return 'No more items left in this list. Ask for another category or budget range.';
            }

            lastCursorRef.current = start + more.length;
            return `More options: ${summarizeProducts(more, more.length)}.`;
        }

        const budgetMatch = q.match(/(?:under|below|less than)\s*(\d+(?:\.\d+)?)/);
        const rangeMatch = q.match(/(?:between|from)\s*(\d+(?:\.\d+)?)\s*(?:and|to)\s*(\d+(?:\.\d+)?)/);

        if (rangeMatch) {
            const min = Number(rangeMatch[1]);
            const max = Number(rangeMatch[2]);
            const ranged = products
                .filter((p) => {
                    const price = toPrice(p);
                    return price >= Math.min(min, max) && price <= Math.max(min, max);
                })
                .sort((a, b) => toPrice(a) - toPrice(b));

            if (!ranged.length) {
                return `No products found between ${formatPrice(min)} and ${formatPrice(max)}.`;
            }

            setSuggestionPool(ranged);
            return `Products between ${formatPrice(min)} and ${formatPrice(max)}: ${summarizeProducts(ranged)}.`;
        }

        if (budgetMatch) {
            const budget = Number(budgetMatch[1]);
            const withinBudget = products
                .filter((p) => Number(p.price || 0) <= budget)
                .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
                ;

            if (withinBudget.length === 0) {
                return `No products found under ${formatPrice(budget)}.`;
            }

            setSuggestionPool(withinBudget);
            return `Top picks under ${formatPrice(budget)}: ${withinBudget
                .slice(0, 5)
                .map((p) => `${p.name} (${formatPrice(p.price)})`)
                .join(', ')}.`;
        }

        if (/(cheapest|lowest|budget friendly|value)/.test(normalizedQuery)) {
            const cheapest = [...products].sort((a, b) => toPrice(a) - toPrice(b));
            if (!cheapest.length) return 'No products are available right now.';
            setSuggestionPool(cheapest);
            return `Most affordable items: ${summarizeProducts(cheapest)}.`;
        }

        if (/(expensive|premium|best|top end|high end)/.test(normalizedQuery)) {
            const premium = [...products].sort((a, b) => toPrice(b) - toPrice(a));
            if (!premium.length) return 'No products are available right now.';
            setSuggestionPool(premium);
            return `Premium picks: ${summarizeProducts(premium)}.`;
        }

        if (/(in stock|available now|available)/.test(normalizedQuery)) {
            const stockItems = products.filter(hasStock);
            if (!stockItems.length) return 'No in-stock products found currently.';
            setSuggestionPool(stockItems);
            return `Currently in stock: ${summarizeProducts(stockItems)}.`;
        }

        const compareMatch = normalizedQuery.match(/compare\s+(.+)\s+(?:and|vs)\s+(.+)/);
        if (compareMatch) {
            const aTerm = compareMatch[1].trim();
            const bTerm = compareMatch[2].trim();
            const a = products.find((p) => normalize(p.name || '').includes(aTerm));
            const b = products.find((p) => normalize(p.name || '').includes(bTerm));

            if (!a || !b) {
                return 'I could not find both products to compare. Please provide exact names.';
            }

            const cheaper = toPrice(a) <= toPrice(b) ? a : b;
            return `Comparison: ${a.name} (${formatPrice(a.price)}) vs ${b.name} (${formatPrice(b.price)}). Better value by price: ${cheaper.name}.`;
        }

        const categoryMatches = getCategoryMatches(normalizedQuery);
        if (categoryMatches.length > 0) {
            const sorted = [...categoryMatches].sort((a, b) => toPrice(a) - toPrice(b));
            setSuggestionPool(sorted);
            return `Here are matching items: ${summarizeProducts(sorted)}.`;
        }

        if (q.includes('recommend') || q.includes('suggest')) {
            const top = [...products]
                .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
                ;

            if (top.length === 0) {
                return 'There are no products to recommend yet.';
            }

            setSuggestionPool(top);
            return `Recommended picks: ${top
                .slice(0, 4)
                .map((p) => `${p.name} (${formatPrice(p.price)})`)
                .join(', ')}.`;
        }

        const keyword = normalizedQuery;
        if (keyword.length > 1) {
            const matches = products
                .filter((p) =>
                    normalize(p.name || '').includes(keyword) ||
                    normalize(p.category || '').includes(keyword)
                )
                ;

            if (matches.length > 0) {
                const sorted = [...matches].sort((a, b) => toPrice(a) - toPrice(b));
                setSuggestionPool(sorted);
                return `I found: ${summarizeProducts(sorted)}.`;
            }
        }

        return 'I can help with category search, budget ranges, comparisons, stock checks, and recommendations. Try: "show electronics", "under 50000", "between 20000 and 40000", or "compare iphone and samsung".';
    };

    const sendMessage = () => {
        const text = input.trim();
        if (!text) return;

        setMessages((prev) => [...prev, { role: 'user', content: text }]);
        const answer = respond(text);
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
        setInput('');
    };

    return (
        <>
            {showDockButton && (
                <button
                    className={styles.npcDock}
                    onClick={() => setOpen(!isOpen)}
                    title="Shop Guide NPC"
                >
                    <span className={styles.avatar}>Guide</span>
                    <span className={styles.label}>Shop Helper</span>
                </button>
            )}

            {isOpen && (
                <div className={styles.panel}>
                    <div className={styles.header}>
                        <div>
                            <div className={styles.title}>NPC Shop Guide</div>
                            <div className={styles.subtitle}>{storeName}</div>
                        </div>
                        <button className={styles.closeBtn} onClick={() => setOpen(false)}>X</button>
                    </div>

                    <div className={styles.messages}>
                        {messages.map((m, idx) => (
                            <div
                                key={`${m.role}-${idx}`}
                                className={m.role === 'user' ? styles.userMsg : styles.aiMsg}
                            >
                                {m.content}
                            </div>
                        ))}
                    </div>

                    <div className={styles.inputRow}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Ask about this shop..."
                        />
                        <button onClick={sendMessage}>Send</button>
                    </div>
                </div>
            )}
        </>
    );
};

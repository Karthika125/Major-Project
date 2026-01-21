import React from 'react';
import type { Database } from '../lib/supabase/types';
import { useGameStore } from '../lib/store/gameStore';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductProximityHUDProps {
    product: Product | null;
}

export const ProductProximityHUD: React.FC<ProductProximityHUDProps> = ({ product }) => {
    const addToCart = useGameStore(state => state.addToCart);

    if (!product) return null;

    const handleAddToCart = () => {
        addToCart(product);
    };

    return (
        <>
            <style>{`
                .proximity-hud {
                    position: fixed;
                    bottom: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(74, 144, 226, 0.2);
                    border-radius: 20px;
                    padding: 24px 32px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                    min-width: 450px;
                    max-width: 500px;
                    animation: slideUpFade 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes slideUpFade {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                .proximity-hud-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .proximity-hud-image {
                    width: 80px;
                    height: 80px;
                    object-fit: cover;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    flex-shrink: 0;
                }

                .proximity-hud-title {
                    flex: 1;
                    min-width: 0;
                }

                .proximity-hud-name {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin: 0 0 6px 0;
                    line-height: 1.3;
                }

                .proximity-hud-category {
                    display: inline-block;
                    font-size: 11px;
                    color: #4A90E2;
                    background: rgba(74, 144, 226, 0.1);
                    padding: 4px 10px;
                    border-radius: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 600;
                }

                .proximity-hud-description {
                    font-size: 14px;
                    color: #555;
                    line-height: 1.6;
                    margin: 0 0 16px 0;
                }

                .proximity-hud-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                .proximity-hud-price {
                    font-size: 28px;
                    font-weight: 700;
                    color: #4A90E2;
                    display: flex;
                    align-items: baseline;
                    gap: 4px;
                }

                .proximity-hud-currency {
                    font-size: 18px;
                    font-weight: 600;
                }

                .proximity-hud-actions {
                    display: flex;
                    gap: 12px;
                }

                .proximity-hud-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .proximity-hud-btn-cart {
                    background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
                }

                .proximity-hud-btn-cart:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
                }

                .proximity-hud-btn-cart:active {
                    transform: translateY(0);
                }

                .proximity-hud-hint {
                    font-size: 12px;
                    color: #999;
                    text-align: center;
                    margin-top: 12px;
                    font-style: italic;
                }
            `}</style>

            <div className="proximity-hud">
                <div className="proximity-hud-header">
                    {product.image_url && (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="proximity-hud-image"
                        />
                    )}
                    <div className="proximity-hud-title">
                        <h3 className="proximity-hud-name">{product.name}</h3>
                        {product.category && (
                            <span className="proximity-hud-category">{product.category}</span>
                        )}
                    </div>
                </div>

                {product.description && (
                    <p className="proximity-hud-description">{product.description}</p>
                )}

                <div className="proximity-hud-footer">
                    <div className="proximity-hud-price">
                        <span className="proximity-hud-currency">$</span>
                        {product.price}
                    </div>
                    <div className="proximity-hud-actions">
                        <button
                            className="proximity-hud-btn proximity-hud-btn-cart"
                            onClick={handleAddToCart}
                        >
                            🛒 Add to Cart
                        </button>
                    </div>
                </div>

                <div className="proximity-hud-hint">
                    Click product or press Space to view full details
                </div>
            </div>
        </>
    );
};

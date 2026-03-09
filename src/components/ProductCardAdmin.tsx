import React from 'react';
import styles from './ProductCardAdmin.module.css';

export interface ProductCardAdminItem {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    stock: number;
}

interface ProductCardAdminProps {
    product: ProductCardAdminItem;
    canManage: boolean;
    onEdit: (product: ProductCardAdminItem) => void;
    onDelete: (product: ProductCardAdminItem) => void;
}

export const ProductCardAdmin: React.FC<ProductCardAdminProps> = ({
    product,
    canManage,
    onEdit,
    onDelete,
}) => {
    return (
        <article className={styles.productCard}>
            <div className={styles.productImageWrap}>
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className={styles.productImage} />
                ) : (
                    <div className={styles.imagePlaceholder}>📦</div>
                )}
            </div>
            <div className={styles.productContent}>
                <h3>{product.name}</h3>
                <p>{product.description || 'No description provided.'}</p>
                <div className={styles.metaRow}>
                    <span>₹{product.price.toFixed(2)}</span>
                    <span>Stock: {product.stock}</span>
                </div>
                <div className={styles.cardActions}>
                    <button className={styles.secondaryButton} onClick={() => onEdit(product)} disabled={!canManage}>
                        Edit
                    </button>
                    <button className={styles.dangerButton} onClick={() => onDelete(product)} disabled={!canManage}>
                        Delete
                    </button>
                </div>
            </div>
        </article>
    );
};

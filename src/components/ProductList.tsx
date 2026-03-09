import React from 'react';
import { ProductCardAdmin, type ProductCardAdminItem } from './ProductCardAdmin';
import styles from './ProductList.module.css';

interface ProductListProps {
    products: ProductCardAdminItem[];
    canManage: boolean;
    onEdit: (product: ProductCardAdminItem) => void;
    onDelete: (product: ProductCardAdminItem) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ products, canManage, onEdit, onDelete }) => {
    if (products.length === 0) {
        return <div className={styles.emptyState}>No products yet. Add your first product above.</div>;
    }

    return (
        <div className={styles.productsGrid}>
            {products.map((product) => (
                <ProductCardAdmin
                    key={product.id}
                    product={product}
                    canManage={canManage}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

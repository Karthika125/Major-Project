import React from 'react';
import styles from './ProductForm.module.css';

export interface ProductFormValues {
    name: string;
    description: string;
    price: string;
    stock: string;
    image_url: string;
}

interface ProductFormProps {
    values: ProductFormValues;
    editing: boolean;
    saving: boolean;
    disabled?: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onFieldChange: (field: keyof ProductFormValues, value: string) => void;
    onFileChange: (file: File | null) => void;
    onCancelEdit: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
    values,
    editing,
    saving,
    disabled = false,
    onSubmit,
    onFieldChange,
    onFileChange,
    onCancelEdit,
}) => {
    return (
        <form onSubmit={onSubmit} className={styles.formGrid}>
            <div className={styles.field}>
                <label htmlFor="productName">Product Name *</label>
                <input
                    id="productName"
                    type="text"
                    value={values.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    disabled={disabled || saving}
                    required
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="price">Price *</label>
                <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={values.price}
                    onChange={(e) => onFieldChange('price', e.target.value)}
                    disabled={disabled || saving}
                    required
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="stock">Stock *</label>
                <input
                    id="stock"
                    type="number"
                    min="0"
                    value={values.stock}
                    onChange={(e) => onFieldChange('stock', e.target.value)}
                    disabled={disabled || saving}
                    required
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="imageFile">Product Image Upload</label>
                <input
                    id="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                    disabled={disabled || saving}
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="imageUrl">Image URL (optional fallback)</label>
                <input
                    id="imageUrl"
                    type="url"
                    value={values.image_url}
                    onChange={(e) => onFieldChange('image_url', e.target.value)}
                    placeholder="https://example.com/product.jpg"
                    disabled={disabled || saving}
                />
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    rows={3}
                    value={values.description}
                    onChange={(e) => onFieldChange('description', e.target.value)}
                    disabled={disabled || saving}
                />
            </div>

            <div className={`${styles.actions} ${styles.fullWidth}`}>
                {editing && (
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onCancelEdit}
                        disabled={disabled || saving}
                    >
                        Cancel Edit
                    </button>
                )}
                <button type="submit" className={styles.primaryButton} disabled={disabled || saving}>
                    {saving ? 'Saving...' : editing ? 'Update Product' : 'Add Product'}
                </button>
            </div>
        </form>
    );
};

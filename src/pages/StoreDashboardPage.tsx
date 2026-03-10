import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { uploadProductImage, deleteProductImage } from '../lib/supabase/productStorage';
import { ProductForm, type ProductFormValues } from '../components/ProductForm';
import { ProductList } from '../components/ProductList';
import { StoreOrders } from '@/components/StoreOrders';
import type { ProductCardAdminItem } from '../components/ProductCardAdmin';
import styles from './StoreDashboardPage.module.css';

interface StoreRecord {
    id: string;
    owner_id: string;
    store_name: string;
    description: string | null;
    created_at: string;
}

interface ProductRecord {
    id: string;
    store_id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    stock: number;
    created_at: string;
}

export const StoreDashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { storeId } = useParams<{ storeId: string }>();

    const [store, setStore] = useState<StoreRecord | null>(null);
    const [products, setProducts] = useState<ProductRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingProduct, setEditingProduct] = useState<ProductCardAdminItem | null>(null);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [storeForm, setStoreForm] = useState({
        store_name: '',
        description: '',
    });
    const [storeSaving, setStoreSaving] = useState(false);
    const [deletingStore, setDeletingStore] = useState(false);
    const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');

    const [formData, setFormData] = useState<ProductFormValues>({
        name: '',
        description: '',
        price: '',
        stock: '0',
        image_url: '',
    });

    const canManageStore = Boolean(user && store && store.owner_id === user.id);
    const canManageProducts = canManageStore;

    const resetForm = () => {
        setEditingProduct(null);
        setSelectedImageFile(null);
        setFormData({
            name: '',
            description: '',
            price: '',
            stock: '0',
            image_url: '',
        });
    };

    const loadProducts = async (activeStoreId: string) => {
        const db = supabase as any;
        const { data, error: productsError } = await db
            .from('products')
            .select('*')
            .eq('store_id', activeStoreId)
            .order('created_at', { ascending: false });

        if (productsError) throw productsError;
        setProducts(data || []);
    };

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (!storeId) {
            navigate('/mall');
            return;
        }

        const initialize = async () => {
            setLoading(true);
            setError('');

            try {
                const db = supabase as any;
                const { data: storeData, error: storeError } = await db
                    .from('stores')
                    .select('*')
                    .eq('id', storeId)
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (storeError) throw storeError;
                if (!storeData) {
                    setError('Store not found or you are not allowed to access this dashboard.');
                    setLoading(false);
                    return;
                }

                setStore(storeData);
                setStoreForm({
                    store_name: storeData.store_name || '',
                    description: storeData.description || '',
                });

                await loadProducts(storeId);
            } catch (err: any) {
                console.error('Error loading store dashboard:', err);
                setError(err?.message || 'Failed to load dashboard.');
            } finally {
                setLoading(false);
            }
        };

        void initialize();
    }, [user, storeId, navigate]);

    const handleSubmitProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeId) return;

        if (!canManageProducts) {
            setError('Only the store owner can manage products.');
            return;
        }

        const name = formData.name.trim();
        const price = Number(formData.price);
        const stock = Number(formData.stock);

        if (!name) {
            setError('Product name is required.');
            return;
        }

        if (Number.isNaN(price) || price < 0) {
            setError('Price must be a valid non-negative number.');
            return;
        }

        if (Number.isNaN(stock) || stock < 0) {
            setError('Stock must be a valid non-negative number.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const db = supabase as any;
            let imageUrl = formData.image_url.trim() || null;

            if (selectedImageFile) {
                const upload = await uploadProductImage(selectedImageFile, storeId, editingProduct?.id);
                imageUrl = upload.publicUrl;
            }

            if (editingProduct) {
                const { error: updateError } = await db
                    .from('products')
                    .update({
                        name,
                        description: formData.description.trim() || null,
                        price,
                        image_url: imageUrl,
                        stock,
                    })
                    .eq('id', editingProduct.id)
                    .eq('store_id', storeId);

                if (updateError) throw updateError;

                if (selectedImageFile && editingProduct.image_url && editingProduct.image_url !== imageUrl) {
                    try {
                        await deleteProductImage(editingProduct.image_url);
                    } catch (imageDeleteError) {
                        console.warn('Product updated but old image delete failed:', imageDeleteError);
                    }
                }
            } else {
                const { error: insertError } = await db
                    .from('products')
                    .insert({
                        store_id: storeId,
                        name,
                        description: formData.description.trim() || null,
                        price,
                        image_url: imageUrl,
                        stock,
                    });

                if (insertError) throw insertError;
            }

            await loadProducts(storeId);
            resetForm();
        } catch (err: any) {
            console.error('Error saving product:', err);
            setError(err?.message || 'Failed to save product.');
        } finally {
            setSaving(false);
        }
    };

    const handleEditProduct = (product: ProductCardAdminItem) => {
        setEditingProduct(product);
        setSelectedImageFile(null);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            stock: product.stock.toString(),
            image_url: product.image_url || '',
        });
    };

    const handleDeleteProduct = async (product: ProductCardAdminItem) => {
        if (!storeId) return;
        if (!canManageProducts) {
            setError('Only the store owner can manage products.');
            return;
        }
        if (!confirm(`Delete ${product.name}?`)) return;

        setError('');

        try {
            const db = supabase as any;
            const { error: deleteError } = await db
                .from('products')
                .delete()
                .eq('id', product.id)
                .eq('store_id', storeId);

            if (deleteError) throw deleteError;

            if (product.image_url) {
                try {
                    await deleteProductImage(product.image_url);
                } catch (imageDeleteError) {
                    console.warn('Product deleted but image delete failed:', imageDeleteError);
                }
            }

            setProducts((prev) => prev.filter((p) => p.id !== product.id));
            if (editingProduct?.id === product.id) {
                resetForm();
            }
        } catch (err: any) {
            console.error('Error deleting product:', err);
            setError(err?.message || 'Failed to delete product.');
        }
    };

    const handleUpdateStore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeId || !user) return;

        if (!canManageStore) {
            setError('Only the store owner can update store settings.');
            return;
        }

        const trimmedName = storeForm.store_name.trim();
        if (!trimmedName) {
            setError('Store name is required.');
            return;
        }

        setStoreSaving(true);
        setError('');

        try {
            const db = supabase as any;
            const { data, error: updateError } = await db
                .from('stores')
                .update({
                    store_name: trimmedName,
                    description: storeForm.description.trim() || null,
                })
                .eq('id', storeId)
                .eq('owner_id', user.id)
                .select('*')
                .maybeSingle();

            if (updateError) throw updateError;
            if (!data) throw new Error('Store update failed.');

            setStore(data);
            setStoreForm({
                store_name: data.store_name || '',
                description: data.description || '',
            });
        } catch (err: any) {
            console.error('Error updating store settings:', err);
            setError(err?.message || 'Failed to update store settings.');
        } finally {
            setStoreSaving(false);
        }
    };

    const handleDeleteStore = async () => {
        if (!storeId || !user || !store) return;

        if (!canManageStore) {
            setError('Only the store owner can delete this store.');
            return;
        }

        if (!confirm(`Delete store "${store.store_name}"? This cannot be undone.`)) {
            return;
        }

        setDeletingStore(true);
        setError('');

        try {
            const db = supabase as any;
            const { error: deleteError } = await db
                .from('stores')
                .delete()
                .eq('id', storeId)
                .eq('owner_id', user.id);

            if (deleteError) throw deleteError;

            navigate('/mall');
        } catch (err: any) {
            console.error('Error deleting store:', err);
            setError(err?.message || 'Failed to delete store.');
        } finally {
            setDeletingStore(false);
        }
    };

    if (!user) return null;

    if (loading) {
        return (
            <div className={styles.loadingState}>
                <p>Loading store dashboard...</p>
            </div>
        );
    }

    if (!store) {
        return (
            <div className={styles.loadingState}>
                <p>Store not found or you are not allowed to access this dashboard.</p>
                <button className={styles.secondaryButton} onClick={() => navigate('/mall')}>
                    Back to Mall
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>{store.store_name || 'Store Dashboard'}</h1>
                    <p className={styles.subtitle}>{store.description || 'Manage your products and inventory.'}</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.secondaryButton} onClick={() => navigate('/stores/create')}>
                        + New Store
                    </button>
                    <button className={styles.secondaryButton} onClick={() => navigate('/mall')}>
                        Back to Mall
                    </button>
                </div>
            </header>

            {error && <div className={styles.error}>{error}</div>}

            <section className={styles.formCard}>
                <h2>Store Settings</h2>
                <form onSubmit={handleUpdateStore} className={styles.formGrid}>
                    <div className={styles.field}>
                        <label htmlFor="storeName">Store Name *</label>
                        <input
                            id="storeName"
                            type="text"
                            value={storeForm.store_name}
                            onChange={(e) => setStoreForm((prev) => ({ ...prev, store_name: e.target.value }))}
                            disabled={!canManageStore || storeSaving || deletingStore}
                            required
                        />
                    </div>

                    <div className={`${styles.field} ${styles.fullWidth}`}>
                        <label htmlFor="storeDescription">Description</label>
                        <textarea
                            id="storeDescription"
                            rows={3}
                            value={storeForm.description}
                            onChange={(e) => setStoreForm((prev) => ({ ...prev, description: e.target.value }))}
                            disabled={!canManageStore || storeSaving || deletingStore}
                        />
                    </div>

                    <div className={`${styles.actions} ${styles.fullWidth}`}>
                        <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={!canManageStore || storeSaving || deletingStore}
                        >
                            {storeSaving ? 'Saving...' : 'Save Store'}
                        </button>
                        <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={handleDeleteStore}
                            disabled={!canManageStore || storeSaving || deletingStore}
                        >
                            {deletingStore ? 'Deleting...' : 'Delete Store'}
                        </button>
                    </div>
                </form>
            </section>

            <nav className={styles.tabBar} aria-label="Dashboard Sections">
                <button
                    type="button"
                    className={`${styles.tabButton} ${activeTab === 'products' ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    Products
                </button>
                <button
                    type="button"
                    className={`${styles.tabButton} ${activeTab === 'orders' ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    Orders
                </button>
            </nav>

            {activeTab === 'products' ? (
                <>
                    <section className={styles.formCard}>
                        <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                        <ProductForm
                            values={formData}
                            editing={Boolean(editingProduct)}
                            saving={saving}
                            disabled={!canManageProducts}
                            onSubmit={handleSubmitProduct}
                            onFieldChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
                            onFileChange={setSelectedImageFile}
                            onCancelEdit={resetForm}
                        />
                    </section>

                    <section className={styles.productsSection}>
                        <h2>Your Products ({products.length})</h2>
                        <ProductList
                            products={products}
                            canManage={canManageProducts}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                        />
                    </section>
                </>
            ) : (
                <section className={styles.ordersSection}>
                    <h2>Orders</h2>
                    <StoreOrders
                        storeId={storeId}
                        canManageStore={canManageStore}
                    />
                </section>
            )}
        </div>
    );
};

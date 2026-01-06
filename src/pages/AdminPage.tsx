import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import styles from './AdminPage.module.css';

interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    image_url: string;
    position_x: number;
    position_y: number;
    created_at: string;
}

interface Order {
    id: string;
    user_id: string;
    total: number;
    status: string;
    items: any; // JSONB
    created_at: string;
    users?: {
        username: string;
    };
}

const STORES = [
    { id: 'all', name: 'All Products', icon: '🛍️', color: '#667eea' }
];

export const AdminPage: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState<'stores' | 'orders'>('stores');
    const [selectedStore, setSelectedStore] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [stats, setStats] = useState({
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalUsers: 0
    });

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        position_x: '0',
        position_y: '0'
    });

    // Handle login
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === 'admin' && password === 'admin123') {
            setIsAuthenticated(true);
            setLoginError('');
        } else {
            setLoginError('Invalid username or password');
        }
    };

    // Load dashboard stats
    useEffect(() => {
        if (isAuthenticated) {
            loadStats();
            loadOrders();
        }
    }, [isAuthenticated]);

    const loadStats = async () => {
        try {
            const [productsRes, ordersRes, usersRes] = await Promise.all([
                supabase.from('products').select('*', { count: 'exact', head: true }),
                supabase.from('orders').select('total, status'),
                supabase.from('users').select('*', { count: 'exact', head: true })
            ]);

            const completedOrders = ordersRes.data?.filter(o => o.status === 'completed') || [];
            const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);

            setStats({
                totalProducts: productsRes.count || 0,
                totalOrders: completedOrders.length,
                totalRevenue,
                totalUsers: usersRes.count || 0
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // Load all products
    useEffect(() => {
        if (isAuthenticated && selectedStore) {
            loadProducts();
        }
    }, [selectedStore, isAuthenticated]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            setProducts(data || []);
        } catch (error: any) {
            console.error('Error loading products:', error);
            alert(`Failed to load products: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Load orders
    const loadOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    users:user_id (username)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    };

    // Add product
    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const { error } = await supabase.from('products').insert([{
                name: formData.name,
                description: formData.description || null,
                price: parseFloat(formData.price),
                category: formData.category,
                image_url: formData.image_url,
                position_x: parseInt(formData.position_x),
                position_y: parseInt(formData.position_y)
            }]);

            if (error) throw error;

            alert('Product added successfully!');
            setShowAddModal(false);
            resetForm();
            loadProducts();
            loadStats();
        } catch (error: any) {
            console.error('Error adding product:', error);
            alert(`Failed to add product: ${error.message}`);
        }
    };

    // Update product
    const handleUpdateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;

        try {
            const { error } = await supabase
                .from('products')
                .update({
                    name: formData.name,
                    description: formData.description || null,
                    price: parseFloat(formData.price),
                    category: formData.category,
                    image_url: formData.image_url,
                    position_x: parseInt(formData.position_x),
                    position_y: parseInt(formData.position_y)
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            alert('Product updated successfully!');
            setEditingProduct(null);
            resetForm();
            loadProducts();
        } catch (error: any) {
            console.error('Error updating product:', error);
            alert(`Failed to update product: ${error.message}`);
        }
    };

    // Delete product
    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (!confirm(`Are you sure you want to delete "${productName}"?`)) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

            if (error) throw error;

            alert('Product deleted successfully!');
            loadProducts();
            loadStats();
        } catch (error: any) {
            console.error('Error deleting product:', error);
            alert(`Failed to delete product: ${error.message}`);
        }
    };

    // Edit product
    const startEditProduct = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            category: product.category,
            image_url: product.image_url,
            position_x: product.position_x.toString(),
            position_y: product.position_y.toString()
        });
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            category: '',
            image_url: '',
            position_x: '0',
            position_y: '0'
        });
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div className={styles.loginContainer}>
                <div className={styles.loginBox}>
                    <div className={styles.loginIcon}>🔐</div>
                    <h1>Admin Portal</h1>
                    <p>Secure access to dashboard</p>

                    <form onSubmit={handleLogin} className={styles.loginForm}>
                        <div className={styles.formGroup}>
                            <label>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                            />
                        </div>

                        {loginError && <div className={styles.error}>{loginError}</div>}

                        <button type="submit" className={styles.loginBtn}>
                            Login to Dashboard
                        </button>
                    </form>

                    <div className={styles.loginFooter}>
                        <p>🔒 Secure Admin Access</p>
                    </div>
                </div>
            </div>
        );
    }

    // Admin Dashboard
    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>🛍️ Admin Dashboard</h1>
                    <p>Manage your virtual shopping mall</p>
                </div>
                <button onClick={() => setIsAuthenticated(false)} className={styles.logoutBtn}>
                    Logout
                </button>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <div className={styles.statIcon}>📦</div>
                    <div className={styles.statInfo}>
                        <h3>{stats.totalProducts}</h3>
                        <p>Total Products</p>
                    </div>
                </div>
                <div className={styles.statCard} style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                    <div className={styles.statIcon}>🛒</div>
                    <div className={styles.statInfo}>
                        <h3>{stats.totalOrders}</h3>
                        <p>Total Orders</p>
                    </div>
                </div>
                <div className={styles.statCard} style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                    <div className={styles.statIcon}>💰</div>
                    <div className={styles.statInfo}>
                        <h3>${stats.totalRevenue.toFixed(2)}</h3>
                        <p>Total Revenue</p>
                    </div>
                </div>
                <div className={styles.statCard} style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                    <div className={styles.statIcon}>👥</div>
                    <div className={styles.statInfo}>
                        <h3>{stats.totalUsers}</h3>
                        <p>Total Users</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'stores' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('stores')}
                >
                    🏪 Store Management
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'orders' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    📊 Order Tracking
                </button>
            </div>

            {/* Store Management Tab */}
            {activeTab === 'stores' && (
                <>
                    {!selectedStore ? (
                        <div className={styles.storesGrid}>
                            {STORES.map(store => (
                                <div
                                    key={store.id}
                                    className={styles.storeCard}
                                    onClick={() => setSelectedStore(store.id)}
                                    style={{ borderColor: store.color }}
                                >
                                    <div className={styles.storeIcon} style={{ background: store.color }}>
                                        {store.icon}
                                    </div>
                                    <h3>{store.name}</h3>
                                    <p>Click to manage products</p>
                                    <div className={styles.storeArrow}>→</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.productManagement}>
                            <div className={styles.productHeader}>
                                <button onClick={() => setSelectedStore(null)} className={styles.backBtn}>
                                    ← Back to Stores
                                </button>
                                <h2>{STORES.find(s => s.id === selectedStore)?.name} Products</h2>
                                <div className={styles.productActions}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Search products..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={styles.searchInput}
                                    />
                                    <button onClick={() => setShowAddModal(true)} className={styles.addBtn}>
                                        ➕ Add Product
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className={styles.loading}>
                                    <div className={styles.spinner}></div>
                                    <p>Loading products...</p>
                                </div>
                            ) : (
                                <div className={styles.productsGrid}>
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className={styles.productCard}>
                                            <img src={product.image_url} alt={product.name} />
                                            <div className={styles.productInfo}>
                                                <h4>{product.name}</h4>
                                                <p className={styles.category}>{product.category}</p>
                                                <p className={styles.price}>${product.price.toFixed(2)}</p>
                                                <p className={styles.position}>Position: ({product.position_x}, {product.position_y})</p>
                                            </div>
                                            <div className={styles.productActions2}>
                                                <button onClick={() => startEditProduct(product)} className={styles.editBtn2}>
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => handleDeleteProduct(product.id, product.name)} className={styles.deleteBtn2}>
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className={styles.noProducts}>
                                            <p>📦 No products found</p>
                                            <button onClick={() => setShowAddModal(true)} className={styles.addBtn}>
                                                Add Your First Product
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className={styles.ordersSection}>
                    <h2>📊 Recent Orders</h2>
                    <div className={styles.ordersTable}>
                        {orders.length === 0 ? (
                            <div className={styles.noOrders}>
                                <p>📭 No orders yet</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Items</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id}>
                                            <td>#{order.id.slice(0, 8)}</td>
                                            <td>
                                                <div className={styles.customerInfo}>
                                                    <strong>{order.users?.username || 'Unknown'}</strong>
                                                </div>
                                            </td>
                                            <td>
                                                {Array.isArray(order.items) ? (
                                                    order.items.map((item: any, idx: number) => (
                                                        <div key={idx} className={styles.orderItem}>
                                                            {item.name} (x{item.quantity})
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={styles.orderItem}>-</div>
                                                )}
                                            </td>
                                            <td className={styles.total}>${order.total.toFixed(2)}</td>
                                            <td>
                                                <span className={`${styles.status} ${styles[order.status]}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td>{new Date(order.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {(showAddModal || editingProduct) && (
                <div className={styles.modal} onClick={() => { setShowAddModal(false); setEditingProduct(null); resetForm(); }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h2>{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</h2>

                        <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}>
                            <div className={styles.formGroup}>
                                <label>Product Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Classic White T-Shirt"
                                    required
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="29.99"
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Category *</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="e.g., Clothing"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Image URL *</label>
                                <input
                                    type="url"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                    placeholder="https://example.com/image.jpg"
                                    required
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Position X *</label>
                                    <input
                                        type="number"
                                        value={formData.position_x}
                                        onChange={(e) => setFormData({ ...formData, position_x: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Position Y *</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.position_y}
                                        onChange={(e) => setFormData({ ...formData, position_y: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="submit" className={styles.submitBtn}>
                                    {editingProduct ? 'Update Product' : 'Add Product'}
                                </button>
                                <button type="button" onClick={() => { setShowAddModal(false); setEditingProduct(null); resetForm(); }} className={styles.cancelBtn}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

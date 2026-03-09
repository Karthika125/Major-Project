import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { MallPage } from './pages/MallPage';
import { StorePage } from './pages/StorePage';
import { AdminPage } from './pages/AdminPage';
import { CreateStorePage } from './pages/CreateStorePage';
import { StoreDashboardPage } from './pages/StoreDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return user ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/mall"
                        element={
                            <ProtectedRoute>
                                <MallPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/store/:storeId"
                        element={
                            <ProtectedRoute>
                                <StorePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <ProfilePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/stores/create"
                        element={
                            <ProtectedRoute>
                                <CreateStorePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/stores/:storeId/dashboard"
                        element={
                            <ProtectedRoute>
                                <StoreDashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/" element={<Navigate to="/mall" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;

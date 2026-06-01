import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage    from './pages/LoginPage';
import Layout       from './components/Layout';
import POSPage      from './pages/POSPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import StaffPage    from './pages/StaffPage';
import ReportsPage  from './pages/ReportsPage';
import FinancePage  from './pages/FinancePage';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ── Toast ─────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0F0F1A', flexDirection:'column', gap:16, fontFamily:'sans-serif', color:'#94A3B8' }}>
      <div style={{ fontSize:52 }}>☕</div>
      <h2 style={{ color:'#E2E8F0', margin:0, fontSize:22 }}>Saudi Saver House POS</h2>
      <p style={{ margin:0, fontSize:13 }}>Starting up…</p>
      <button onClick={() => window.location.reload()} style={{ marginTop:8, padding:'9px 22px', background:'#4F46E5', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>Reload</button>
    </div>
  );
}

// ── Protected route ───────────────────────────────────────────────────────────
function AdminOnly({ children }) {
  const { user } = useContext(AppContext);
  // Must be logged in AND admin
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,     setUser]     = useState(null);
  const [toasts,   setToasts]   = useState([]);
  const [apiReady, setApiReady] = useState(false);

  // Wait for preload bridge
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (window.api || n > 50) { setApiReady(true); clearInterval(t); }
    }, 100);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message: msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const login = async (username, password) => {
    if (!window.api) return { success: false, message: 'App not ready, please wait a moment' };
    const r = await window.api.login({ username, password });
    if (!r.success) return { success: false, message: r.message };
    // Only admin and cashier are allowed — block everything else
    if (r.user.role !== 'admin' && r.user.role !== 'cashier') {
      return { success: false, message: 'Your role is not allowed to access this system.' };
    }
    setUser(r.user);
    return { success: true };
  };

  const logout = () => { setUser(null); showToast('Logged out', 'info'); };

  // Context value — useMemo so isAdmin is always fresh
  const ctx = useMemo(() => ({
    user,
    isAdmin: user?.role === 'admin',
    showToast,
    login,
    logout,
  }), [user]); // eslint-disable-line

  if (!apiReady) return <Splash />;

  return (
    <AppContext.Provider value={ctx}>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />

          {/* Authenticated layout */}
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
            <Route index element={<DashboardPage />} />
            <Route path="pos"       element={<POSPage />} />
            <Route path="inventory" element={<InventoryPage />} />

            {/* Admin-only pages */}
            <Route path="reports" element={<AdminOnly><ReportsPage /></AdminOnly>} />
            <Route path="finance" element={<AdminOnly><FinancePage /></AdminOnly>} />
            <Route path="staff"   element={<AdminOnly><StaffPage /></AdminOnly>} />
          </Route>

          <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
        </Routes>
      </HashRouter>
      <ToastContainer toasts={toasts} />
    </AppContext.Provider>
  );
}

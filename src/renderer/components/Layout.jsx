import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../App';

const CAFE = 'Saudi Saver House';

export default function Layout() {
  const { user, isAdmin, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  // Cashier only gets Dashboard + POS
  // Admin gets everything
  const navItems = [
    { to: '/',         label: 'Dashboard', icon: '📊', end: true },
    { to: '/pos',      label: 'POS Billing', icon: '🛒' },
    ...(isAdmin ? [
      { to: '/inventory', label: 'POS Inventory', icon: '📦' },
      { to: '/kitchen-inventory', label: 'Kitchen Inventory', icon: '🥘' },
      { to: '/reports',   label: 'Reports',   icon: '📈' },
      { to: '/finance',   label: 'Finance',   icon: '💰' },
      { to: '/investments', label: 'Investors', icon: '🏦' },
      { to: '/staff',     label: 'Staff',     icon: '👥' },
            { to: '/printer-settings', label: 'Printer Settings', icon: '🖨️' },
    ] : []),
  ];

  const roleColor = { admin: '#EF4444', cashier: '#10B981' };
  const rc = roleColor[user?.role] || '#4F46E5';

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:'var(--sidebar-w)', background:'var(--bg-card)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'0 10px', flexShrink:0 }}>

        {/* Logo */}
        <div style={{ padding:'20px 10px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:42, height:42, background:'linear-gradient(135deg,#4F46E5,#7C3AED)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>☕</div>
            <div>
              <div style={{ fontWeight:800, fontSize:13, lineHeight:1.2 }}>{CAFE}</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>POS System</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, paddingTop:12, overflowY:'auto' }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1, color:'var(--text-dim)', textTransform:'uppercase', padding:'0 10px 8px' }}>Menu</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 10px', borderRadius:10, marginBottom:2,
                fontSize:13, fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : 'var(--text-muted)',
                background: isActive ? 'var(--primary)' : 'transparent',
                transition:'all .15s', textDecoration:'none',
              })}
            >
              <span style={{ fontSize:17 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* Cashier hint */}
          {!isAdmin && (
            <div style={{ margin:'16px 4px 0', padding:'10px 10px', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#10B981', marginBottom:3 }}>Cashier Access</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.5 }}>You can process sales. Contact admin for inventory or reports.</div>
            </div>
          )}
        </nav>

        {/* User */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'12px 10px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${rc},${rc}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:rc, letterSpacing:'.3px' }}>{user?.role}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }} onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', background:'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}

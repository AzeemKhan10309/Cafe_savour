import React, { useState } from 'react';
import { useApp } from '../App';

const CAFE = 'Saudi Saver House';

export default function LoginPage() {
  const { login } = useApp();
  const [form,    setForm]    = useState({ username:'', password:'' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.username || !form.password) return setError('Please enter username and password');
    setLoading(true); setError('');
    const r = await login(form.username, form.password);
    if (!r.success) setError(r.message || 'Login failed');
    setLoading(false);
  };

  const onKey = e => e.key === 'Enter' && handleSubmit();

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)', backgroundImage:'radial-gradient(ellipse at 20% 50%,rgba(79,70,229,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(245,158,11,.10) 0%,transparent 60%)' }}>
      <div style={{ width:420 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:76, height:76, background:'linear-gradient(135deg,#4F46E5,#7C3AED)', borderRadius:22, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:38, boxShadow:'0 8px 32px rgba(79,70,229,.4)' }}>☕</div>
          <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px', color:'#fff', margin:0 }}>{CAFE}</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:5 }}>Point of Sale System</p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:18, padding:30, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:'var(--text)' }}>Sign in to continue</h2>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="input" placeholder="Enter your username" value={form.username} onChange={e => setForm(p => ({...p, username:e.target.value}))} onKeyDown={onKey} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" placeholder="Enter your password" value={form.password} onChange={e => setForm(p => ({...p, password:e.target.value}))} onKeyDown={onKey} />
            </div>

            {error && (
              <div style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'10px 14px', color:'var(--danger)', fontSize:13 }}>
                ⚠️ {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:4 }} onClick={handleSubmit} disabled={loading}>
              {loading ? '⏳ Signing in…' : '🔐 Sign In'}
            </button>
          </div>

 
        </div>
      </div>
    </div>
  );
}

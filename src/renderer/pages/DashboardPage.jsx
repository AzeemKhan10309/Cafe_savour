import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const fmt = v => `Rs. ${Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const fmtD = d => new Date(d).toLocaleDateString('en',{month:'short',day:'numeric'});

function KPI({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ borderColor:`${color}33`, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`${color}15` }} />
      <div style={{ fontSize:26, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:21, fontWeight:800, letterSpacing:'-0.5px', color:'#fff', fontFamily:"'JetBrains Mono',monospace", wordBreak:'break-all' }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginTop:2 }}>{label}</div>
      <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:3 }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats,    setStats]    = useState(null);
  const [chart,    setChart]    = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [days,     setDays]     = useState(14);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { window.api.getRevenueChart(days).then(setChart); }, [days]);

  async function loadAll() {
    const [s,c,tp,ls] = await Promise.all([
      window.api.getDashboardStats(),
      window.api.getRevenueChart(14),
      window.api.getTopProducts(),
      window.api.getLowStockProducts(),
    ]);
    setStats(s); setChart(c); setTopProds(tp); setLowStock(ls);
  }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.5px' }}>☕ Saudi Saver House</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>{new Date().toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>🔄 Refresh</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
        <KPI icon="💰" label="Today's Revenue"  value={fmt(stats?.todayStats?.revenue)}   sub={`vs ${fmt(stats?.ystStats?.revenue)} yesterday`} color="#4F46E5" />
        <KPI icon="🛒" label="Today's Orders"   value={stats?.todayStats?.orders||0}       sub="Transactions today"                              color="#10B981" />
        <KPI icon="📅" label="Month Revenue"    value={fmt(stats?.monthStats?.revenue)}    sub={`${stats?.monthStats?.orders||0} orders`}         color="#F59E0B" />
        <KPI icon="⚠️" label="Low Stock Alerts" value={stats?.lowStock||0}                  sub="Need restocking"                                 color={stats?.lowStock>0?'#EF4444':'#10B981'} />
        <KPI icon="💸" label="Month Expenses" value={fmt(stats?.monthExpenses)} sub="Operating costs this month" color="#EF4444" />
        <KPI icon="🏦" label="Total Invested" value={fmt(stats?.totalInvested)} sub="Capital and funding tracked" color="#06B6D4" />
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h2 style={{ fontWeight:700, fontSize:15, margin:0 }}>Revenue Trend</h2>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Daily revenue in PKR</p>
            </div>
            <select className="input" value={days} onChange={e=>setDays(+e.target.value)} style={{ width:130 }}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:'var(--text-muted)',fontSize:10}} />
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fill:'var(--text-muted)',fontSize:10}} />
              <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}} formatter={v=>[fmt(v),'Revenue']} labelFormatter={fmtD} />
              <Line type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>🏆 Top Sellers (30d)</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {topProds.slice(0,7).map((p,i) => (
              <div key={p.product_name} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:22, height:22, borderRadius:6, background: i<3?'rgba(245,158,11,.2)':'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: i<3?'var(--warning)':'var(--text-muted)', flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.product_name}</div>
                  <div style={{ height:3, background:'var(--bg)', borderRadius:2, marginTop:3 }}>
                    <div style={{ height:'100%', background:'var(--primary)', borderRadius:2, width:`${(p.total_qty/(topProds[0]?.total_qty||1))*100}%` }} />
                  </div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>{p.total_qty}</div>
              </div>
            ))}
            {topProds.length===0 && <div style={{color:'var(--text-dim)',fontSize:13}}>No sales yet</div>}
          </div>
        </div>
      </div>

      {/* Low stock */}
      {lowStock.length>0 && (
        <div className="card" style={{ borderColor:'rgba(239,68,68,.3)', background:'rgba(239,68,68,.04)' }}>
          <h2 style={{ fontWeight:700, fontSize:15, marginBottom:12, color:'var(--danger)' }}>⚠️ Low Stock Alerts ({lowStock.length})</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:9 }}>
            {lowStock.map(p=>(
              <div key={p.id} style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.category_name}</div>
                </div>
                <span className="badge badge-danger">{p.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders chart */}
      <div className="card">
        <h2 style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>📊 Daily Orders Volume</h2>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:'var(--text-muted)',fontSize:10}} />
            <YAxis tick={{fill:'var(--text-muted)',fontSize:10}} />
            <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}} />
            <Bar dataKey="orders" fill="#10B981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

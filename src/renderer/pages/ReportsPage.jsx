import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = v => `Rs. ${Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

const PRESETS = [
  { label:'Today',       get: () => { const d=new Date().toISOString().split('T')[0]; return {start:d,end:d}; } },
  { label:'Yesterday',   get: () => { const d=new Date(); d.setDate(d.getDate()-1); const s=d.toISOString().split('T')[0]; return {start:s,end:s}; } },
  { label:'Last 7 days', get: () => { const e=new Date(),s=new Date(); s.setDate(s.getDate()-7); return {start:s.toISOString().split('T')[0],end:e.toISOString().split('T')[0]}; } },
  { label:'Last 30 days',get: () => { const e=new Date(),s=new Date(); s.setDate(s.getDate()-30); return {start:s.toISOString().split('T')[0],end:e.toISOString().split('T')[0]}; } },
  { label:'This Month',  get: () => { const n=new Date(); return {start:new Date(n.getFullYear(),n.getMonth(),1).toISOString().split('T')[0],end:n.toISOString().split('T')[0]}; } },
];

export default function ReportsPage() {
  const { showToast } = useApp();
  const [preset,   setPreset]   = useState(PRESETS[2]);
  const [range,    setRange]    = useState(PRESETS[2].get());
  const [payFlt,   setPayFlt]   = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [view,     setView]     = useState('summary');

  useEffect(() => { load(); }, [range, payFlt]);

  async function load() {
    if (!range?.start) return;
    setLoading(true);
    const r = await window.api.getSalesReport({ start_date:range.start, end_date:range.end, payment_method:payFlt||undefined });
    setData(r); setLoading(false);
  }
  async function handleResetRevenue() {
   const ok = window.confirm('This will permanently clear all sales/revenue history. Continue?');
    if (!ok) return;
    const r = await window.api.resetRevenue();
    if (r?.success) {
      showToast('Revenue history reset');
      load();
    } else {
      showToast('Could not reset revenue');
    }
  }
    async function handleDeleteOrder(order) {
    const ok = window.confirm(`Delete order ${order.invoice_number}? Stock will be restored.`);
    if (!ok) return;
    const res = await window.api.deleteOrder(order.id);
    if (res?.success) {
      showToast(`Order ${order.invoice_number} deleted`);
      load();
    } else {
      showToast(res?.message || 'Could not delete order', 'error');
    }
  }


  const pickPreset = p => { setPreset(p); setRange(p.get()); };

  const prodMap = {};
  (data?.items||[]).forEach(i => {
    if (!prodMap[i.product_name]) prodMap[i.product_name] = {qty:0,revenue:0};
    prodMap[i.product_name].qty += i.quantity;
    prodMap[i.product_name].revenue += i.subtotal;
  });
  const prodData = Object.entries(prodMap).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=>({name,...d}));

  const payBreak = {};
  (data?.orders||[]).forEach(o => { payBreak[o.payment_method] = (payBreak[o.payment_method]||0)+o.total; });

  return (
    <div style={{ height:'100%', overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>Sales Reports</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>{range?.start} → {range?.end}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost" onClick={handleResetRevenue}>♻️ Reset Revenue</button>
          <button className="btn btn-ghost" onClick={async()=>{ const r=await window.api.exportPDF({start_date:range.start,end_date:range.end}); if(r?.success)showToast('PDF exported!'); }}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={async()=>{ const r=await window.api.exportExcel({start_date:range.start,end_date:range.end}); if(r?.success)showToast('Excel exported!'); }}>📊 Excel</button>
        </div>
      </div>

      {/* Presets + filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {PRESETS.map(p=>(
          <button key={p.label} className={`btn btn-sm ${preset===p?'btn-primary':'btn-ghost'}`} onClick={()=>pickPreset(p)}>{p.label}</button>
        ))}
        <input type="date" className="input" value={range?.start||''} onChange={e=>{ setPreset(null); setRange(r=>({...r,start:e.target.value})); }} style={{ width:155 }} />
        <span style={{ color:'var(--text-muted)' }}>→</span>
        <input type="date" className="input" value={range?.end||''} onChange={e=>{ setPreset(null); setRange(r=>({...r,end:e.target.value})); }} style={{ width:155 }} />
        <select className="input" value={payFlt} onChange={e=>setPayFlt(e.target.value)} style={{ width:140 }}>
          <option value="">All payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="qr">QR</option>
          <option value="split">Split</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading report…</div>
      ) : data && (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
            {[
              { label:'Orders',  val:data.orders.length,                                                                          icon:'🛒', color:'#4F46E5' },
              { label:'Revenue', val:fmt(data.totalRevenue),                                                                      icon:'💰', color:'#10B981' },
              { label:'Cost',    val:fmt(data.totalCost),                                                                         icon:'📦', color:'#F59E0B' },
              { label:'Profit',  val:fmt(data.profit),                                                                            icon:'📈', color: data.profit>=0?'#10B981':'#EF4444' },
              { label:'Margin',  val:`${data.totalRevenue>0?((data.profit/data.totalRevenue)*100).toFixed(1):0}%`,                icon:'📊', color:'#EC4899' },
            ].map(s=>(
              <div key={s.label} className="card" style={{ padding:14, borderColor:`${s.color}33` }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div style={{ fontWeight:800, fontSize:15, color:s.color, marginTop:6, fontFamily:'monospace', wordBreak:'break-all' }}>{s.val}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display:'flex', gap:8 }}>
            {['summary','orders','products'].map(v=>(
              <button key={v} className={`btn btn-sm ${view===v?'btn-primary':'btn-ghost'}`} onClick={()=>setView(v)} style={{ textTransform:'capitalize' }}>{v}</button>
            ))}
          </div>

          {view==='summary' && (
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
              <div className="card">
                <h3 style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Revenue by Product (Top 10)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={prodData.slice(0,10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fill:'var(--text-muted)',fontSize:10}} />
                    <YAxis type="category" dataKey="name" tick={{fill:'var(--text-muted)',fontSize:10}} width={110} />
                    <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}} formatter={v=>[fmt(v),'Revenue']} />
                    <Bar dataKey="revenue" fill="#4F46E5" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Payment Breakdown</h3>
                {Object.entries(payBreak).map(([method,amount])=>(
                  <div key={method} style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, fontWeight:600, textTransform:'capitalize' }}>{method==='cash'?'💵':method==='card'?'💳':method==='qr'?'📱':'⚡'} {method}</span>
                      <span style={{ fontSize:12, fontWeight:700, fontFamily:'monospace' }}>{fmt(amount)}</span>
                    </div>
                    <div style={{ height:4, background:'var(--border)', borderRadius:2 }}>
                      <div style={{ height:'100%', background:'var(--primary)', borderRadius:2, width:`${(amount/data.totalRevenue*100)||0}%` }} />
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{((amount/data.totalRevenue*100)||0).toFixed(1)}%</div>
                  </div>
                ))}
                {!Object.keys(payBreak).length && <div style={{color:'var(--text-dim)',fontSize:13}}>No data</div>}
              </div>
            </div>
          )}

          {view==='orders' && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
 <div style={{ maxHeight:'60vh', overflow:'auto' }}>
                <table className="table">
               <thead><tr><th>Invoice</th><th>Date</th><th>Staff</th><th>Payment</th><th>Total</th><th>Action</th></tr></thead>
                  <tbody>
                    {data.orders.map(o=>(
                      <tr key={o.id}>
                        <td style={{ fontFamily:'monospace', fontWeight:700, color:'var(--primary-light)' }}>{o.invoice_number}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{new Date(o.created_at).toLocaleString('en-PK')}</td>
                        <td>{o.staff_name}</td>
                        <td><span style={{ textTransform:'uppercase', fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>{o.payment_method}</span></td>
                        <td style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(o.total)}</td>
                           <td>
                          <button
                            className="btn btn-sm"
                            style={{ background:'rgba(239,68,68,.15)', color:'var(--danger)', border:'none' }}
                            onClick={() => handleDeleteOrder(o)}
                          >
                            Delete
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.orders.length && <div style={{ textAlign:'center', padding:40, color:'var(--text-dim)' }}>No orders in selected period</div>}
            </div>
          )}

          {view==='products' && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="table">
                <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>% of Total</th></tr></thead>
                <tbody>
                  {prodData.map((p,i)=>(
                    <tr key={p.name}>
                      <td style={{ color:'var(--text-dim)', fontWeight:700 }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{p.name}</td>
                      <td style={{ fontFamily:'monospace' }}>{p.qty}</td>
                      <td style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(p.revenue)}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ flex:1, height:5, background:'var(--border)', borderRadius:3 }}>
                            <div style={{ height:'100%', background:'var(--primary)', borderRadius:3, width:`${(p.revenue/(data.totalRevenue||1))*100}%` }} />
                          </div>
                          <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:34 }}>{((p.revenue/(data.totalRevenue||1))*100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!prodData.length && <div style={{ textAlign:'center', padding:40, color:'var(--text-dim)' }}>No data</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

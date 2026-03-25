import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const CAFE = { name:'Saudi Saver House', address:'Main Boulevard, Lahore, Pakistan', phone:'+92 346 6262146', footer:'Thank you for visiting Saudi Saver House!' };
const fmt  = v => `Rs. ${Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

// ── Smart Icon Function (Offline, Instant) ──
function getIcon(name = '') {
  const n = name.toLowerCase();

  // ── Main Items ──
  if (/karahi/.test(n) && /white/.test(n))         return '🍛'; // White Karahi
  if (/karahi/.test(n))                             return '🍗'; // Chicken Karahi
  if (/biryani/.test(n))                            return '🍚'; // Chicken Biryani
  if (/seekh|kabab|kebab/.test(n))                  return '🍢'; // Seekh Kabab
  if (/daal|dal/.test(n))                           return '🫕'; // Daal Mash

  // ── Qeema Items ──
  if (/qeema|kema/.test(n))                         return '🥩'; // Chicken Qeema

  // ── Handi Items ──
  if (/handi/.test(n) && /mutton/.test(n))          return '🍖'; // Mutton Handi
  if (/handi/.test(n))                              return '🫕'; // Chicken Handi / Extra Handi

  // ── Side Items ──
  if (/raita/.test(n))                              return '🥛'; // Raita
  if (/salad/.test(n))                              return '🥗'; // Green Salad
  if (/soft drink|soda|cola|pepsi|coke|sprite|7up|fanta|dew|sting/.test(n)) return '🥤'; // Soft Drink
  if (/kheera|cucumber/.test(n))                    return '🥒'; // Kheera

  // ── Drinks (extra) ──
  if (/chai|tea|kahwa/.test(n))                     return '🍵';
  if (/lassi/.test(n))                              return '🥛';
  if (/juice/.test(n))                              return '🧃';
  if (/water|pani/.test(n))                         return '💧';
  if (/shake|smoothie/.test(n))                     return '🥤';

  // ── Bread ──
  if (/naan|roti|paratha/.test(n))                  return '🫓';

  // ── Default ──
  return '🍽️';
}

function TRow({ label, value, bold, large, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
      <span style={{ fontSize:large?15:13, fontWeight:bold?700:400, color:bold?'var(--text)':'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize:large?20:14, fontWeight:bold?800:600, color:color||(bold?'#fff':'var(--text)'), fontFamily:"'JetBrains Mono',monospace" }}>
        {value<0?'- ':''}{fmt(Math.abs(value))}
      </span>
    </div>
  );
}

function Modal({ onClose, children, width=520 }) {
  return (
    <div
      onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(4px)' }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:28, width, maxWidth:'93vw', maxHeight:'90vh', overflowY:'auto' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function POSPage() {
  const { user, showToast } = useApp();
  const [products,      setProducts]     = useState([]);
  const [categories,    setCategories]   = useState([]);
  const [cart,          setCart]         = useState([]);
  const [activeCat,     setActiveCat]    = useState('all');
  const [search,        setSearch]       = useState('');
  const [discount,      setDiscount]     = useState({ value:'', type:'flat' });
  const [serviceRate,   setServiceRate]  = useState(0);
  const [vatRate,       setVatRate]      = useState('0');
  const [payMethod,     setPayMethod]    = useState('cash');
  const [splitAmt,      setSplitAmt]     = useState({ cash:'', card:'', qr:'' });
  const [cashGiven,     setCashGiven]    = useState('');
  const [notes,         setNotes]        = useState('');
  const [showCheckout,  setShowCheckout] = useState(false);
  const [processing,    setProcessing]   = useState(false);
  const [invoiceNo,     setInvoiceNo]    = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    const [p,c,inv] = await Promise.all([window.api.getProducts(), window.api.getCategories(), window.api.getNextInvoiceNumber()]);
    setProducts(p); setCategories(c); setInvoiceNo(inv);
  }

  const visible = products.filter(p => {
    const mc = activeCat==='all' || p.category_id===activeCat;
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const addToCart = p => {
    setCart(prev => {
      const ex = prev.find(i=>i.product_id===p.id);
      if (ex) return prev.map(i=>i.product_id===p.id ? {...i, quantity:i.quantity+1, subtotal:(i.quantity+1)*i.price} : i);
      return [...prev, { product_id:p.id, product_name:p.name, price:p.price, cost:p.cost, quantity:1, subtotal:p.price }];
    });
  };

  const updateQty = (id, delta) => setCart(prev => prev.map(i => {
    if (i.product_id!==id) return i;
    const q = Math.max(0, i.quantity+delta);
    return {...i, quantity:q, subtotal:q*i.price};
  }).filter(i=>i.quantity>0));

  const clearCart = () => {
    setCart([]); setDiscount({value:'',type:'flat'}); setServiceRate(0);
    setVatRate('0'); setCashGiven(''); setNotes(''); setSplitAmt({cash:'',card:'',qr:''});
  };

  // Calculations
  const subtotal       = cart.reduce((s,i)=>s+i.subtotal,0);
  const discountAmount = (() => {
    const v = parseFloat(discount.value)||0;
    if (discount.type==='percent') return Math.min(subtotal*v/100, subtotal);
    return Math.min(v, subtotal);
  })();
  const taxableBase    = Math.max(0, subtotal - discountAmount);
  const serviceAmount  = (taxableBase * serviceRate) / 100;
  const taxAmount      = (taxableBase * (parseFloat(vatRate)||0)) / 100;
  const total          = taxableBase + serviceAmount + taxAmount;
  const change         = payMethod==='cash' ? (parseFloat(cashGiven)||0)-total : 0;

  const checkout = async () => {
    if (!cart.length) return showToast('Cart is empty','error');
    if (payMethod==='split') {
      const st = Object.values(splitAmt).reduce((s,v)=>s+(parseFloat(v)||0),0);
      if (Math.abs(st-total)>1) return showToast(`Split total must equal ${fmt(total)}`,'error');
    }
    if (payMethod==='cash' && (parseFloat(cashGiven)||0)<total) return showToast('Insufficient cash','error');

    setProcessing(true);
    try {
      const r = await window.api.createOrder({
        invoice_number:invoiceNo, staff_id:user.id,
        subtotal, discount:parseFloat(discount.value)||0, discount_type:discount.type,
        tax_rate:parseFloat(vatRate)||0, tax_amount:taxAmount,
        service_rate:serviceRate, service_amount:serviceAmount,
        total,
        payment_method:payMethod,
        payment_details: payMethod==='split' ? splitAmt : (payMethod==='cash' ? {cash:cashGiven} : {}),
        notes, items:cart,
      });
      if (!r.success) throw new Error('Order failed');

      const printResult = await window.api.printReceipt({
        cafe:CAFE, invoice:invoiceNo, items:cart,
        subtotal, discount:parseFloat(discount.value)||0, discountAmount, discountType:discount.type,
        taxRate:parseFloat(vatRate)||0, taxAmount,
        serviceRate, serviceAmount,
        total,
        paymentMethod:payMethod, paymentDetails: payMethod==='split'?splitAmt:{},
        cashGiven:parseFloat(cashGiven)||0, staffName:user.name,
        date:new Date().toLocaleString('en-PK'),
      });

      const printedOnDevice     = printResult?.success && !printResult?.simulated;
      const printedInSimulation = printResult?.success &&  printResult?.simulated;
      const printFailed         = printResult && !printResult.success;

      if (printedOnDevice)          showToast(`✅ Order ${invoiceNo} complete & printed!`);
      else if (printedInSimulation) showToast(`✅ Order ${invoiceNo} complete (printer simulation mode)`);
      else if (printFailed)         showToast(`⚠️ Order saved but receipt print failed: ${printResult.message || 'Unknown printer error'}`, 'error');
      else                          showToast(`✅ Order ${invoiceNo} complete!`);

      clearCart(); setShowCheckout(false);
      setInvoiceNo(await window.api.getNextInvoiceNumber());
    } catch(e) { showToast(e.message||'Checkout failed','error'); }
    setProcessing(false);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Products ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', padding:18 }}>

        <div style={{ display:'flex', gap:12, marginBottom:12, alignItems:'center' }}>
          <input className="input" placeholder="🔍 Search products…" value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1 }} />
          <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
            Invoice: <strong style={{ color:'var(--primary-light)' }}>{invoiceNo}</strong>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', gap:7, overflowX:'auto', paddingBottom:8, marginBottom:12, flexShrink:0 }}>
          {[{id:'all',name:'All',color:'#4F46E5'},...categories].map(cat=>(
            <button key={cat.id} onClick={()=>setActiveCat(cat.id)}
              style={{ padding:'7px 16px', borderRadius:100, fontSize:12, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:activeCat===cat.id?cat.color:'var(--bg-card)', color:activeCat===cat.id?'#fff':'var(--text-muted)', border:`1px solid ${activeCat===cat.id?cat.color:'var(--border)'}`, transition:'all .15s' }}
            >{cat.name}</button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ flex:1, overflow:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
            {visible.map(p=>(
              <button key={p.id} onClick={()=>addToCart(p)}
                style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 12px', textAlign:'left', cursor:'pointer', transition:'all .15s', display:'flex', flexDirection:'column', gap:5, position:'relative', overflow:'hidden' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=p.category_color||'var(--primary)';e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}
              >
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:p.category_color||'var(--primary)' }} />
                <div style={{ fontSize:24 }}>{getIcon(p.name)}</div>
                <div style={{ fontWeight:600, fontSize:12, color:'#fff', lineHeight:1.3 }}>{p.name}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)' }}>{p.category_name}</div>
                <div style={{ fontWeight:800, fontSize:14, color:'#fff', marginTop:2 }}>{fmt(p.price)}</div>
                {p.stock<=p.low_stock_threshold&&<span style={{fontSize:9,background:'rgba(239,68,68,.2)',color:'var(--danger)',padding:'2px 5px',borderRadius:4}}>Low ({p.stock})</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cart ── */}
      <div style={{ width:360, background:'var(--bg-card)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>

        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>🛒 Current Order</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{cart.length} items</div>
          </div>
          {cart.length>0 && <button className="btn btn-ghost btn-sm" onClick={clearCart} style={{ fontSize:11 }}>Clear</button>}
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          {cart.length===0 ? (
            <div style={{ textAlign:'center', padding:'50px 20px', color:'var(--text-dim)' }}>
              <div style={{ fontSize:38, marginBottom:8 }}>🛒</div>
              <div style={{ fontSize:12 }}>Add products to start</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {cart.map(item=>(
                <div key={item.product_id} style={{ background:'var(--bg)', borderRadius:10, padding:'10px 11px', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:20, flexShrink:0 }}>{getIcon(item.product_name)}</div>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontWeight:600, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.product_name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fmt(item.price)}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <button onClick={()=>updateQty(item.product_id,-1)} style={{ width:25,height:25,borderRadius:6,background:'var(--border)',color:'var(--text)',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'none',flexShrink:0 }}>−</button>
                    <span style={{ fontWeight:700, fontSize:13, minWidth:16, textAlign:'center' }}>{item.quantity}</span>
                    <button onClick={()=>updateQty(item.product_id, 1)} style={{ width:25,height:25,borderRadius:6,background:'var(--primary)',color:'#fff',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'none',flexShrink:0 }}>+</button>
                  </div>
                  <div style={{ fontWeight:700, fontSize:12, minWidth:68, textAlign:'right' }}>{fmt(item.subtotal)}</div>
                  <button onClick={()=>setCart(p=>p.filter(i=>i.product_id!==item.product_id))} style={{ width:20,height:20,borderRadius:5,background:'rgba(239,68,68,.2)',color:'var(--danger)',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'none',flexShrink:0 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'12px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ display:'flex', gap:7 }}>
            <select className="input" value={discount.type} onChange={e=>setDiscount(p=>({...p,type:e.target.value}))} style={{ width:90, flex:'none', fontSize:12 }}>
              <option value="flat">Rs. Off</option>
              <option value="percent">% Off</option>
            </select>
            <input className="input" type="number" placeholder="Discount" value={discount.value} onChange={e=>setDiscount(p=>({...p,value:e.target.value}))} style={{ flex:1, fontSize:12 }} />
            <select className="input" value={serviceRate} onChange={e=>setServiceRate(parseInt(e.target.value,10))} style={{ width:110, flex:'none', fontSize:12 }}>
              <option value={0}>No Service</option>
              <option value={5}>Service 5%</option>
              <option value={8}>Service 8%</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:7 }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center', minWidth:58 }}>VAT Tax</label>
            <select className="input" value={vatRate} onChange={e=>setVatRate(e.target.value)} style={{ flex:1, fontSize:12 }}>
              <option value="0">No VAT</option>
              <option value="5">VAT 5%</option>
              <option value="8">VAT 8%</option>
              <option value="15">VAT 15%</option>
            </select>
          </div>
          <input className="input" placeholder="Order notes…" value={notes} onChange={e=>setNotes(e.target.value)} style={{ fontSize:12 }} />
          <div style={{ background:'var(--bg)', borderRadius:10, padding:12 }}>
            <TRow label="Subtotal" value={subtotal} />
            {discountAmount>0 && <TRow label={`Discount${discount.type==='percent'?` (${discount.value}%)`:''}` } value={-discountAmount} color="var(--success)" />}
            {serviceAmount>0 && <TRow label={`Service Charge (${serviceRate}%)`} value={serviceAmount} color="#fbbf24" />}
            {taxAmount>0 && <TRow label={`VAT (${vatRate}%)`} value={taxAmount} color="#F59E0B" />}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:7, marginTop:5 }}>
              <TRow label="TOTAL" value={total} bold large />
            </div>
          </div>
          <button className="btn btn-success btn-lg" onClick={()=>setShowCheckout(true)} disabled={!cart.length} style={{ width:'100%', justifyContent:'center', fontSize:14 }}>
            💳 Checkout {fmt(total)}
          </button>
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      {showCheckout && (
        <Modal onClose={()=>setShowCheckout(false)} width={520}>
          <h2 style={{ fontWeight:700, fontSize:20, marginBottom:18 }}>💳 Complete Payment</h2>

          <div style={{ display:'flex', gap:7, marginBottom:18 }}>
            {['cash','card','qr','split'].map(m=>(
              <button key={m} onClick={()=>setPayMethod(m)} className={`btn btn-sm ${payMethod===m?'btn-primary':'btn-ghost'}`} style={{ flex:1, justifyContent:'center', textTransform:'capitalize', fontSize:12 }}>
                {m==='cash'?'💵':m==='card'?'💳':m==='qr'?'📱':'⚡'} {m}
              </button>
            ))}
          </div>

          {payMethod==='cash' && (
            <div>
              <div className="form-group" style={{ marginBottom:12 }}>
                <label className="form-label">Cash Given (Rs.)</label>
                <input className="input" type="number" autoFocus value={cashGiven} onChange={e=>setCashGiven(e.target.value)} placeholder="0" />
              </div>
              {parseFloat(cashGiven)>0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div style={{ background:'var(--bg)', borderRadius:10, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Cash Received</div>
                    <div style={{ fontWeight:700, fontSize:16 }}>{fmt(parseFloat(cashGiven))}</div>
                  </div>
                  <div style={{ background: change>=0?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)', borderRadius:10, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{change>=0?'Change':'Short'}</div>
                    <div style={{ fontWeight:700, fontSize:16, color: change>=0?'var(--success)':'var(--danger)' }}>{fmt(Math.abs(change))}</div>
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:7, marginBottom:14 }}>
                {[...new Set([Math.ceil(total/100)*100, Math.ceil(total/500)*500, Math.ceil(total/1000)*1000, Math.ceil(total/2000)*2000])].slice(0,4).map(v=>(
                  <button key={v} className="btn btn-ghost btn-sm" onClick={()=>setCashGiven(v.toString())} style={{ flex:1, fontSize:11 }}>{fmt(v)}</button>
                ))}
              </div>
            </div>
          )}

          {payMethod==='card' && (
            <div style={{ background:'var(--bg)', borderRadius:12, padding:20, textAlign:'center', marginBottom:14 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>💳</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Process card on terminal</div>
              <div style={{ fontWeight:800, fontSize:22, marginTop:8 }}>{fmt(total)}</div>
            </div>
          )}

          {payMethod==='qr' && (
            <div style={{ background:'var(--bg)', borderRadius:12, padding:20, textAlign:'center', marginBottom:14 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📱</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Scan QR code to pay</div>
              <div style={{ fontWeight:800, fontSize:22, marginTop:8 }}>{fmt(total)}</div>
            </div>
          )}

          {payMethod==='split' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {['cash','card','qr'].map(m=>(
                <div key={m} className="form-group">
                  <label className="form-label">{m.toUpperCase()} Amount (Rs.)</label>
                  <input className="input" type="number" value={splitAmt[m]} onChange={e=>setSplitAmt(p=>({...p,[m]:e.target.value}))} placeholder="0" />
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, background:'var(--bg)', padding:'8px 12px', borderRadius:8 }}>
                <span style={{ color:'var(--text-muted)' }}>Split Total:</span>
                <span style={{ fontWeight:700, color: Math.abs(Object.values(splitAmt).reduce((s,v)=>s+(parseFloat(v)||0),0)-total)<1?'var(--success)':'var(--danger)' }}>
                  {fmt(Object.values(splitAmt).reduce((s,v)=>s+(parseFloat(v)||0),0))} / {fmt(total)}
                </span>
              </div>
            </div>
          )}

          <div style={{ background:'var(--bg)', borderRadius:10, padding:12, marginBottom:18 }}>
            <TRow label="Subtotal" value={subtotal} />
            {discountAmount>0 && <TRow label="Discount" value={-discountAmount} color="var(--success)" />}
            {serviceAmount>0 && <TRow label={`Service Charge (${serviceRate}%)`} value={serviceAmount} color="#fbbf24" />}
            {taxAmount>0 && <TRow label={`VAT (${vatRate}%)`} value={taxAmount} color="#F59E0B" />}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:7, marginTop:7 }}>
              <TRow label="TOTAL DUE" value={total} bold large />
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={()=>setShowCheckout(false)}>Cancel</button>
            <button className="btn btn-success" style={{ flex:2, justifyContent:'center', fontSize:15 }} onClick={checkout} disabled={processing}>
              {processing ? '⏳ Processing…' : '✅ Complete Order'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
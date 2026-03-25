import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const COLORS = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#8B5CF6','#06B6D4'];
const fmt = v => `Rs. ${Number(v||0).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

/* ── Modal wrapper — stops click bubbling to overlay ── */
function Modal({ onClose, children, width = 500 }) {
  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
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

/* ── Product modal ── */
function ProductModal({ product, categories, onSave, onClose }) {
  const blank = { name:'', category_id:'', price:'', cost:'', stock:'', low_stock_threshold:5, description:'' };
  const [f, setF] = useState(product ? {...product} : blank);
  const s = (k,v) => setF(p => ({...p,[k]:v}));

  return (
    <Modal onClose={onClose} width={500}>
      <h2 style={{ fontWeight:700, fontSize:20, marginBottom:20 }}>{product ? '✏️ Edit Product' : '➕ Add Product'}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        <div className="form-group">
          <label className="form-label">Product Name *</label>
          <input className="input" autoFocus value={f.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Cappuccino" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="input" value={f.category_id} onChange={e=>s('category_id',parseInt(e.target.value)||'')}>
              <option value="">Select category</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Selling Price (Rs.) *</label>
            <input className="input" type="number" min="0" value={f.price} onChange={e=>s('price',e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Cost Price (Rs.)</label>
            <input className="input" type="number" min="0" value={f.cost} onChange={e=>s('cost',e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Stock (units)</label>
            <input className="input" type="number" min="0" value={f.stock} onChange={e=>s('stock',e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Low Stock Alert Threshold</label>
          <input className="input" type="number" min="0" value={f.low_stock_threshold} onChange={e=>s('low_stock_threshold',e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="input" value={f.description} onChange={e=>s('description',e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginTop:24 }}>
        <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }}
          onClick={() => {
            if (!f.name.trim() || !f.price) return;
            onSave({...f, price:parseFloat(f.price), cost:parseFloat(f.cost)||0, stock:parseInt(f.stock)||0, low_stock_threshold:parseInt(f.low_stock_threshold)||5});
          }}>
          {product ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </Modal>
  );
}

/* ── Category modal ── */
function CategoryModal({ onSave, onClose }) {
  const [f, setF] = useState({ name:'', color:COLORS[0] });
  return (
    <Modal onClose={onClose} width={400}>
      <h2 style={{ fontWeight:700, fontSize:20, marginBottom:20 }}>➕ Add Category</h2>

      <div className="form-group" style={{ marginBottom:16 }}>
        <label className="form-label">Category Name *</label>
        <input className="input" autoFocus value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="e.g. Juices" />
      </div>

      <div className="form-group" style={{ marginBottom:24 }}>
        <label className="form-label">Colour</label>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:4 }}>
          {COLORS.map(c=>(
            <button key={c} onClick={()=>setF(p=>({...p,color:c}))}
              style={{ width:38, height:38, borderRadius:10, background:c, cursor:'pointer', border: f.color===c ? '3px solid #fff' : '3px solid transparent', outline: f.color===c ? `2px solid ${c}` : 'none', transition:'all .15s' }}
            />
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:12 }}>
        <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }}
          onClick={() => f.name.trim() && onSave(f)}>
          Add Category
        </button>
      </div>
    </Modal>
  );
}

/* ── Main page ── */
export default function InventoryPage() {
  const { showToast, isAdmin } = useApp();

  const [products,       setProducts]       = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [filterCat,      setFilterCat]      = useState('all');
  const [search,         setSearch]         = useState('');
  const [showAddProd,    setShowAddProd]     = useState(false);
  const [showAddCat,     setShowAddCat]      = useState(false);
  const [editProd,       setEditProd]        = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [p, c] = await Promise.all([window.api.getProducts(), window.api.getCategories()]);
    setProducts(p); setCategories(c);
  }

  // ── handlers ──
  const saveProduct = async data => {
    if (data.id) await window.api.updateProduct(data); else await window.api.createProduct(data);
    showToast(data.id ? 'Product updated ✓' : 'Product added ✓');
    setShowAddProd(false); setEditProd(null); load();
  };

  const deleteProduct = async id => {
    if (!confirm('Delete this product?')) return;
    try {
      const result = await window.api.deleteProduct(id);
      if (result?.success === false) {
        showToast(result.message || 'Failed to delete product', 'error');
        return;
      }

      showToast('Product deleted', 'info');
      await load();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to delete product', 'error');
    }
  };

  const saveCategory = async data => {
    await window.api.createCategory(data); showToast('Category added ✓');
    setShowAddCat(false); load();
  };

const deleteCategory = async (cat) => {
  if (!confirm(`Delete category "${cat.name}"?`)) return;

  try {
    await window.api.deleteCategory(cat.id);
    showToast('Category deleted ✓', 'info');

    // Remove category immediately from state
    setCategories(prev => prev.filter(c => c.id !== cat.id));

    // Optional: reload products if you want fresh data
    load();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to delete category', 'error');
  }
};

  // ── filtered list ──
  const filtered = products.filter(p => {
    const mc = filterCat==='all' || p.category_id===filterCat;
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const stockBadge = p => {
    if (p.stock===0)                         return { label:'Out of stock', color:'var(--danger)',  bg:'rgba(239,68,68,.2)' };
    if (p.stock<=p.low_stock_threshold)      return { label:'Low stock',    color:'var(--warning)', bg:'rgba(245,158,11,.2)' };
    return { label:'In stock', color:'var(--success)', bg:'rgba(16,185,129,.2)' };
  };

  const inventoryValue = products.reduce((sum, p) => {
    const stock = Number(p.stock) || 0;
    const cost = Number(p.cost) || 0;
    const price = Number(p.price) || 0;
    const unitValue = cost > 0 ? cost : price;
    return sum + Math.max(0, stock) * Math.max(0, unitValue);
  }, 0);
  // ── render ──
  return (
    <div style={{ height:'100%', overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>Inventory</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14 }}>
            {products.length} products · {categories.length} categories
            {!isAdmin && <span style={{ color:'var(--warning)', marginLeft:10 }}>👁 View only (cashier)</span>}
          </p>
        </div>
        {/* Admin buttons only */}
        {isAdmin && (
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-ghost" onClick={() => setShowAddCat(true)}>+ Category</button>
            <button className="btn btn-primary" onClick={() => { setEditProd(null); setShowAddProd(true); }}>+ Add Product</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { icon:'📦', label:'Total Products',  val: products.length },
          { icon:'⚠️', label:'Low Stock',        val: products.filter(p=>p.stock>0&&p.stock<=p.low_stock_threshold).length },
          { icon:'🚫', label:'Out of Stock',     val: products.filter(p=>p.stock===0).length },
          { icon:'💰', label:'Inventory Value',  val: fmt(inventoryValue) },
        ].map(s=>(
          <div key={s.label} className="card" style={{ padding:14, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:18 }}>{s.val}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Categories row ── */}
      <div className="card" style={{ padding:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ fontWeight:700, fontSize:14, margin:0 }}>Categories</h3>
          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCat(true)}>+ Add Category</button>}
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {/* All filter */}
          <button
            onClick={() => setFilterCat('all')}
            style={{ padding:'6px 14px', borderRadius:100, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background: filterCat==='all' ? '#4F46E5' : 'var(--bg)', color: filterCat==='all' ? '#fff' : 'var(--text-muted)', transition:'all .15s' }}
          >All ({products.length})</button>

          {categories.map(cat => (
            <div key={cat.id} style={{ display:'flex', alignItems:'center', borderRadius:100, overflow:'hidden', border:`1px solid ${cat.color}44`, background:'var(--bg)' }}>
              {/* Filter button */}
              <button
                onClick={() => setFilterCat(filterCat===cat.id ? 'all' : cat.id)}
                style={{
                  display:'flex', alignItems:'center', gap:7,
                  padding:'6px 12px', border:'none', cursor:'pointer',
                  background: filterCat===cat.id ? cat.color : 'transparent',
                  color: filterCat===cat.id ? '#fff' : 'var(--text-muted)',
                  fontSize:13, fontWeight:600, transition:'all .15s',
                }}
              >
                <span style={{ width:8, height:8, borderRadius:'50%', background: filterCat===cat.id ? '#fff' : cat.color, flexShrink:0 }} />
                {cat.name} ({products.filter(p=>p.category_id===cat.id).length})
              </button>

              {/* ── DELETE CATEGORY BUTTON — admin only ── */}
              {isAdmin && (
                <button
                  onClick={() => deleteCategory(cat)}
                  title={`Delete "${cat.name}"`}
                  style={{
                    width:28, height:'100%', minHeight:32,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(239,68,68,.18)', color:'var(--danger)',
                    border:'none', borderLeft:'1px solid var(--border)',
                    cursor:'pointer', fontSize:16, fontWeight:700,
                    transition:'background .15s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,.35)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,.18)'}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {categories.length===0 && <span style={{ color:'var(--text-dim)', fontSize:13 }}>No categories yet</span>}
        </div>
      </div>

      {/* Search */}
      <input className="input" placeholder="🔍 Search products…" value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:340 }} />

      {/* ── Products table ── */}
      <div className="card" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column', flex:1, minHeight:260 }}>
        <div style={{ overflow:'auto', minHeight:0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                {isAdmin && <th>Cost</th>}
                {isAdmin && <th>Margin</th>}
                <th>Stock</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const badge  = stockBadge(p);
                const margin = p.price>0 ? ((p.price-p.cost)/p.price*100).toFixed(0) : 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight:600 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{p.description}</div>}
                    </td>
                    <td>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:p.category_color, flexShrink:0 }} />
                        {p.category_name}
                      </span>
                    </td>
                    <td><span style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(p.price)}</span></td>
                    {isAdmin && <td><span style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmt(p.cost)}</span></td>}
                    {isAdmin && (
                      <td>
                        <span style={{ color: margin>50?'var(--success)':margin>30?'var(--warning)':'var(--danger)', fontWeight:600 }}>{margin}%</span>
                      </td>
                    )}
                    <td><span style={{ fontFamily:'monospace', fontWeight:700 }}>{p.stock}</span></td>
                    <td>
                      <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background:badge.bg, color:badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditProd(p); setShowAddProd(true); }}>Edit</button>
                          <button className="btn btn-sm" onClick={() => deleteProduct(p.id)} style={{ background:'rgba(239,68,68,.15)', color:'var(--danger)', border:'none' }}>Del</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <div style={{ textAlign:'center', padding:48, color:'var(--text-dim)' }}>No products found</div>}
      </div>

      {/* Modals — admin only */}
      {isAdmin && showAddProd && (
        <ProductModal product={editProd} categories={categories} onSave={saveProduct} onClose={() => { setShowAddProd(false); setEditProd(null); }} />
      )}
      {isAdmin && showAddCat && (
        <CategoryModal onSave={saveCategory} onClose={() => setShowAddCat(false)} />
      )}
    </div>
  );
}
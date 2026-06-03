import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';

const fmt = (v) => `Rs. ${Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const qty = (v) => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });
const today = () => new Date().toISOString().split('T')[0];
const emptyLine = { ingredient_id: '', quantity: '', unit: '', unit_cost: '' };
const tabs = [
  ['dashboard', 'Dashboard', '📊'], ['stock', 'Stock', '🥫'], ['purchases', 'Purchases', '🧾'],
  ['vouchers', 'Issue Vouchers', '📤'], ['recipes', 'Recipes', '🍔'], ['waste', 'Waste', '🗑️'],
  ['reports', 'Reports', '📈'], ['audit', 'Audit Logs', '🧭'],
];

function StatCard({ icon, label, value, tone = 'var(--primary-light)' }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${tone}22`, fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 22 }}>{value}</div>
      </div>
    </div>
  );
}

function LineItems({ lines, setLines, ingredients, showCost = false }) {
  const update = (idx, patch) => setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map((line, idx) => {
        const ing = ingredients.find((i) => String(i.id) === String(line.ingredient_id));
        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: showCost ? '1.6fr .8fr .7fr .8fr 38px' : '1.6fr .8fr .7fr 38px', gap: 8 }}>
            <select className="input" value={line.ingredient_id} onChange={(e) => update(idx, { ingredient_id: e.target.value, unit: ingredients.find((i) => String(i.id) === e.target.value)?.unit || '' })}>
              <option value="">Select ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({qty(i.current_stock)} {i.unit})</option>)}
            </select>
            <input className="input" type="number" min="0" step="0.001" placeholder="Qty" value={line.quantity} onChange={(e) => update(idx, { quantity: e.target.value })} />
            <input className="input" placeholder="Unit" value={line.unit || ing?.unit || ''} onChange={(e) => update(idx, { unit: e.target.value })} />
            {showCost && <input className="input" type="number" min="0" step="0.01" placeholder="Unit cost" value={line.unit_cost} onChange={(e) => update(idx, { unit_cost: e.target.value })} />}
            <button className="btn btn-ghost btn-sm" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>×</button>
          </div>
        );
      })}
      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}>+ Add ingredient line</button>
    </div>
  );
}

export default function KitchenInventoryPage() {
  const { user, showToast } = useApp();
  const [active, setActive] = useState('dashboard');
  const [ingredients, setIngredients] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [waste, setWaste] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [reports, setReports] = useState(null);
  const [audit, setAudit] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [stockForm, setStockForm] = useState({ name: '', category: 'Raw Material', unit: 'KG', current_stock: 0, low_stock_threshold: 0, cost_per_unit: 0, supplier: '', notes: '' });
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({ purchase_date: today(), supplier: '', invoice_number: '', notes: '' });
  const [purchaseLines, setPurchaseLines] = useState([{ ...emptyLine }]);
  const [voucherForm, setVoucherForm] = useState({ issued_by: user?.name || '', received_by: '', department: 'Kitchen', notes: '', approval_status: 'pending' });
  const [voucherLines, setVoucherLines] = useState([{ ...emptyLine }]);
  const [wasteForm, setWasteForm] = useState({ ingredient_id: '', quantity: '', unit: '', reason: '', reported_by: user?.name || '', notes: '' });
  const [recipeForm, setRecipeForm] = useState({ product_id: '', name: '', notes: '' });
  const [recipeLines, setRecipeLines] = useState([{ ...emptyLine }]);

  async function loadAll() {
    const [dash, ing, pur, vou, was, rec, prod, rep, aud, mov] = await Promise.all([
      window.api.getKitchenDashboard(), window.api.getKitchenIngredients(), window.api.getKitchenPurchases({}),
      window.api.getKitchenVouchers({}), window.api.getKitchenWaste({}), window.api.getKitchenRecipes(),
      window.api.getProducts(), window.api.getKitchenReports({}), window.api.getKitchenAuditLogs({ limit: 100 }),
      window.api.getKitchenMovements({ limit: 100 }),
    ]);
    setDashboard(dash); setIngredients(ing); setPurchases(pur); setVouchers(vou); setWaste(was); setRecipes(rec); setProducts(prod); setReports(rep); setAudit(aud); setMovements(mov);
  }

  useEffect(() => { loadAll().catch((e) => showToast(e.message || 'Failed to load kitchen inventory', 'error')); }, []); // eslint-disable-line

  const filteredIngredients = useMemo(() => ingredients.filter((i) => !search || `${i.name} ${i.category}`.toLowerCase().includes(search.toLowerCase())), [ingredients, search]);

  async function saveIngredient() {
    try {
      const payload = { ...(editingIngredient || {}), ...stockForm, actor: user?.name };
      if (editingIngredient) await window.api.updateKitchenIngredient(payload); else await window.api.createKitchenIngredient(payload);
      showToast(editingIngredient ? 'Ingredient updated ✓' : 'Ingredient added ✓');
      setEditingIngredient(null); setStockForm({ name: '', category: 'Raw Material', unit: 'KG', current_stock: 0, low_stock_threshold: 0, cost_per_unit: 0, supplier: '', notes: '' });
      await loadAll();
    } catch (e) { showToast(e.message || 'Could not save ingredient', 'error'); }
  }

  async function savePurchase() {
    try {
      await window.api.createKitchenPurchase({ ...purchaseForm, actor: user?.name, items: purchaseLines.filter((l) => l.ingredient_id && Number(l.quantity) > 0) });
      showToast('Purchase saved and stock increased ✓');
      setPurchaseForm({ purchase_date: today(), supplier: '', invoice_number: '', notes: '' }); setPurchaseLines([{ ...emptyLine }]); await loadAll();
    } catch (e) { showToast(e.message || 'Could not save purchase', 'error'); }
  }

  async function saveVoucher() {
    try {
      await window.api.createKitchenVoucher({ ...voucherForm, actor: user?.name, approved_by: user?.name, items: voucherLines.filter((l) => l.ingredient_id && Number(l.quantity) > 0) });
      showToast(voucherForm.approval_status === 'approved' ? 'Voucher approved and stock deducted ✓' : 'Voucher saved pending approval ✓');
      setVoucherForm({ issued_by: user?.name || '', received_by: '', department: 'Kitchen', notes: '', approval_status: 'pending' }); setVoucherLines([{ ...emptyLine }]); await loadAll();
    } catch (e) { showToast(e.message || 'Could not save voucher', 'error'); }
  }

  async function approveVoucher(id) {
    try { await window.api.approveKitchenVoucher({ id, actor: user?.name }); showToast('Voucher approved and stock deducted ✓'); await loadAll(); }
    catch (e) { showToast(e.message || 'Could not approve voucher', 'error'); }
  }

  async function saveWaste() {
    try {
      await window.api.createKitchenWaste({ ...wasteForm, actor: user?.name });
      showToast('Waste recorded and stock deducted ✓');
      setWasteForm({ ingredient_id: '', quantity: '', unit: '', reason: '', reported_by: user?.name || '', notes: '' }); await loadAll();
    } catch (e) { showToast(e.message || 'Could not record waste', 'error'); }
  }

  async function saveRecipe() {
    try {
      await window.api.saveKitchenRecipe({ ...recipeForm, actor: user?.name, items: recipeLines.filter((l) => l.ingredient_id && Number(l.quantity) > 0) });
      showToast('Recipe saved. Future completed POS orders will auto-deduct ingredients ✓');
      setRecipeForm({ product_id: '', name: '', notes: '' }); setRecipeLines([{ ...emptyLine }]); await loadAll();
    } catch (e) { showToast(e.message || 'Could not save recipe', 'error'); }
  }

  const startEditIngredient = (ingredient) => {
    setEditingIngredient(ingredient);
    setStockForm({ name: ingredient.name, category: ingredient.category, unit: ingredient.unit, current_stock: ingredient.current_stock, low_stock_threshold: ingredient.low_stock_threshold, cost_per_unit: ingredient.cost_per_unit, supplier: ingredient.supplier, notes: ingredient.notes });
    setActive('stock');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>🥘 Kitchen Inventory Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Separate raw-material stock, purchases, internal issue vouchers, recipes, waste, reports, and audit trail.</p>
        </div>
        <button className="btn btn-ghost" onClick={loadAll}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(([key, label, icon]) => <button key={key} className={`btn ${active === key ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActive(key)}>{icon} {label}</button>)}
      </div>

      {active === 'dashboard' && dashboard && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            <StatCard icon="🥫" label="Ingredients" value={dashboard.totalIngredients} />
            <StatCard icon="⚠️" label="Low Stock" value={dashboard.lowStock} tone="var(--warning)" />
            <StatCard icon="💰" label="Stock Value" value={fmt(dashboard.stockValue)} tone="var(--success)" />
            <StatCard icon="📤" label="Pending Vouchers" value={dashboard.pendingVouchers} tone="var(--danger)" />
            <StatCard icon="🧾" label="Month Purchases" value={fmt(dashboard.monthPurchases)} tone="var(--info)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
            <div className="card"><h3>Low Stock Alerts</h3><KitchenStockTable rows={dashboard.lowStockItems} compact /></div>
            <div className="card"><h3>Recent Stock Movements</h3><MovementTable rows={dashboard.recentMovements} /></div>
          </div>
        </>
      )}

      {active === 'stock' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}</h3>
            {['name', 'category', 'unit', 'supplier'].map((field) => <input key={field} className="input" placeholder={field.replace('_', ' ')} value={stockForm[field] || ''} onChange={(e) => setStockForm((p) => ({ ...p, [field]: e.target.value }))} />)}
            {!editingIngredient && <input className="input" type="number" step="0.001" placeholder="Opening stock" value={stockForm.current_stock} onChange={(e) => setStockForm((p) => ({ ...p, current_stock: e.target.value }))} />}
            <input className="input" type="number" step="0.001" placeholder="Low stock threshold" value={stockForm.low_stock_threshold} onChange={(e) => setStockForm((p) => ({ ...p, low_stock_threshold: e.target.value }))} />
            <input className="input" type="number" step="0.01" placeholder="Cost per unit" value={stockForm.cost_per_unit} onChange={(e) => setStockForm((p) => ({ ...p, cost_per_unit: e.target.value }))} />
            <textarea className="input" placeholder="Notes" value={stockForm.notes || ''} onChange={(e) => setStockForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-primary" onClick={saveIngredient}>{editingIngredient ? 'Save Changes' : '+ Add Ingredient'}</button>
            {editingIngredient && <button className="btn btn-ghost" onClick={() => setEditingIngredient(null)}>Cancel Edit</button>}
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}><h3>Kitchen Stock</h3><input className="input" style={{ maxWidth: 280 }} placeholder="Search ingredients" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <KitchenStockTable rows={filteredIngredients} onEdit={startEditIngredient} />
          </div>
        </div>
      )}

      {active === 'purchases' && (
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h3>New Purchase</h3>
            <input className="input" type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm((p) => ({ ...p, purchase_date: e.target.value }))} />
            <input className="input" placeholder="Supplier" value={purchaseForm.supplier} onChange={(e) => setPurchaseForm((p) => ({ ...p, supplier: e.target.value }))} />
            <input className="input" placeholder="Supplier invoice #" value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm((p) => ({ ...p, invoice_number: e.target.value }))} />
            <LineItems lines={purchaseLines} setLines={setPurchaseLines} ingredients={ingredients} showCost />
            <textarea className="input" placeholder="Notes" value={purchaseForm.notes} onChange={(e) => setPurchaseForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-primary" onClick={savePurchase}>Save Purchase & Increase Stock</button>
          </div>
          <div className="card"><h3>Purchase Report</h3><PurchaseTable rows={purchases} /></div>
        </div>
      )}

      {active === 'vouchers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h3>Internal Issue Voucher</h3>
            {['issued_by', 'received_by', 'department'].map((f) => <input key={f} className="input" placeholder={f.replace('_', ' ')} value={voucherForm[f]} onChange={(e) => setVoucherForm((p) => ({ ...p, [f]: e.target.value }))} />)}
            <select className="input" value={voucherForm.approval_status} onChange={(e) => setVoucherForm((p) => ({ ...p, approval_status: e.target.value }))}><option value="pending">Pending Approval</option><option value="approved">Approve Immediately</option></select>
            <LineItems lines={voucherLines} setLines={setVoucherLines} ingredients={ingredients} />
            <textarea className="input" placeholder="Notes" value={voucherForm.notes} onChange={(e) => setVoucherForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-primary" onClick={saveVoucher}>Save Voucher</button>
          </div>
          <div className="card"><h3>Internal Issue Report</h3><VoucherTable rows={vouchers} onApprove={approveVoucher} /></div>
        </div>
      )}

      {active === 'recipes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h3>Recipe Management</h3>
            <select className="input" value={recipeForm.product_id} onChange={(e) => setRecipeForm((p) => ({ ...p, product_id: e.target.value, name: products.find((prod) => String(prod.id) === e.target.value)?.name || p.name }))}><option value="">Select POS product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input className="input" placeholder="Recipe name" value={recipeForm.name} onChange={(e) => setRecipeForm((p) => ({ ...p, name: e.target.value }))} />
            <LineItems lines={recipeLines} setLines={setRecipeLines} ingredients={ingredients} />
            <textarea className="input" placeholder="Notes" value={recipeForm.notes} onChange={(e) => setRecipeForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-primary" onClick={saveRecipe}>Save Recipe</button>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>When this POS product is sold, recipe ingredients are deducted automatically after order completion.</p>
          </div>
          <div className="card"><h3>Recipe Deduction Setup</h3><RecipeTable rows={recipes} /></div>
        </div>
      )}

      {active === 'waste' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h3>Record Waste</h3>
            <select className="input" value={wasteForm.ingredient_id} onChange={(e) => { const ing = ingredients.find((i) => String(i.id) === e.target.value); setWasteForm((p) => ({ ...p, ingredient_id: e.target.value, unit: ing?.unit || '' })); }}><option value="">Select ingredient</option>{ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <input className="input" type="number" step="0.001" placeholder="Quantity" value={wasteForm.quantity} onChange={(e) => setWasteForm((p) => ({ ...p, quantity: e.target.value }))} />
            <input className="input" placeholder="Unit" value={wasteForm.unit} onChange={(e) => setWasteForm((p) => ({ ...p, unit: e.target.value }))} />
            <input className="input" placeholder="Reason" value={wasteForm.reason} onChange={(e) => setWasteForm((p) => ({ ...p, reason: e.target.value }))} />
            <input className="input" placeholder="Reported by" value={wasteForm.reported_by} onChange={(e) => setWasteForm((p) => ({ ...p, reported_by: e.target.value }))} />
            <textarea className="input" placeholder="Notes" value={wasteForm.notes} onChange={(e) => setWasteForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-danger" onClick={saveWaste}>Record Waste & Deduct Stock</button>
          </div>
          <div className="card"><h3>Waste Report</h3><WasteTable rows={waste} /></div>
        </div>
      )}

      {active === 'reports' && reports && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            <div className="card"><h3>Kitchen Stock Report</h3><KitchenStockTable rows={reports.stock} compact /></div>
            <div className="card"><h3>Low Stock Report</h3><KitchenStockTable rows={reports.lowStock} compact /></div>
          </div>
          <div className="card"><h3>Ingredient Usage Report</h3><UsageTable rows={reports.usage} /></div>
          <div className="card"><h3>Consumption Tracking</h3><MovementTable rows={movements.filter((m) => ['issue', 'recipe_deduction', 'waste'].includes(m.movement_type))} /></div>
        </div>
      )}

      {active === 'audit' && <div className="card"><h3>Kitchen Audit Logs</h3><AuditTable rows={audit} /></div>}
    </div>
  );
}

function KitchenStockTable({ rows, onEdit, compact = false }) {
  return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>Ingredient</th><th>Category</th><th>Stock</th><th>Low At</th>{!compact && <th>Cost</th>}{onEdit && <th></th>}</tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.category}</td><td><span className={r.current_stock <= r.low_stock_threshold ? 'badge badge-warning' : 'badge badge-success'}>{qty(r.current_stock)} {r.unit}</span></td><td>{qty(r.low_stock_threshold)} {r.unit}</td>{!compact && <td>{fmt(r.cost_per_unit)}</td>}{onEdit && <td><button className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}>Edit</button></td>}</tr>)}</tbody></table></div>;
}
function MovementTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>Date</th><th>Ingredient</th><th>Type</th><th>Qty</th><th>Before → After</th><th>Ref</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.ingredient_name}</td><td><span className="badge badge-primary">{r.movement_type}</span></td><td>{qty(r.quantity)} {r.unit}</td><td>{qty(r.stock_before)} → {qty(r.stock_after)}</td><td>{r.reference_type} #{r.reference_id}</td></tr>)}</tbody></table></div>; }
function PurchaseTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.purchase_number}</td><td>{r.purchase_date}</td><td>{r.supplier}</td><td>{r.items.map((i) => `${i.ingredient_name}: ${qty(i.quantity)} ${i.unit}`).join(', ')}</td><td>{fmt(r.total_amount)}</td></tr>)}</tbody></table></div>; }
function VoucherTable({ rows, onApprove }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>Voucher</th><th>Date/Time</th><th>Issued By</th><th>Received By</th><th>Department</th><th>Items</th><th>Status</th><th>Print</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.voucher_number}</td><td>{new Date(r.issued_at).toLocaleString()}</td><td>{r.issued_by}</td><td>{r.received_by}</td><td>{r.department}</td><td>{r.items.map((i) => `${i.ingredient_name}: ${qty(i.quantity)} ${i.unit}`).join(', ')}</td><td>{r.approval_status === 'approved' ? <span className="badge badge-success">Approved</span> : <button className="btn btn-primary btn-sm" onClick={() => onApprove(r.id)}>Approve</button>}</td><td><button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print</button></td></tr>)}</tbody></table></div>; }
function RecipeTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>POS Product</th><th>Recipe</th><th>Ingredients per Sale</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.product_name}</td><td>{r.name}</td><td>{r.items.map((i) => `${i.ingredient_name} = ${qty(i.quantity)} ${i.unit}`).join(', ')}</td></tr>)}</tbody></table></div>; }
function WasteTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>#</th><th>Date</th><th>Ingredient</th><th>Qty</th><th>Reason</th><th>By</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.waste_number}</td><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.ingredient_name}</td><td>{qty(r.quantity)} {r.unit}</td><td>{r.reason}</td><td>{r.reported_by}</td></tr>)}</tbody></table></div>; }
function UsageTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>Ingredient</th><th>Movement</th><th>Total Quantity</th></tr></thead><tbody>{rows.map((r, idx) => <tr key={idx}><td>{r.ingredient_name}</td><td>{r.movement_type}</td><td>{qty(r.quantity)} {r.unit}</td></tr>)}</tbody></table></div>; }
function AuditTable({ rows }) { return <div style={{ overflow: 'auto' }}><table className="table"><thead><tr><th>Date</th><th>Action</th><th>Entity</th><th>Actor</th><th>Details</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.action}</td><td>{r.entity_type} #{r.entity_id}</td><td>{r.actor}</td><td style={{ maxWidth: 520, whiteSpace: 'normal' }}>{r.details}</td></tr>)}</tbody></table></div>; }
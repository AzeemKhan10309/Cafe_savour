import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';

const fmt = v => `Rs. ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().split('T')[0];
const startOfMonth = () => `${today().slice(0, 7)}-01`;
const investmentTypes = [
  { value: 'owner', label: 'Owner investment' },
  { value: 'external', label: 'External investor' },
  { value: 'loan', label: 'Loan' },
];

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ borderColor: `${color}33`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 19, fontFamily: 'monospace', color: '#fff' }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ExpenseListView({ expenses, categories, onEdit, onDelete, fmt }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const sorted = useMemo(() => [...expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)), [expenses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map(e => {
        const cat = catMap[e.category_id] || {};
        return (
          <div key={e.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color || '#64748B'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {cat.icon || '📄'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{e.item_name}</span>
                <span className="badge" style={{ color: cat.color || '#94A3B8', background: `${cat.color || '#94A3B8'}22`, fontSize: 11, fontWeight: 700 }}>{cat.name || 'Uncategorized'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{e.expense_date}</span>
                {e.notes && <span style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: '#fff' }}>{fmt(e.amount)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(e)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}
      {!sorted.length && (
        <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)' }}>
          No expenses for the selected period.
        </div>
      )}
    </div>
  );
}

function ExpenseModal({ expense, categories, onSave, onClose }) {
  const [form, setForm] = useState(expense || { item_name: '', amount: '', category_id: categories[0]?.id || '', expense_date: today(), notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal title={expense ? '✏️ Edit Expense' : '➕ Add Expense'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label className="form-label">Item name *</label><input className="input" autoFocus value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Meat, electricity bill" /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Cost amount *</label><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Category *</label><select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="form-group"><label className="form-label">Date *</label><input className="input" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="input" rows="3" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional details" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => onSave({ ...form, amount: parseFloat(form.amount), category_id: parseInt(form.category_id, 10) })}>{expense ? 'Update Expense' : 'Save Expense'}</button>
      </div>
    </Modal>
  );
}

function InvestmentModal({ investment, investors, onSave, onClose }) {
  const [form, setForm] = useState(investment || { investor_id: investors[0]?.id || '', amount: '', investment_date: today(), payment_method: 'cash', type: 'external', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal title={investment ? '✏️ Edit Investment' : '➕ Add Investment'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
<div className="form-group"><label className="form-label">Investor *</label><select className="input" autoFocus value={form.investor_id || ''} onChange={e => set('investor_id', e.target.value)}>{investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}</select></div>        <div className="form-row">
          <div className="form-group"><label className="form-label">Amount invested *</label><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Payment method *</label><input className="input" value={form.payment_method || 'cash'} onChange={e => set('payment_method', e.target.value)} placeholder="cash, bank transfer, cheque" /></div>        </div>
        <div className="form-group"><label className="form-label">Date *</label><input className="input" type="date" value={form.investment_date} onChange={e => set('investment_date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="input" rows="3" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional funding details" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
<button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => onSave({ ...form, investor_id: parseInt(form.investor_id, 10), amount: parseFloat(form.amount), type: form.type || 'external' })}>{investment ? 'Update Investment' : 'Save Investment'}</button>      </div>
    </Modal>
  );
}

export default function FinancePage() {
  const { showToast } = useApp();
  const [tab, setTab] = useState('expenses');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start_date: startOfMonth(), end_date: today() });
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState({ total: 0, daily: [], monthly: [], yearly: [], categories: [] });
  const [investments, setInvestments] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState({ total: 0, byType: [], monthly: [] });
  const [overview, setOverview] = useState({});
    const [investors, setInvestors] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [expenseView, setExpenseView] = useState('charts'); // 'charts' | 'list'

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function load(nextFilters = filters) {
    setLoading(true);
    try {
        const [cats, investorRows, ex, exSum, inv, invSum, fin] = await Promise.all([
        window.api.getExpenseCategories(),
        window.api.getInvestors(),
        window.api.getExpenses(nextFilters),
        window.api.getExpenseSummary(nextFilters),
        window.api.getInvestments(nextFilters),
        window.api.getInvestmentSummary(nextFilters),
        window.api.getFinanceOverview(),
      ]);
      setCategories(cats);
      setInvestors(investorRows);
      setExpenses(ex);
      setExpenseSummary(exSum);
      setInvestments(inv);
      setInvestmentSummary(invSum);
      setOverview(fin);
    } catch (err) {      console.error(err);
      showToast(err.message || 'Failed to load finance data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveExpense(data) {
    try {
      if (data.id) await window.api.updateExpense(data); else await window.api.createExpense(data);
      showToast(data.id ? 'Expense updated ✓' : 'Expense added ✓');
      setEditingExpense(null); await load();
    } catch (err) { showToast(err.message || 'Failed to save expense', 'error'); }
  }

  async function saveInvestment(data) {
    try {
      if (data.id) await window.api.updateInvestment(data); else await window.api.createInvestment(data);
      showToast(data.id ? 'Investment updated ✓' : 'Investment added ✓');
      setEditingInvestment(null); await load();
    } catch (err) { showToast(err.message || 'Failed to save investment', 'error'); }
  }

  async function removeExpense(row) {
    if (!confirm(`Delete expense "${row.item_name}"?`)) return;
    const result = await window.api.deleteExpense(row.id);
    if (result?.success === false) return showToast(result.message || 'Expense not found', 'error');
    showToast('Expense deleted', 'info'); load();
  }

  async function removeInvestment(row) {
    if (!confirm(`Delete investment ${fmt(row.amount)}?`)) return;
    const result = await window.api.deleteInvestment(row.id);
    if (result?.success === false) return showToast(result.message || 'Investment not found', 'error');
    showToast('Investment deleted', 'info'); load();
  }

  const typeTotals = useMemo(() => Object.fromEntries((investmentSummary.byType || []).map(t => [t.type, t.total])), [investmentSummary]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 800 }}>Finance Center</h1><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track expenses, investments, and net profit/loss.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => load()}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={() => tab === 'expenses' ? setEditingExpense({}) : setEditingInvestment({})}>{tab === 'expenses' ? '+ Expense' : '+ Investment'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard icon="💸" label="Filtered Expenses" value={fmt(expenseSummary.total)} sub={`This month: ${fmt(overview.monthExpenses)}`} color="#EF4444" />
        <StatCard icon="🏦" label="Filtered Investments" value={fmt(investmentSummary.total)} sub={`All capital: ${fmt(overview.totalInvested)}`} color="#10B981" />
        <StatCard icon="📈" label="Gross Profit" value={fmt(overview.grossProfit)} sub="Sales minus product cost" color="#4F46E5" />
        <StatCard icon="⚖️" label="Net Profit / Loss" value={fmt(overview.netProfitLoss)} sub="Gross profit minus expenses" color={(overview.netProfitLoss || 0) >= 0 ? '#10B981' : '#EF4444'} />
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${tab === 'expenses' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('expenses')}>Expenses</button>
          <button className={`btn ${tab === 'investments' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('investments')}>Investments</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
          <div className="form-group"><label className="form-label">From</label><input className="input" type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">To</label><input className="input" type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} /></div>
          <button className="btn btn-primary" onClick={() => load(filters)}>Apply</button>
        </div>
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading finance data...</div> : tab === 'expenses' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className={`btn btn-sm ${expenseView === 'charts' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setExpenseView('charts')}>📊 Charts</button>
            <button className={`btn btn-sm ${expenseView === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setExpenseView('list')}>📝 List</button>
          </div>

          {expenseView === 'charts' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Category-wise Breakdown</h3><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={expenseSummary.categories} dataKey="total" nameKey="name" innerRadius={52} outerRadius={82}>{expenseSummary.categories.map(c => <Cell key={c.name} fill={c.color} />)}</Pie><Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} /></PieChart></ResponsiveContainer></div>
                <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Daily Expenses</h3><ResponsiveContainer width="100%" height={230}><BarChart data={[...expenseSummary.daily].reverse()}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} /><Bar dataKey="total" fill="#EF4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="table"><thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Notes</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{expenses.map(e => <tr key={e.id}><td>{e.expense_date}</td><td style={{ fontWeight: 700 }}>{e.item_name}</td><td><span className="badge" style={{ color: e.category_color, background: `${e.category_color}22` }}>{e.category_name}</span></td><td style={{ color: 'var(--text-muted)' }}>{e.notes || '—'}</td><td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{fmt(e.amount)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setEditingExpense(e)}>Edit</button> <button className="btn btn-danger btn-sm" onClick={() => removeExpense(e)}>Delete</button></td></tr>)}</tbody></table>{!expenses.length && <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)' }}>No expenses for selected period.</div>}</div>
            </>
          ) : (
            <ExpenseListView expenses={expenses} categories={categories} onEdit={setEditingExpense} onDelete={removeExpense} fmt={fmt} />
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{investmentTypes.map(t => <StatCard key={t.value} icon={t.value === 'loan' ? '🏛️' : t.value === 'external' ? '🤝' : '👤'} label={t.label} value={fmt(typeTotals[t.value])} color="#10B981" />)}</div>
          <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Monthly Capital Added</h3><ResponsiveContainer width="100%" height={230}><BarChart data={[...investmentSummary.monthly].reverse()}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} /><Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
<div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="table"><thead><tr><th>Date</th><th>Investor</th><th>Payment</th><th>Notes</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{investments.map(i => <tr key={i.id}><td>{i.investment_date}</td><td style={{ fontWeight: 700 }}>{i.investor_name || '—'}</td><td><span className="badge badge-success">{i.payment_method || '—'}</span></td><td style={{ color: 'var(--text-muted)' }}>{i.notes || '—'}</td><td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{fmt(i.amount)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setEditingInvestment(i)}>Edit</button> <button className="btn btn-danger btn-sm" onClick={() => removeInvestment(i)}>Delete</button></td></tr>)}</tbody></table>{!investments.length && <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)' }}>No investments for selected period.</div>}</div>        </>
      )}

      {editingExpense && <ExpenseModal expense={editingExpense.id ? editingExpense : null} categories={categories} onSave={saveExpense} onClose={() => setEditingExpense(null)} />}
 {editingInvestment && <InvestmentModal investment={editingInvestment.id ? editingInvestment : null} investors={investors} onSave={saveInvestment} onClose={() => setEditingInvestment(null)} />}    </div>
  );
}

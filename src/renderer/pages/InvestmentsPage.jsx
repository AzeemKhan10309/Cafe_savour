import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';

const fmt = v => `Rs. ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().split('T')[0];
const currentMonth = () => today().slice(0, 7);
const currentYear = () => today().slice(0, 4);

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

function StatCard({ icon, label, value, sub, color = '#10B981' }) {
  return (
    <div className="card" style={{ borderColor: `${color}33`, padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20 }}>{value}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 800 }}>{label}</div>
          {sub && <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function InvestorModal({ investor, onSave, onClose }) {
  const [form, setForm] = useState(investor || { name: '', notes: '', expected_monthly_amount: '' });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <Modal title={investor ? '✏️ Edit Investor' : '➕ Add Investor'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label className="form-label">Investor Name *</label><input className="input" autoFocus value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Ahmed Partner" /></div>
        <div className="form-group"><label className="form-label">Expected Monthly Investment</label><input className="input" type="number" min="0" step="0.01" value={form.expected_monthly_amount || ''} onChange={e => set('expected_monthly_amount', e.target.value)} placeholder="Optional target for outstanding tracking" /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="input" rows="4" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Investor contact details, agreement notes, expectations" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => onSave({ ...form, expected_monthly_amount: Number(form.expected_monthly_amount || 0) })}>{investor ? 'Update Investor' : 'Save Investor'}</button>
      </div>
    </Modal>
  );
}

function InvestmentModal({ investment, investors, onSave, onClose }) {
  const [form, setForm] = useState(investment || { investor_id: investors[0]?.id || '', amount: '', investment_date: today(), payment_method: 'cash', notes: '', type: 'external' });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <Modal title={investment ? '✏️ Edit Investment Record' : '➕ Add Investment Record'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label className="form-label">Investor *</label><select className="input" autoFocus value={form.investor_id || ''} onChange={e => set('investor_id', e.target.value)}>{investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Investment Amount *</label><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Investment Date *</label><input className="input" type="date" value={form.investment_date} onChange={e => set('investment_date', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Payment Method *</label><input className="input" value={form.payment_method || ''} onChange={e => set('payment_method', e.target.value)} placeholder="cash, bank transfer, cheque, card" /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="input" rows="4" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Reference number, agreement, or payment notes" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={!investors.length} onClick={() => onSave({ ...form, investor_id: parseInt(form.investor_id, 10), amount: parseFloat(form.amount), type: form.type || 'external' })}>{investment ? 'Update Investment' : 'Save Investment'}</button>
      </div>
    </Modal>
  );
}

export default function InvestmentsPage() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [filters, setFilters] = useState({ start_date: '', end_date: '', month: currentMonth(), year: currentYear(), investor_id: '' });
  const [investors, setInvestors] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, totalThisMonth: 0, totalThisYear: 0, totalInvestors: 0, byInvestor: [], monthly: [], yearly: [], paymentMethods: [], outstanding: [] });
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [editingInvestment, setEditingInvestment] = useState(null);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const queryFilters = useMemo(() => {
    const f = {};
    if (filters.start_date) f.start_date = filters.start_date;
    if (filters.end_date) f.end_date = filters.end_date;
    if (!filters.start_date && !filters.end_date && filters.month) f.month = filters.month;
    if (!filters.start_date && !filters.end_date && !filters.month && filters.year) f.year = filters.year;
    if (filters.investor_id) f.investor_id = filters.investor_id;
    return f;
  }, [filters]);

  async function load(nextFilters = queryFilters) {
    setLoading(true);
    try {
      const [investorRows, investmentRows, report] = await Promise.all([
        window.api.getInvestors(),
        window.api.getInvestments(nextFilters),
        window.api.getInvestmentSummary(nextFilters),
      ]);
      setInvestors(investorRows || []);
      setInvestments(investmentRows || []);
      setSummary(report || {});
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load investment data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveInvestor(data) {
    try {
      if (data.id) await window.api.updateInvestor(data); else await window.api.createInvestor(data);
      showToast(data.id ? 'Investor updated ✓' : 'Investor added ✓');
      setEditingInvestor(null);
      await load();
    } catch (err) { showToast(err.message || 'Failed to save investor', 'error'); }
  }

  async function saveInvestment(data) {
    try {
      if (data.id) await window.api.updateInvestment(data); else await window.api.createInvestment(data);
      showToast(data.id ? 'Investment updated ✓' : 'Investment recorded ✓');
      setEditingInvestment(null);
      await load();
    } catch (err) { showToast(err.message || 'Failed to save investment', 'error'); }
  }

  async function removeInvestor(row) {
    if (!confirm(`Delete investor "${row.name}"?`)) return;
    const result = await window.api.deleteInvestor(row.id);
    if (result?.success === false) return showToast(result.message || 'Investor not found', 'error');
    showToast('Investor deleted', 'info');
    load();
  }

  async function removeInvestment(row) {
    if (!confirm(`Delete ${fmt(row.amount)} investment from ${row.investor_name}?`)) return;
    const result = await window.api.deleteInvestment(row.id);
    if (result?.success === false) return showToast(result.message || 'Investment not found', 'error');
    showToast('Investment deleted', 'info');
    load();
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 900 }}>Investment Management</h1><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track investors, contributions, monthly targets, and investment trends.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setEditingInvestor({})}>+ Investor</button>
          <button className="btn btn-primary" disabled={!investors.length} onClick={() => setEditingInvestment({})}>+ Investment</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard icon="👥" label="Total Investors" value={summary.totalInvestors || investors.length} sub="Active investor records" color="#6366F1" />
        <StatCard icon="🏦" label="Total Invested Amount" value={fmt(summary.total)} sub="For selected filters" color="#10B981" />
        <StatCard icon="📅" label="Investment This Month" value={fmt(summary.totalThisMonth)} sub="Current calendar month" color="#F59E0B" />
        <StatCard icon="📈" label="Investment This Year" value={fmt(summary.totalThisYear)} sub="Current calendar year" color="#06B6D4" />
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['dashboard', 'investors', 'records'].map(t => <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>{t === 'dashboard' ? 'Analytics' : t === 'investors' ? 'Investors' : 'Investment Records'}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group"><label className="form-label">From</label><input className="input" type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">To</label><input className="input" type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Month</label><input className="input" type="month" value={filters.month} onChange={e => setFilters(p => ({ ...p, month: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Year</label><input className="input" style={{ width: 95 }} value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value.replace(/\D/g, '').slice(0, 4) }))} /></div>
          <div className="form-group"><label className="form-label">Investor</label><select className="input" value={filters.investor_id} onChange={e => setFilters(p => ({ ...p, investor_id: e.target.value }))}><option value="">All</option>{investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
          <button className="btn btn-primary" onClick={() => load(queryFilters)}>Apply</button>
        </div>
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading investments...</div> : tab === 'dashboard' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Monthly Investment Graph</h3><ResponsiveContainer width="100%" height={260}><BarChart data={[...(summary.monthly || [])].reverse()}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} /><Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Top Investors</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{(summary.byInvestor || []).slice(0, 7).map((i, idx) => <div key={i.investor_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--text-muted)' }}>{idx + 1}. {i.investor_name}</span><b>{fmt(i.total)}</b></div>)}{!(summary.byInvestor || []).length && <div style={{ color: 'var(--text-dim)' }}>No investor totals for these filters.</div>}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Yearly Investment Trends</h3><ResponsiveContainer width="100%" height={230}><LineChart data={[...(summary.yearly || [])].reverse()}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} /><Line type="monotone" dataKey="total" stroke="#06B6D4" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
            <div className="card"><h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Outstanding / Expected This Month</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{(summary.outstanding || []).map(i => <div key={i.investor_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{i.investor_name}<small style={{ color: 'var(--text-dim)' }}> paid {fmt(i.invested_this_month)}</small></span><b style={{ color: 'var(--warning)' }}>{fmt(i.outstanding_amount)}</b></div>)}{!(summary.outstanding || []).length && <div style={{ color: 'var(--text-dim)' }}>No outstanding expected investments this month.</div>}</div></div>
          </div>
        </>
      ) : tab === 'investors' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="table"><thead><tr><th>Investor Name</th><th>Notes</th><th>Expected / Month</th><th>Total Investment by Investor</th><th>This Month</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody>{investors.map(i => <tr key={i.id}><td style={{ fontWeight: 800 }}>{i.name}</td><td style={{ color: 'var(--text-muted)' }}>{i.notes || '—'}</td><td>{fmt(i.expected_monthly_amount)}</td><td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{fmt(i.total_invested)}</td><td>{fmt(i.invested_this_month)}</td><td style={{ color: i.outstanding_this_month > 0 ? 'var(--warning)' : 'var(--success)' }}>{fmt(i.outstanding_this_month)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setEditingInvestor(i)}>Edit</button> <button className="btn btn-danger btn-sm" onClick={() => removeInvestor(i)}>Delete</button></td></tr>)}</tbody></table>{!investors.length && <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)' }}>No investors yet. Add an investor to begin tracking contributions.</div>}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="table"><thead><tr><th>Date</th><th>Investor</th><th>Payment Method</th><th>Notes</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{investments.map(i => <tr key={i.id}><td>{i.investment_date}</td><td style={{ fontWeight: 800 }}>{i.investor_name || 'Deleted investor'}</td><td><span className="badge badge-success">{i.payment_method || '—'}</span></td><td style={{ color: 'var(--text-muted)' }}>{i.notes || '—'}</td><td style={{ fontFamily: 'monospace', fontWeight: 900 }}>{fmt(i.amount)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setEditingInvestment(i)}>Edit</button> <button className="btn btn-danger btn-sm" onClick={() => removeInvestment(i)}>Delete</button></td></tr>)}</tbody></table>{!investments.length && <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)' }}>No investment records match the selected filters.</div>}</div>
      )}

      {editingInvestor && <InvestorModal investor={editingInvestor.id ? editingInvestor : null} onSave={saveInvestor} onClose={() => setEditingInvestor(null)} />}
      {editingInvestment && <InvestmentModal investment={editingInvestment.id ? editingInvestment : null} investors={investors} onSave={saveInvestment} onClose={() => setEditingInvestment(null)} />}
    </div>
  );
}
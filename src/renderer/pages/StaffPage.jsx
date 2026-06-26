import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
const { BUSINESS_INFO } = require('../../shared/businessInfo');
const RC = { admin:'#EF4444', cashier:'#10B981' };

function Modal({ onClose, children }) {
  return (
    <div
      onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(4px)' }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:460, maxWidth:'93vw', overflowY:'auto' }}
      >
        {children}
      </div>
    </div>
  );
}

function StaffModal({ staff, onSave, onClose }) {
  const [f, setF] = useState(staff ? {...staff, password:''} : { name:'', username:'', password:'', role:'cashier', active:1 });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontWeight:700, fontSize:20, marginBottom:20 }}>{staff ? '✏️ Edit Staff' : '➕ Add Staff'}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="input" autoFocus value={f.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Ahmed Ali" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input className="input" value={f.username} onChange={e=>s('username',e.target.value)} placeholder="login username" />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="input" value={f.role} onChange={e=>s('role',e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{staff ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <input className="input" type="password" value={f.password} onChange={e=>s('password',e.target.value)} placeholder="Enter password" />
        </div>
        {staff && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="input" value={f.active} onChange={e=>s('active',parseInt(e.target.value))}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:12, marginTop:24 }}>
        <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }}
          onClick={() => {
            if (!f.name.trim()||!f.username.trim()) return;
            if (!staff&&!f.password) return;
            onSave(f);
          }}>
          {staff ? 'Update Staff' : 'Add Staff'}
        </button>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const { user, showToast } = useApp();
  const [staff,     setStaff]     = useState([]);
  const [editStaff, setEditStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => setStaff(await window.api.getStaff());

  const save = async data => {
    if (data.id) await window.api.updateStaff(data); else await window.api.createStaff(data);
    showToast(data.id ? 'Staff updated ✓' : 'Staff added ✓');
    setShowModal(false); setEditStaff(null); load();
  };

  const deactivate = async id => {
    if (id===user.id) return showToast("Can't deactivate your own account",'error');
    if (!confirm('Deactivate this staff member?')) return;
    await window.api.deleteStaff(id); showToast('Deactivated','info'); load();
  };

  return (
   <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>Staff Management</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14 }}>{staff.length} members · {BUSINESS_INFO.name}</p>        </div>
        <button className="btn btn-primary" onClick={() => { setEditStaff(null); setShowModal(true); }}>+ Add Staff</button>
      </div>

      {/* Role summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, maxWidth:440 }}>
        {['admin','cashier'].map(role => (
          <div key={role} className="card" style={{ padding:16, borderColor:`${RC[role]}33` }}>
            <div style={{ fontWeight:800, fontSize:30, color:RC[role] }}>{staff.filter(s=>s.role===role&&s.active).length}</div>
            <div style={{ fontSize:13, fontWeight:600, textTransform:'capitalize', marginTop:2 }}>{role}s</div>
            <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{role==='admin'?'Full access':'POS sales only'}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Staff Member</th><th>Username</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s=>(
              <tr key={s.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${RC[s.role]||'#4F46E5'},${RC[s.role]||'#4F46E5'}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>
                      {s.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight:600 }}>{s.name}</div>
                      {s.id===user.id && <span style={{ fontSize:10, color:'var(--primary-light)' }}>• You</span>}
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily:'monospace', fontSize:13, color:'var(--text-muted)' }}>{s.username}</td>
                <td>
                  <span style={{ display:'inline-flex', padding:'3px 12px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'uppercase', background:`${RC[s.role]}22`, color:RC[s.role] }}>
                    {s.role}
                  </span>
                </td>
                <td>
                  <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background: s.active?'rgba(16,185,129,.2)':'rgba(100,116,139,.2)', color: s.active?'var(--success)':'var(--text-dim)' }}>
                    {s.active ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style={{ color:'var(--text-muted)', fontSize:12 }}>{new Date(s.created_at).toLocaleDateString('en-PK')}</td>
                <td>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditStaff(s); setShowModal(true); }}>Edit</button>
                    {s.id!==user.id && s.active===1 && (
                      <button className="btn btn-sm" onClick={() => deactivate(s.id)} style={{ background:'rgba(239,68,68,.15)', color:'var(--danger)', border:'none' }}>Deactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permissions */}
      <div className="card">
        <h3 style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Role Permissions</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, maxWidth:700 }}>
          {[
            { role:'Admin',   color:RC.admin,   perms:['Full system access','Add / Edit / Delete products','Add / Delete categories','View costs & profit margins','Sales reports & export','Staff management'] },
            { role:'Cashier', color:RC.cashier, perms:['POS billing screen only','Process all payment types','Print receipts','View dashboard','View product list (read-only)','No access to reports or settings'] },
          ].map(({role,color,perms}) => (
            <div key={role} style={{ background:'var(--bg)', borderRadius:10, padding:16, border:`1px solid ${color}22` }}>
              <div style={{ fontWeight:700, color, marginBottom:10, fontSize:14 }}>{role==='Admin'?'🔑':'🛒'} {role}</div>
              {perms.map(p=>(
                <div key={p} style={{ color: p.includes('No access')?'var(--danger)':'var(--text-muted)', marginBottom:4, fontSize:12, paddingLeft:4 }}>
                  {p.includes('No access') ? '✗' : '✓'} {p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {showModal && <StaffModal staff={editStaff} onSave={save} onClose={() => { setShowModal(false); setEditStaff(null); }} />}
    </div>
  );
}

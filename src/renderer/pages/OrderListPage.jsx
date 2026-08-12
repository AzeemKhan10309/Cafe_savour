import React, { useEffect, useState } from 'react';
import { useApp } from '../App';
import { buildReceiptDataFromOrder } from '../utils/receiptData';
import { formatOrderDateTime, formatOrderTime, todayOrderKey } from '../utils/orderDateTime';
const fmt = v => `Rs. ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;


function DetailRow({ label, value, strong, color }) {
  return <div style={{ display:'flex', justifyContent:'space-between', gap:16, padding:'5px 0', color:color || 'inherit' }}><span style={{ color:'var(--text-muted)', fontSize:13 }}>{label}</span><span style={{ fontWeight:strong ? 800 : 600, textAlign:'right' }}>{value}</span></div>;
}

function OrderDetailsModal({ order, onClose, onPrint, printing }) {
  const receipt = buildReceiptDataFromOrder(order);
  const itemCount = (receipt.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(4px)' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:26, width:650, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:18 }}>
          <div><h2 style={{ fontSize:22, fontWeight:800 }}>Order {receipt.invoice}</h2><p style={{ color:'var(--text-muted)', fontSize:13 }}>{receipt.date}</p></div>
          <button className="btn btn-ghost" onClick={onClose}>× Close</button>
        </div>

        <div className="card" style={{ padding:14, marginBottom:14 }}>
          <DetailRow label="Table" value={receipt.tableName || '—'} />
          <DetailRow label="Staff" value={receipt.staffName || '—'} />
          <DetailRow label="Payment Method" value={receipt.paymentMethod || '—'} />
          <DetailRow label="Items" value={itemCount} />
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:14 }}>
          <table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
            {(receipt.items || []).map(item => <tr key={item.id || item.product_id || item.product_name}><td>{item.product_name}</td><td>{item.quantity}</td><td>{fmt(item.price)}</td><td>{fmt(item.subtotal)}</td></tr>)}
          </tbody></table>
        </div>

        <div className="card" style={{ padding:14, marginBottom:14 }}>
          <DetailRow label="Subtotal" value={fmt(receipt.subtotal)} />
          <DetailRow label={`Discount${receipt.discountType === 'percent' ? ` (${receipt.discount}%)` : ''}`} value={`- ${fmt(receipt.discountAmount)}`} color="var(--success)" />
          <DetailRow label={`Service Tax (${receipt.serviceRate || 0}%)`} value={fmt(receipt.serviceAmount)} />
          <DetailRow label={`VAT Tax (${receipt.taxRate || 0}%)`} value={fmt(receipt.taxAmount)} />
          <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8 }}><DetailRow label="Grand Total" value={fmt(receipt.total)} strong /></div>
        </div>

        {receipt.notes && <div className="card" style={{ padding:14, marginBottom:14 }}><div style={{ color:'var(--text-muted)', fontSize:12, marginBottom:6 }}>Order Notes</div><div>{receipt.notes}</div></div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onPrint(order)} disabled={printing}>{printing ? 'Printing…' : '🖨️ Print Receipt'}</button>
        </div>
      </div>
    </div>
  );
}

export default function OrderListPage() {
  const { showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [printingId, setPrintingId] = useState(null);
   const today = todayOrderKey();

  useEffect(() => { loadTodayOrders(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTodayOrders() {
    setLoading(true);
    const rows = await window.api.getOrders({ start_date:today, end_date:today, use_local_date:true });
        setOrders(rows || []);
    setLoading(false);
  }

  async function hydrateOrder(order) { return order?.items ? order : await window.api.getOrderById(order.id); }

  async function viewOrder(order) {
    const fullOrder = await hydrateOrder(order);
    if (!fullOrder) return showToast('Order not found', 'error');
    setSelected(fullOrder);
  }

  async function printOrder(order) {
    setPrintingId(order.id);
    const fullOrder = await hydrateOrder(order);
    if (!fullOrder) { setPrintingId(null); return showToast('Order not found', 'error'); }
    const result = await window.api.printReceipt(buildReceiptDataFromOrder(fullOrder));
    setPrintingId(null);
    if (result?.success) showToast(`Receipt ${fullOrder.invoice_number} reprinted`);
    else showToast(result?.message || 'Reprint failed', 'error');
  }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div><h1 style={{ fontSize:28, fontWeight:800 }}>Today's Order List</h1><p style={{ color:'var(--text-muted)', fontSize:13 }}>Showing POS Billing orders created on {today}</p></div>
        <button className="btn btn-ghost" onClick={loadTodayOrders} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="table"><thead><tr><th>Order</th><th>Time</th><th>Table</th><th>Items</th><th>Discount</th><th>Total</th><th>Payment</th><th>Action</th></tr></thead><tbody>
 {orders.map(order => <tr key={order.id}><td><strong>{order.invoice_number}</strong><div style={{ color:'var(--text-dim)', fontSize:11 }}>{formatOrderDateTime(order.created_at)}</div></td><td>{formatOrderTime(order.created_at)}</td><td>{order.table_name || '—'}</td><td>View</td><td>{fmt(order.discount)}</td><td><strong>{fmt(order.total)}</strong></td><td style={{ textTransform:'capitalize' }}>{order.payment_method}</td><td><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="btn btn-sm btn-ghost" onClick={() => viewOrder(order)}>View Order</button><button className="btn btn-sm btn-primary" onClick={() => printOrder(order)} disabled={printingId === order.id}>{printingId === order.id ? 'Printing…' : 'Print Receipt'}</button></div></td></tr>)}        </tbody></table>
        {!orders.length && <div style={{ textAlign:'center', padding:46, color:'var(--text-dim)' }}>{loading ? 'Loading today’s orders…' : 'No orders created today'}</div>}
      </div>

      {selected && <OrderDetailsModal order={selected} onClose={() => setSelected(null)} onPrint={printOrder} printing={printingId === selected.id} />}
    </div>
  );
}
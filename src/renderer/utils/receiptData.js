const { BUSINESS_INFO } = require('../../shared/businessInfo');

export function calculateDiscountAmount(order) {
  const subtotal = Number(order?.subtotal || 0);
  const discount = Number(order?.discount || 0);
  if (order?.discount_type === 'percent') {
    return Math.min((subtotal * discount) / 100, subtotal);
  }
  return Math.min(discount, subtotal);
}

export function buildReceiptDataFromOrder(order) {
  if (!order) return null;

  let paymentDetails = order.payment_details || {};
  if (typeof paymentDetails === 'string') {
    try {
      paymentDetails = JSON.parse(paymentDetails || '{}');
    } catch (error) {
      paymentDetails = {};
    }
  }

  return {
    cafe: BUSINESS_INFO,
    invoice: order.invoice_number,
    items: order.items || [],
    tableName: order.table_name || '',
    subtotal: order.subtotal,
    discount: order.discount,
    discountAmount: calculateDiscountAmount(order),
    discountType: order.discount_type,
    taxRate: order.tax_rate,
    taxAmount: order.tax_amount,
    serviceRate: order.service_rate,
    serviceAmount: order.service_amount,
    total: order.total,
    paymentMethod: order.payment_method,
    paymentDetails,
    staffName: order.staff_name,
    date: new Date(order.created_at).toLocaleString('en-PK'),
    notes: order.notes || '',
  };
}
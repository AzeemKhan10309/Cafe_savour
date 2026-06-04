const db = require('../database/db');
const { BUSINESS_INFO } = require('../../shared/businessInfo');
async function exportPDF(filePath, filters) {
  try {
    const jsPDF = require('jspdf');
    require('jspdf-autotable');
    const { jsPDF: PDF } = jsPDF;
    const doc = new PDF();
    const data = db.getSalesReport(filters);

        const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont(undefined, 'bold');
    doc.setFontSize(18);
    doc.text(BUSINESS_INFO.name, pageWidth / 2, 16, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(BUSINESS_INFO.phone, pageWidth / 2, 23, { align: 'center' });
    BUSINESS_INFO.addressLines.forEach((line, index) => {
      doc.text(line, pageWidth / 2, 29 + (index * 5), { align: 'center' });
    });

    doc.setFontSize(20);
    doc.text('Sales Report', 14, 45);
    doc.setFontSize(11);
    doc.text(`Period: ${filters.start_date || 'All time'} to ${filters.end_date || 'Today'}`, 14, 55);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 62);

    // Summary box
    doc.setFillColor(79, 70, 229);
    doc.rect(14, 70, 182, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`Total Revenue: Rs. ${data.totalRevenue.toFixed(2)}`, 20, 80);
    doc.text(`Total Orders: ${data.orders.length}`, 20, 88);
    doc.text(`Net Profit: Rs. ${data.profit.toFixed(2)}`, 110, 80);
    doc.text(`Total Cost: Rs. ${data.totalCost.toFixed(2)}`, 110, 88);
    doc.setTextColor(0, 0, 0);

    // Orders table
    doc.autoTable({
      startY: 105,
      head: [['Invoice', 'Date', 'Staff', 'Items', 'Payment', 'Total']],
      body: data.orders.map(o => [
        o.invoice_number,
        new Date(o.created_at).toLocaleDateString(),
        o.staff_name || 'N/A',
        o.items?.length || 'N/A',
        o.payment_method.toUpperCase(),
        `Rs. ${o.total.toFixed(2)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(filePath);
    return { success: true, filePath };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function exportExcel(filePath, filters) {
  try {
    const XLSX = require('xlsx');
    const data = db.getSalesReport(filters);

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['SALES REPORT SUMMARY'],
      ['Period', `${filters.start_date || 'All time'} - ${filters.end_date || 'Today'}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Total Orders', data.orders.length],
      ['Total Revenue', `$${data.totalRevenue.toFixed(2)}`],
      ['Total Cost', `$${data.totalCost.toFixed(2)}`],
      ['Net Profit', `$${data.profit.toFixed(2)}`],
      ['Profit Margin', `${data.totalRevenue > 0 ? ((data.profit / data.totalRevenue) * 100).toFixed(1) : 0}%`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

    // Orders sheet
    const ordersData = [
      ['Invoice', 'Date', 'Time', 'Staff', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Method'],
      ...data.orders.map(o => [
        o.invoice_number,
        new Date(o.created_at).toLocaleDateString(),
        new Date(o.created_at).toLocaleTimeString(),
        o.staff_name || 'N/A',
        o.subtotal,
        o.discount,
        o.tax_amount,
        o.total,
        o.payment_method,
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersData), 'Orders');

    // Product breakdown
    const productMap = {};
    data.items.forEach(i => {
      if (!productMap[i.product_name]) productMap[i.product_name] = { qty: 0, revenue: 0 };
      productMap[i.product_name].qty += i.quantity;
      productMap[i.product_name].revenue += i.subtotal;
    });
    const productsData = [
      ['Product', 'Qty Sold', 'Revenue'],
      ...Object.entries(productMap).sort((a, b) => b[1].qty - a[1].qty).map(([name, d]) => [name, d.qty, d.revenue])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productsData), 'Products');

    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

module.exports = { exportPDF, exportExcel };

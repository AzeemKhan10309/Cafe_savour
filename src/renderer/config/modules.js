import React from 'react';
import { Navigate } from 'react-router-dom';
import POSPage from '../pages/POSPage';
import OrderListPage from '../pages/OrderListPage';
import DashboardPage from '../pages/DashboardPage';
import InventoryPage from '../pages/InventoryPage';
import StaffPage from '../pages/StaffPage';
import ReportsPage from '../pages/ReportsPage';
import FinancePage from '../pages/FinancePage';
import InvestmentsPage from '../pages/InvestmentsPage';
import KitchenInventoryPage from '../pages/KitchenInventoryPage';
import PrinterSettingsPage from '../pages/PrinterSettingsPage';
import { isFeatureEnabled } from './featureFlags';

export const MODULES = [
  {
    key: 'DASHBOARD',
    path: '/',
    index: true,
    label: 'Dashboard',
    icon: '📊',
    nav: true,
    end: true,
    adminOnly: false,
    element: <DashboardPage />,
  },
  {
    key: 'POS',
    path: 'pos',
    navPath: '/pos',
    label: 'POS Billing',
    icon: '🛒',
    nav: true,
    adminOnly: false,
    element: <POSPage />,
  },
  {
    key: 'ORDER_LIST',
    path: 'orders',
    navPath: '/orders',
    label: 'Order List',
    icon: '🧾',
    nav: true,
    adminOnly: false,
    element: <OrderListPage />,
  },
  {
    key: 'INVENTORY',
    path: 'inventory',
    navPath: '/inventory',
    label: 'POS Inventory',
    icon: '📦',
    nav: true,
    adminOnly: true,
    element: <InventoryPage />,
  },
  {
    key: 'KITCHEN_INVENTORY',
    path: 'kitchen-inventory',
    navPath: '/kitchen-inventory',
    label: 'Kitchen Inventory',
    icon: '🥘',
    nav: true,
    adminOnly: true,
    element: <KitchenInventoryPage />,
  },
  {
    key: 'REPORTS',
    path: 'reports',
    navPath: '/reports',
    label: 'Reports',
    icon: '📈',
    nav: true,
    adminOnly: true,
    element: <ReportsPage />,
  },
  {
    key: 'FINANCE',
    path: 'finance',
    navPath: '/finance',
    label: 'Finance',
    icon: '💰',
    nav: true,
    adminOnly: true,
    element: <FinancePage />,
  },
  {
    key: 'INVESTORS',
    path: 'investments',
    navPath: '/investments',
    label: 'Investors',
    icon: '🏦',
    nav: true,
    adminOnly: true,
    element: <InvestmentsPage />,
  },
  {
    key: 'STAFF',
    path: 'staff',
    navPath: '/staff',
    label: 'Staff',
    icon: '👥',
    nav: true,
    adminOnly: true,
    element: <StaffPage />,
  },
  {
    key: 'PRINTER_SETTINGS',
    path: 'printer-settings',
    navPath: '/printer-settings',
    label: 'Printer Settings',
    icon: '🖨️',
    nav: true,
    adminOnly: true,
    element: <PrinterSettingsPage />,
  },
];

export const isModuleEnabled = (module) => isFeatureEnabled(module.key);

export const getEnabledModules = () => MODULES.filter(isModuleEnabled);

export const getEnabledNavItems = ({ isAdmin } = {}) => getEnabledModules()
  .filter((module) => module.nav)
  .filter((module) => !module.adminOnly || isAdmin)
  .map((module) => ({
    to: module.navPath || module.path,
    label: module.label,
    icon: module.icon,
    end: module.end,
  }));

export function featureRouteElement(module, element) {
  if (!isModuleEnabled(module)) return <Navigate to="/" replace />;
  return element;
}
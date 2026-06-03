import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';

export default function PrinterSettingsPage() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinterName, setSelectedPrinterName] = useState('');
  const [activePrinterName, setActivePrinterName] = useState('');
  const [source, setSource] = useState('none');
  const [warnings, setWarnings] = useState([]);

  const selectedExists = useMemo(
    () => !selectedPrinterName || printers.some((printer) => printer.name.toLowerCase() === selectedPrinterName.toLowerCase()),
    [printers, selectedPrinterName]
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await window.api.getPrinterSettings();
      setPrinters(result.printers || []);
      setSelectedPrinterName(result.selectedPrinterName || '');
      setActivePrinterName(result.activePrinterName || '');
      setSource(result.source || 'none');
      setWarnings(result.warnings || []);
    } catch (error) {
      showToast(`Unable to load printers: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = async () => {
    setSaving(true);
    try {
      await window.api.savePrinterSettings(selectedPrinterName);
      showToast(selectedPrinterName ? `Printer saved: ${selectedPrinterName}` : 'Automatic printer selection enabled');
      await loadSettings();
    } catch (error) {
      showToast(`Unable to save printer: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const testPrint = async () => {
    setTesting(true);
    try {
      const result = await window.api.testPrint();
      if (result.success) {
        const warningText = result.warnings?.length ? ` (${result.warnings.join(' ')})` : '';
        showToast(`Test receipt sent to ${result.printerName}.${warningText}`);
      } else {
        showToast(result.message || 'Test print failed', 'error');
      }
    } catch (error) {
      showToast(`Test print failed: ${error.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ height:'100%', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, color:'var(--text)' }}>🖨️ Printer Settings</h1>
          <p style={{ margin:'6px 0 0', color:'var(--text-muted)', fontSize:13 }}>
            Select any installed Windows printer. The POS will remember it and automatically fall back to the Windows default printer if it becomes unavailable.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadSettings} disabled={loading}>🔄 Refresh</button>
      </div>

      {warnings.length > 0 && (
        <div style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.35)', color:'#FBBF24', borderRadius:12, padding:14, marginBottom:16, fontSize:13 }}>
          <strong>Printer warning</strong>
          <ul style={{ margin:'8px 0 0', paddingLeft:18 }}>
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div className="card" style={{ padding:18, marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) auto auto', gap:12, alignItems:'end' }}>
          <label style={{ display:'flex', flexDirection:'column', gap:7 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)' }}>Receipt printer</span>
            <select className="input" value={selectedPrinterName} onChange={(event) => setSelectedPrinterName(event.target.value)} disabled={loading}>
              <option value="">Automatic (saved → Windows default → first available)</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.name}{printer.isDefault ? ' — Windows default' : ''}{printer.usable ? '' : ' — unavailable'}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving || loading}>{saving ? 'Saving…' : '💾 Save'}</button>
          <button className="btn btn-secondary" onClick={testPrint} disabled={testing || loading}>{testing ? 'Testing…' : '🧾 Test Print'}</button>
        </div>

        {!selectedExists && (
          <div style={{ marginTop:12, color:'#FBBF24', fontSize:12 }}>
            The saved printer name was not found. Keep automatic fallback enabled or choose one of the detected printers below.
          </div>
        )}

        <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10 }}>
          <InfoBox label="Saved printer" value={selectedPrinterName || 'Automatic'} />
          <InfoBox label="Active printer" value={activePrinterName || 'None detected'} />
          <InfoBox label="Selection source" value={source} />
        </div>
      </div>

      <div className="card" style={{ padding:18 }}>
        <h2 style={{ margin:'0 0 12px', fontSize:17 }}>Detected Windows printers</h2>
        {loading ? (
          <p style={{ color:'var(--text-muted)' }}>Loading printers with PowerShell Get-Printer…</p>
        ) : printers.length === 0 ? (
          <p style={{ color:'var(--text-muted)' }}>No installed Windows printers were detected.</p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ color:'var(--text-muted)', textAlign:'left', borderBottom:'1px solid var(--border)' }}>
                  <th style={{ padding:'9px 8px' }}>Printer</th>
                  <th style={{ padding:'9px 8px' }}>Default</th>
                  <th style={{ padding:'9px 8px' }}>Status</th>
                  <th style={{ padding:'9px 8px' }}>Port</th>
                  <th style={{ padding:'9px 8px' }}>Shared</th>
                </tr>
              </thead>
              <tbody>
                {printers.map((printer) => (
                  <tr key={printer.name} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 8px', fontWeight:700 }}>{printer.name}</td>
                    <td style={{ padding:'10px 8px' }}>{printer.isDefault ? '✅ Yes' : '—'}</td>
                    <td style={{ padding:'10px 8px', color: printer.usable ? '#10B981' : '#EF4444' }}>
                      {printer.usable ? 'Ready' : 'Unavailable'} ({printer.status || 'Unknown'})
                    </td>
                    <td style={{ padding:'10px 8px', color:'var(--text-muted)' }}>{printer.portName || '—'}</td>
                    <td style={{ padding:'10px 8px' }}>{printer.shared ? `Yes (${printer.shareName || 'shared'})` : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div style={{ padding:12, border:'1px solid var(--border)', borderRadius:10, background:'var(--bg)' }}>
      <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase' }}>{label}</div>
      <div style={{ marginTop:5, fontSize:14, fontWeight:800 }}>{value}</div>
    </div>
  );
}
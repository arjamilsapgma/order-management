import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../src/services/api';
import * as XLSX from 'xlsx';

export const ShipmentDetail: React.FC<{ shipmentId: string; onBack: () => void }> = ({ shipmentId, onBack }) => {
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await api.getShipmentDetail(shipmentId);
        setShipment(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch shipment details');
      } finally {
        setLoading(false);
      }
    };
    if (shipmentId) fetchDetail();
  }, [shipmentId]);

  const numRows = shipment?.ORDER ? shipment.ORDER.length : 0;

  // Filter rows based on search across ORDER, SKU/ITEM, UPS TRACKING, PO
  const filteredRows = useMemo(() => {
    if (!searchTerm || !shipment) return Array.from({ length: numRows }, (_, i) => i);
    const lower = searchTerm.toLowerCase();
    return Array.from({ length: numRows }, (_, i) => i).filter(i => {
      const order = String(shipment.ORDER?.[i] ?? '').toLowerCase();
      const sku   = String(shipment['SKU/ ITEM']?.[i] ?? '').toLowerCase();
      const ups   = String(shipment.UPSTRACKING?.[i] ?? '').toLowerCase();
      const po    = String(shipment.PO?.[i] ?? '').toLowerCase();
      return order.includes(lower) || sku.includes(lower) || ups.includes(lower) || po.includes(lower);
    });
  }, [searchTerm, shipment, numRows]);

  const handleExport = () => {
    if (!shipment) return;
    const exportData = filteredRows.map(i => ({
      'UPS TRACKING # (NO SPACE)': shipment.UPSTRACKING?.[i] ?? '',
      'ORDER': shipment.ORDER?.[i] ?? '',
      'PO': shipment.PO?.[i] ?? '',
      'SD': shipment.SD?.[i] ?? '',
      'SKU/ ITEM': shipment['SKU/ ITEM']?.[i] ?? '',
      'QUANTITY': shipment.QUANTITY?.[i] ?? '',
      'CLUB': shipment.CLUB?.[i] ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Details');
    XLSX.writeFile(wb, `${shipment.shipment_number}_Details.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Loading shipment details...</p>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-brand-600 font-medium hover:underline flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Shipments
        </button>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error || 'Shipment not found'}</div>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button onClick={onBack} className="text-brand-600 font-medium hover:underline flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Shipments
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Shipment {shipment.shipment_number} Details</h1>
          <p className="text-sm text-slate-500">
            Date: {formatDate(shipment.shipmentDate)} &nbsp;|&nbsp; Total Qty: {shipment.total_qty?.toLocaleString()} &nbsp;|&nbsp; Total PO: {shipment.total_po}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export Details
        </button>
      </div>

      {/* Table with search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <p className="text-sm text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredRows.length}</span> of {numRows} rows
          </p>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search Order, SKU, UPS Tracking, PO..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none w-80"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">UPS Tracking</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">PO</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SD</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU / ITEM</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Quantity</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Club</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No rows match your search.</td></tr>
              ) : filteredRows.map(i => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-600 font-mono">{shipment.UPSTRACKING?.[i] || '-'}</td>
                  <td className="p-4 text-sm font-medium text-brand-600">{shipment.ORDER?.[i]}</td>
                  <td className="p-4 text-sm text-slate-600">{shipment.PO?.[i] || '-'}</td>
                  <td className="p-4 text-sm text-slate-600">{shipment.SD?.[i] || '-'}</td>
                  <td className="p-4 text-sm text-slate-800">{shipment['SKU/ ITEM']?.[i]}</td>
                  <td className="p-4 text-sm font-medium text-emerald-600 text-right">{shipment.QUANTITY?.[i]}</td>
                  <td className="p-4 text-sm text-slate-600">{shipment.CLUB?.[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

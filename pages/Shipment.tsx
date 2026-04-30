import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../src/services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

export const Shipment: React.FC<{ onViewShipment?: (id: string) => void }> = ({ onViewShipment }) => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isViewer = userProfile?.role === 'viewer';

  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload State
  const [shipmentDate, setShipmentDate] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Chart State
  const [selectedMonth, setSelectedMonth] = useState<string>('All');

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const data = await api.getShipments();
      setShipments(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  // Compute Metrics
  const totalShipments = shipments.length;
  const totalOrders = shipments.reduce((sum, s) => sum + (s.total_order || 0), 0);
  const totalQty = shipments.reduce((sum, s) => sum + (s.total_qty || 0), 0);
  const latestShipment = shipments.length > 0 ? shipments[0] : null;
  const latestMonthQty = latestShipment ? latestShipment.total_qty : 0;

  // Chart 1: Month-wise Qty Shipped
  const monthWiseData = useMemo(() => {
    const map = new Map<string, number>();
    shipments.forEach(s => {
      const month = s.month || 'Unknown';
      map.set(month, (map.get(month) || 0) + (s.total_qty || 0));
    });
    return Array.from(map.entries()).map(([month, qty]) => ({ name: month, qty })).reverse();
  }, [shipments]);

  const uniqueMonths = Array.from(new Set(shipments.map(s => s.month).filter(Boolean)));

  // Chart 2: Shipment Qty per Month
  const shipmentPerMonthData = useMemo(() => {
    let filtered = shipments;
    if (selectedMonth && selectedMonth !== 'All') {
      filtered = shipments.filter(s => s.month === selectedMonth);
    }
    return filtered.map(s => ({
      name: s.shipment_number,
      qty: s.total_qty
    })).reverse();
  }, [shipments, selectedMonth]);

  // Filtered Table Data
  const filteredShipments = useMemo(() => {
    if (!searchTerm) return shipments;
    const lowerSearch = searchTerm.toLowerCase();
    return shipments.filter(s =>
      (s.shipment_number && s.shipment_number.toLowerCase().includes(lowerSearch)) ||
      (s.month && s.month.toLowerCase().includes(lowerSearch))
    );
  }, [shipments, searchTerm]);

  // Handle Upload
  const processExcelAndUpload = async (file: File) => {
    if (!shipmentDate) {
      setError('Please select a shipment date before uploading.');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const runSheetName = workbook.SheetNames.find(n => n === 'RUN');
      if (!runSheetName) throw new Error('Sheet named "RUN" not found in the Excel file.');

      const worksheet = workbook.Sheets[runSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      await api.uploadShipment({
        fileName: file.name,
        shipmentDate,
        rows
      });

      setShipmentDate('');
      await fetchShipments();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcelAndUpload(e.target.files[0]);
    }
  };

  const formatDate = (dateStr: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const downloadExcel = (wb: any, filename: string) => {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const exportData = filteredShipments.map((s, index) => ({
      'Serial No.': index + 1,
      'Shipment Date': formatDate(s.shipmentDate),
      'Shipment Month': s.month,
      'Shipment Number': s.shipment_number,
      'Total Order': s.total_order,
      'Total PO': s.total_po,
      'Total Qty': s.total_qty
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipments');
    downloadExcel(wb, 'Shipments_Export.xlsx');
  };

  const handleDelete = async (id: string, shipmentNumber: string) => {
    if (!confirm(`Delete shipment ${shipmentNumber}? This will permanently remove all data.`)) return;
    try {
      await api.deleteShipment(id);
      setShipments(prev => prev.filter(s => s._id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete shipment');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Global Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shipment Management</h1>
          <p className="text-sm text-slate-500">Track and manage all shipments and UPS tracking numbers.</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export Shipments
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Shipment</span>
          <span className="text-3xl font-black text-brand-600">{totalShipments}</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Shipped Orders</span>
          <span className="text-3xl font-black text-slate-800">{totalOrders.toLocaleString()}</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Qty Shipped</span>
          <span className="text-3xl font-black text-emerald-600">{totalQty.toLocaleString()}</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Latest Month Qty</span>
          <span className="text-3xl font-black text-indigo-600">{latestMonthQty.toLocaleString()}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Month-wise Qty Shipped</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthWiseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="qty" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Shipment Qty per Month</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="All">All Months</option>
              {uniqueMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shipmentPerMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="qty" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">All Shipments Information</h3>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search by ID or Month..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Shipment Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Shipment Number</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Order</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total PO</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Qty</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading shipments...</td></tr>
              ) : filteredShipments.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No shipments found.</td></tr>
              ) : (
                filteredShipments.map((s, index) => (
                  <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-600">{index + 1}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{formatDate(s.shipmentDate)}</td>
                    <td className="p-4 text-sm">
                      <button
                        onClick={() => onViewShipment && onViewShipment(s._id)}
                        className="text-brand-600 font-bold hover:underline hover:text-brand-800"
                      >
                        {s.shipment_number}
                      </button>
                    </td>
                    <td className="p-4 text-sm text-slate-600 text-right">{s.total_order?.toLocaleString()}</td>
                    <td className="p-4 text-sm text-slate-600 text-right">{s.total_po?.toLocaleString()}</td>
                    <td className="p-4 text-sm text-emerald-600 font-medium text-right">{s.total_qty?.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDelete(s._id, s.shipment_number)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        title="Delete shipment"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Section */}
      {!isViewer && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upload New Shipment</h2>

          <div className="flex flex-col sm:flex-row gap-6 mb-6 items-end">
            <div className="flex flex-col flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2">Shipment Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none w-full"
              />
            </div>
            <div className="flex-1">
              <label
                className={`flex justify-center items-center px-8 py-2.5 rounded-lg shadow-sm font-medium transition-colors cursor-pointer w-full text-center ${(!shipmentDate || isUploading) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}
              >
                {isUploading ? 'Processing...' : 'Select Excel File'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={!shipmentDate || isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processExcelAndUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${(!shipmentDate || isUploading) ? 'opacity-50 pointer-events-none' : ''} ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
          >
            <div className="flex flex-col items-center justify-center">
              <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg font-medium text-slate-700 mb-1">Drag & drop "Final ACP Report BDXXXX.xlsx" here</p>
              <p className="text-sm text-slate-500 mb-4">Requires a "run" tab</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';

interface RawDataRow {
  orderId: string;
  salesDocument: string;
  productQty: number;
  material: string;
  clubName: string;
}

interface ClubOrderFileDetailProps {
  clubOrderId: string;
  fileName: string;
  onBack: () => void;
}

export const ClubOrderFileDetail: React.FC<ClubOrderFileDetailProps> = ({ clubOrderId, fileName, onBack }) => {
  const [fileData, setFileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFileDetails();
  }, [clubOrderId, fileName]);

  const fetchFileDetails = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/club-order/${clubOrderId}/file/${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const data = await res.json();
        setFileData(data);
      }
    } catch (err) {
      console.error('Failed to fetch file details', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!fileData || !fileData.rawData) return;
    const worksheet = xlsx.utils.json_to_sheet(fileData.rawData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Raw Data');
    
    // Download
    xlsx.writeFile(workbook, `${fileData.originalName || fileName}_export.xlsx`);
  };

  if (loading) {
    return <div className="p-6">Loading file details...</div>;
  }

  if (!fileData) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <button onClick={onBack} className="text-brand-600 hover:underline">&larr; Back to Dashboard</button>
        <p className="text-red-500">Failed to load file details.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full p-6 bg-slate-50 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{fileData.originalName || fileName.replace(/_DOT_/g, '.')}</h1>
            <p className="text-sm text-slate-500 mt-1">Batch: {fileData.batch} | Total Orders: {fileData.totalOrder}</p>
          </div>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg shadow-sm hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export to Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Raw Data ({fileData.rawData?.length || 0} Rows)</h2>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-semibold">Order ID</th>
                <th className="p-4 font-semibold">Sales Document</th>
                <th className="p-4 font-semibold">Product Qty</th>
                <th className="p-4 font-semibold">Material</th>
                <th className="p-4 font-semibold">Club Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fileData.rawData && fileData.rawData.length > 0 ? (
                fileData.rawData.map((row: RawDataRow, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-800">{row.orderId}</td>
                    <td className="p-4 text-sm text-slate-600">{row.salesDocument}</td>
                    <td className="p-4 text-sm text-slate-600">{row.productQty}</td>
                    <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={row.material}>{row.material}</td>
                    <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={row.clubName}>{row.clubName}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">No raw data available for this file.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

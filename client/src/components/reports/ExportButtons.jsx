import { useState } from 'react';
import { Download, FileText, Sheet } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import toast from 'react-hot-toast';

export default function ExportButtons({ classId, sessionId }) {
  const [loading, setLoading] = useState(null);

  const downloadCSV = async () => {
    setLoading('csv');
    try {
      const blob = await reportService.exportCSV(classId, sessionId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `attendance-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch { toast.error('CSV export failed'); }
    finally   { setLoading(null); }
  };

  const downloadPDF = async () => {
    setLoading('pdf');
    try {
      const blob = await reportService.exportPDF(classId, sessionId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `attendance-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('PDF export failed'); }
    finally   { setLoading(null); }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={downloadCSV}
        disabled={loading === 'csv'}
        className="btn-ghost text-sm gap-2"
      >
        {loading === 'csv'
          ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <Sheet size={14} />
        }
        Export CSV
      </button>
      <button
        onClick={downloadPDF}
        disabled={loading === 'pdf'}
        className="btn-ghost text-sm gap-2"
      >
        {loading === 'pdf'
          ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <FileText size={14} />
        }
        Export PDF
      </button>
    </div>
  );
}
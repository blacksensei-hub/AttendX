// client/src/pages/admin/ImportUsers.jsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FileDown, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Sig } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Switch } from '../../components/console/controls';
import { EASE } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Import users from the registrar's CSV.
 *
 *   1  Upload   drop or pick a CSV, or paste one; headers are matched
 *               by name ("Student ID", "student_id", "Index No" ...)
 *   2  Check    a dry run on the server validates every row (valid
 *               email, 10-digit IDs, duplicates in the file and in the
 *               database) and lists problems per line
 *   3  Import   creates the valid rows only; each person gets a 7-day
 *               invite link to choose a password
 * ═════════════════════════════════════════════════════════════════
 */

// RFC 4180-ish: quoted fields, doubled quotes, commas and newlines in quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

const HEADERS = {
  name:       ['name', 'full name', 'fullname', 'student name', 'lecturer name'],
  email:      ['email', 'email address', 'e-mail', 'mail'],
  role:       ['role', 'type', 'account type'],
  studentId:  ['student id', 'studentid', 'student_id', 'index', 'index no', 'index number', 'id number', 'student number'],
  department: ['department', 'dept', 'faculty', 'programme', 'program'],
};

function toRecords(table) {
  const [head, ...body] = table;
  const norm = head.map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const index = Object.fromEntries(Object.entries(HEADERS).map(([key, names]) => [key, norm.findIndex(h => names.includes(h))]));
  const missing = ['name', 'email'].filter(k => index[k] < 0);
  const records = body.map((r, i) => ({
    line: i + 2,
    name: r[index.name]?.trim() ?? '',
    email: r[index.email]?.trim() ?? '',
    role: index.role >= 0 ? r[index.role]?.trim().toLowerCase() || 'student' : 'student',
    studentId: index.studentId >= 0 ? r[index.studentId]?.trim() ?? '' : '',
    department: index.department >= 0 ? r[index.department]?.trim() ?? '' : '',
  }));
  return { records, index, missing };
}

const TEMPLATE = 'name,email,role,student_id,department\nAma Owusu,ama.owusu@example.edu,student,4231230101,Computer Science\nDr. Kofi Asare,k.asare@example.edu,lecturer,,Telecommunication Engineering\n';

function saveText(text, filename) {
  const href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

const csvCell = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);

export default function ImportUsers() {
  const qc = useQueryClient();
  const input = useRef(null);
  const [step, setStep] = useState('upload');      // upload | check | done
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState([]);
  const [report, setReport] = useState(null);       // dry-run result
  const [result, setResult] = useState(null);       // import result
  const [sendInvites, setSendInvites] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async (text, name) => {
    const table = parseCsv(text.replace(/^\uFEFF/, ''));
    if (table.length < 2) { toast.error('That file has no rows under the header'); return; }
    const { records: rows, missing } = toRecords(table);
    if (missing.length) { toast.error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`); return; }
    if (rows.length > 2000) { toast.error('Import at most 2,000 rows at a time'); return; }
    setFileName(name);
    setRecords(rows);
    setWorking(true);
    try {
      const r = await consoleApi.importUsers(rows, true);
      setReport(r);
      setStep('check');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not check the file');
    } finally {
      setWorking(false);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { toast.error('Choose a .csv file'); return; }
    load(await file.text(), file.name);
  };

  const commit = async () => {
    setWorking(true);
    try {
      const r = await consoleApi.importUsers(records, false, sendInvites);
      setResult(r);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      toast.success(r.message);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally {
      setWorking(false);
    }
  };

  const reset = () => { setStep('upload'); setRecords([]); setReport(null); setResult(null); setPasted(''); setFileName(''); };

  const rowsCols = [
    { key: 'line', header: 'Line', num: true, width: 60, render: r => <span className="tabular c-muted">{r.line}</span> },
    { key: 'name', header: 'Person', render: r => <span><span className="cell-main">{r.name || '—'}</span><span className="cell-sub">{r.email || '—'}</span></span> },
    { key: 'role', header: 'Role', render: r => <span className="chip">{r.role}</span> },
    { key: 'sid', header: 'Student ID', render: r => <span className="tabular">{r.studentId || '—'}</span> },
    { key: 'dept', header: 'Department', render: r => r.department || <span className="c-muted">—</span> },
    { key: 'check', header: 'Check', render: r => (r.errors.length
      ? <span style={{ color: 'var(--red)', fontSize: 12.5 }}>{r.errors.join(' · ')}</span>
      : <Sig tone="live">Ready</Sig>) },
  ];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="People / Import"
        title="Import users"
        lede="Create student and lecturer accounts from a CSV. Nobody gets a password from you: each person receives a link to set their own."
        actions={<Link to="/admin/users" className="btn-ghost btn-sm"><ArrowLeft size={15} /> Users</Link>}
      />

      <ol className="c-toolbar" aria-label="Steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {[['upload', '1  Upload'], ['check', '2  Check'], ['done', '3  Import']].map(([key, label]) => (
          <li key={key} className={`chip${step === key ? ' brand' : ''}`} aria-current={step === key ? 'step' : undefined}>{label}</li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE.entry }} className="c-grid">
            <Panel className="span-8" label="Step 1" title="Choose the file">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
                disabled={working}
                style={{
                  width: '100%', padding: '44px 20px', borderRadius: 'var(--radius-molecular)', cursor: 'pointer',
                  border: `1.5px dashed ${dragging ? 'var(--brand)' : 'var(--border-strong)'}`,
                  background: dragging ? 'var(--brand-subtle)' : 'var(--bg-raised)', color: 'var(--text-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, font: 'inherit',
                  transition: 'border-color var(--duration-fast) var(--ease-state), background-color var(--duration-fast) var(--ease-state)',
                }}
              >
                {working ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{working ? 'Checking every row...' : 'Drop a CSV here, or click to choose one'}</span>
                <span style={{ fontSize: 12.5 }}>Columns: name, email, role, student_id, department. Up to 2,000 rows.</span>
              </button>
              <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

              <details style={{ marginTop: 16 }}>
                <summary className="c-subtle" style={{ cursor: 'pointer', fontSize: 13.5 }}><ClipboardPaste size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Or paste the CSV instead</summary>
                <textarea className="c-textarea" style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 12.5 }} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={TEMPLATE} />
                <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={!pasted.trim() || working} onClick={() => load(pasted, 'pasted rows')}>Check these rows</button>
              </details>
            </Panel>

            <Panel className="span-4" label="Format" title="What the file needs">
              <ul style={{ fontSize: 13.5, color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18 }}>
                <li><strong style={{ color: 'var(--text-primary)' }}>name</strong> and <strong style={{ color: 'var(--text-primary)' }}>email</strong> on every row</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>role</strong>: student or lecturer (blank means student)</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>student_id</strong>: 10 digits, students only</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>department</strong> is optional but powers analytics and announcements</li>
              </ul>
              <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => saveText(TEMPLATE, 'attendx-import-template.csv')}>
                <FileDown size={14} /> Download a template
              </button>
            </Panel>
          </motion.div>
        )}

        {step === 'check' && report && (
          <motion.div key="check" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE.entry }} className="c-page">
            <Panel label={`Step 2 · ${fileName}`} title={report.summary.invalid
              ? `${report.summary.valid} of ${report.summary.total} rows are ready`
              : `All ${report.summary.total} rows are ready`}
              actions={(
                <>
                  <button type="button" className="btn-ghost btn-sm" onClick={reset} disabled={working}>Choose another file</button>
                  <button type="button" className="btn-accent btn-sm" onClick={commit} disabled={working || !report.summary.valid}>
                    {working && <Loader2 size={14} className="animate-spin" />} Import {report.summary.valid} account{report.summary.valid === 1 ? '' : 's'}
                  </button>
                </>
              )}>
              <div className="c-actions" style={{ gap: 14 }}>
                {report.summary.invalid > 0 && (
                  <span className="chip red"><AlertCircle size={13} /> {report.summary.invalid} row{report.summary.invalid === 1 ? '' : 's'} will be skipped</span>
                )}
                <label className="c-actions" style={{ gap: 10, fontSize: 13.5, color: 'var(--text-subtle)' }}>
                  <Switch checked={sendInvites} onChange={setSendInvites} label="Email invites" /> Email each person their invite link
                </label>
              </div>
            </Panel>
            <Panel flush>
              <DataTable caption="Rows in the file" columns={rowsCols} rows={[...report.rows].sort((a, b) => b.errors.length - a.errors.length || a.line - b.line)} rowKey={r => r.line} />
            </Panel>
          </motion.div>
        )}

        {step === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE.entry }}>
            <Panel label="Step 3" title={`${result.created.length} account${result.created.length === 1 ? '' : 's'} created`}>
              <p className="c-subtle" style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                {result.emailing
                  ? 'Invites are being emailed now. Links work once and expire in 7 days.'
                  : 'No emails were sent. Share the invite links yourself; each works once and expires in 7 days.'}
              </p>
              <div className="c-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn-ghost btn-sm" onClick={() => saveText(
                  `name,email,role,invite_link\n${result.created.map(u => [u.name, u.email, u.role, u.inviteLink].map(csvCell).join(',')).join('\n')}\n`,
                  'attendx-invite-links.csv',
                )}><FileDown size={14} /> Download invite links</button>
                <Link to="/admin/users?status=invited" className="btn-ghost btn-sm">See pending invites</Link>
                <button type="button" className="btn-accent btn-sm" onClick={reset}>Import another file</button>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

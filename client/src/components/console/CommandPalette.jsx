// client/src/components/console/CommandPalette.jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, CornerDownLeft, User, BookOpen, Radio, Sun, Moon, FileDown, ShieldCheck,
  UserPlus, Megaphone, CalendarPlus, MonitorPlay,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ADMIN_PAGES } from '../layout/adminNav';
import { consoleApi } from '../../services/consoleService';
import { useUIStore } from '../../store/uiStore';
import { SPRING, DURATION } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Ctrl/Cmd+K for the admin console, on cmdk (accessible combobox,
 * fuzzy matching, arrow keys, Enter, Escape).
 *
 * Three kinds of result: every console page, common actions, and
 * live search over people, classes and sessions (from 2 characters,
 * debounced). Picking a person or class opens its page focused on it.
 * ═════════════════════════════════════════════════════════════════
 */

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], classes: [], sessions: [] });
  const consoleTheme = useUIStore(s => s.consoleTheme);
  const toggleConsoleTheme = useUIStore(s => s.toggleConsoleTheme);

  // Live search, debounced; stale answers are ignored.
  useEffect(() => {
    if (!open || query.trim().length < 2) return undefined;
    let live = true;
    const t = setTimeout(() => {
      consoleApi.search(query.trim()).then(r => { if (live) setResults(r); }).catch(() => {});
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [query, open]);

  const close = () => { onClose(); setQuery(''); setResults({ users: [], classes: [], sessions: [] }); };
  const go = (to) => { close(); navigate(to); };
  const run = async (fn, ok) => {
    close();
    try { await fn(); if (ok) toast.success(ok); } catch (err) { toast.error(err?.response?.data?.message || 'That did not work'); }
  };

  const searching = query.trim().length >= 2;
  const ACTIONS = [
    { label: 'Import users from CSV', icon: UserPlus, onSelect: () => go('/admin/users/import') },
    { label: 'New announcement', icon: Megaphone, onSelect: () => go('/admin/announcements?new=1') },
    { label: 'Add a holiday or exam period', icon: CalendarPlus, onSelect: () => go('/admin/calendar?new=event') },
    { label: 'Run the fraud checks now', icon: ShieldCheck, onSelect: () => run(consoleApi.sweepFraud, 'Fraud checks finished') },
    { label: 'Open the ops wall', icon: MonitorPlay, onSelect: () => go('/admin/ops') },
    { label: 'Download the institution report (PDF)', icon: FileDown, onSelect: () => run(() => consoleApi.analyticsPdf(), 'Report downloaded') },
    { label: consoleTheme === 'dark' ? 'Switch the console to light' : 'Switch the console to dark', icon: consoleTheme === 'dark' ? Sun : Moon, onSelect: () => { toggleConsoleTheme(); close(); } },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="c-overlay console-portal" onClick={close}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: DURATION.fast } }} />
          <motion.div
            className="cmdk-panel console-portal"
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: DURATION.fast } }}
            transition={SPRING.snappy}
          >
            <Command label="Command palette" loop onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
              <div style={{ position: 'relative' }}>
                <Search size={17} className="cmdk-search-icon" aria-hidden="true" />
                <Command.Input value={query} onValueChange={setQuery} autoFocus placeholder="Search people, classes, pages, actions..." />
              </div>
              <Command.List>
                <Command.Empty>No match for "{query}".</Command.Empty>

                {searching && results.users.length > 0 && (
                  <Command.Group heading="People">
                    {results.users.map(u => (
                      <Command.Item key={u.id} value={`user ${u.name} ${u.email} ${u.student_id ?? ''}`} onSelect={() => go(`/admin/users?focus=${u.id}`)}>
                        <User size={16} />
                        <span>{u.name}<span className="c-muted" style={{ marginLeft: 8, fontSize: 12 }}>{u.email}</span></span>
                        <span className="meta">{u.role}{u.is_active ? '' : ' · inactive'}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {searching && results.classes.length > 0 && (
                  <Command.Group heading="Classes">
                    {results.classes.map(c => (
                      <Command.Item key={c.id} value={`class ${c.code} ${c.name} ${c.department ?? ''}`} onSelect={() => go(`/admin/classes?focus=${c.id}`)}>
                        <BookOpen size={16} />
                        <span>{c.name}</span>
                        <span className="meta">{c.code}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {searching && results.sessions.length > 0 && (
                  <Command.Group heading="Sessions">
                    {results.sessions.map(s => (
                      <Command.Item key={s.id} value={`session ${s.title ?? ''} ${s.class_name_snapshot ?? ''}`} onSelect={() => go('/admin/sessions')}>
                        <Radio size={16} />
                        <span>{s.class_name_snapshot ?? s.title ?? 'Session'}</span>
                        <span className="meta">{s.status === 'open' ? 'live' : new Date(s.open_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Actions">
                  {ACTIONS.map(a => (
                    <Command.Item key={a.label} value={`action ${a.label}`} onSelect={a.onSelect}>
                      <a.icon size={16} />
                      <span>{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Go to">
                  {ADMIN_PAGES.map(p => (
                    <Command.Item key={p.to} value={`page ${p.label} ${p.group} ${p.desc}`} onSelect={() => go(p.to)}>
                      <p.icon size={16} />
                      <span>{p.label}</span>
                      <span className="meta">{p.group}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
              <div className="cmdk-foot" aria-hidden="true">
                <span><span className="kbd">↑</span><span className="kbd">↓</span> move</span>
                <span><span className="kbd"><CornerDownLeft size={10} /></span> open</span>
                <span><span className="kbd">esc</span> close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

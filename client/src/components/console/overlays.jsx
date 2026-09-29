// client/src/components/console/overlays.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { EASE, SPRING, DURATION } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Drawer (side sheet) and ConfirmDialog. Both portal to <body>, trap
 * nothing but restore focus to the opener, close on Escape and on the
 * backdrop, and exit faster than they enter.
 * ═════════════════════════════════════════════════════════════════
 */

function useOverlay(open, onClose) {
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener.current?.focus?.();
    };
  }, [open, onClose]);
}

export function Drawer({ open, onClose, label, title, children, footer }) {
  useOverlay(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="c-overlay console-portal" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: DURATION.fast } }} />
          <motion.aside
            className="c-drawer console-portal"
            role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : label}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: DURATION.base, ease: EASE.exit } }}
            transition={SPRING.page}
          >
            <div className="c-drawer-head">
              <div style={{ minWidth: 0 }}>
                {label && <p className="c-label">{label}</p>}
                <h2 className="c-title" style={{ fontSize: 18, marginTop: 4 }}>{title}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" autoFocus><X size={16} /></button>
            </div>
            <div className="c-drawer-body">{children}</div>
            {footer && <div className="c-drawer-foot">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = false, busy = false }) {
  useOverlay(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="c-overlay console-portal" onClick={busy ? undefined : onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: DURATION.fast } }} />
          <motion.div
            className="c-dialog console-portal"
            role="alertdialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: DURATION.fast, ease: EASE.exit } }}
            transition={SPRING.snappy}
          >
            <h2 className="c-title" style={{ fontSize: 17 }}>{title}</h2>
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-subtle)', lineHeight: 1.55 }}>{children}</div>
            <div className="c-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className={`${danger ? 'btn-danger' : 'btn-accent'} btn-sm`} onClick={onConfirm} disabled={busy} autoFocus>
                {busy && <Loader2 size={14} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

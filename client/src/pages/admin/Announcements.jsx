// client/src/pages/admin/Announcements.jsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import {
  Megaphone, Users, GraduationCap, BookOpen,
  Send, Loader2, CheckCircle, Mail, ChevronDown,
  AlertCircle,
}                                           from 'lucide-react';
import toast                                from 'react-hot-toast';
import { adminService }                     from '../../services/adminService';
import { useIsMobile }                      from '../../hooks/useIsMobile';
import { SPRING }                           from '../../lib/motion';

const TARGET_OPTIONS = [
  { value: 'all',      label: 'Everyone',        icon: Users,         desc: 'All active students and lecturers'  },
  { value: 'student',  label: 'Students only',   icon: GraduationCap, desc: 'All enrolled active students'       },
  { value: 'lecturer', label: 'Lecturers only',  icon: BookOpen,      desc: 'All active lecturers'               },
];

export default function AdminAnnouncementsPage() {
  const isMobile = useIsMobile();

  const [title,      setTitle]      = useState('');
  const [message,    setMessage]    = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [sendEmail,  setSendEmail]  = useState(false);
  const [preview,    setPreview]    = useState(null);  // { count }
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(null);  // result of last send
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Fetch preview count whenever audience changes ─────────
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await adminService.previewAnnouncement({ targetRole });
      setPreview(result);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [targetRole]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const canSend = title.trim().length >= 3 && message.trim().length >= 10 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSent(null);
    try {
      const result = await adminService.sendAnnouncement({
        title:      title.trim(),
        message:    message.trim(),
        targetRole,
        sendEmail,
      });
      setSent(result);
      toast.success(`Sent to ${result.sent} user${result.sent === 1 ? '' : 's'}`);
      // Reset form
      setTitle('');
      setMessage('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      padding:   isMobile ? 'var(--space-3)' : 'var(--space-6)',
      maxWidth:  820,
      margin:    '0 auto',
      fontFamily:'var(--font-display)',
    }}>

      {/* Page header */}
      <header style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={18} color="var(--brand-text)" />
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Announcements
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', maxWidth: 560 }}>
          Broadcast a message to your platform users. Recipients receive an in-app notification instantly.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px' }}>

        {/* ── Left: compose form ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* Title */}
          <Field label="Title" required hint="Keep it short and descriptive">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. System maintenance on Friday"
              style={inputStyle(title.length > 0 && title.trim().length < 3)}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
              {title.length}/120
            </div>
          </Field>

          {/* Message */}
          <Field label="Message" required hint="Be clear and specific">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              maxLength={1000}
              placeholder="Write the full announcement here. Recipients will see this in their notification bell."
              style={{ ...inputStyle(message.length > 0 && message.trim().length < 10), resize: 'vertical', minHeight: 140, lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
              {message.length}/1000
            </div>
          </Field>

          {/* Email toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--space-3)', background: 'var(--bg-card)', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setSendEmail(v => !v)}
          >
            <div style={{ width: 38, height: 22, borderRadius: 99, background: sendEmail ? 'var(--brand)' : 'var(--bg-raised)', border: '1px solid var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: sendEmail ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={13} color="var(--text-muted)" />
                Also send by email
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Sends an email to each recipient in addition to the in-app notification
              </div>
            </div>
          </div>

          {/* Send button */}
          <motion.button
            whileTap={canSend ? { scale: 0.98 } : {}}
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 20px', borderRadius: 'var(--radius-atomic)',
              border: 'none', background: canSend ? 'var(--brand)' : 'var(--bg-raised)',
              color: canSend ? '#fff' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s', fontFamily: 'inherit',
              opacity: canSend ? 1 : 0.6,
            }}
          >
            {sending
              ? <><Loader2 size={16} className="annSpin" /> Sending…</>
              : <><Send size={15} /> Send announcement</>
            }
          </motion.button>

          {/* Success confirmation */}
          <AnimatePresence>
            {sent && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={SPRING.snappy}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--space-3)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-atomic)' }}
              >
                <CheckCircle size={18} color="#10b981" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                    Announcement sent to {sent.sent} user{sent.sent === 1 ? '' : 's'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {sent.sentEmail ? 'In-app notifications and emails delivered.' : 'In-app notifications delivered.'}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: audience panel ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg,14px)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Audience</div>
            </div>

            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TARGET_OPTIONS.map(opt => {
                const Icon     = opt.icon;
                const isActive = targetRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetRole(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${isActive ? 'var(--brand-border)' : 'var(--border)'}`,
                      background: isActive ? 'var(--brand-subtle)' : 'var(--bg-card)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--brand-subtle)' : 'var(--bg-raised)', flexShrink: 0 }}>
                      <Icon size={14} color={isActive ? 'var(--brand-text)' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--brand-text)' : 'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                    {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reach count */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg,14px)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Estimated reach
            </div>
            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                <Loader2 size={14} className="annSpin" /> Counting…
              </div>
            ) : preview ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {preview.count}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  user{preview.count === 1 ? '' : 's'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                <AlertCircle size={13} /> Unable to count
              </div>
            )}
            {preview?.count === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>
                No users match this audience — the announcement won't be sent.
              </div>
            )}
          </div>

          {/* Tips */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg,14px)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Tips
            </div>
            {[
              'Recipients see this in their notification bell immediately.',
              'Use email option for urgent announcements.',
              'Keep titles under 60 characters for best readability.',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, marginTop: 7 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`.annSpin{animation:annSpinK 0.9s linear infinite}@keyframes annSpinK{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = (hasError) => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-atomic)',
  border: `1px solid ${hasError ? 'var(--red-border)' : 'var(--border)'}`,
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'var(--font-body)',
  transition: 'border-color 0.15s',
});
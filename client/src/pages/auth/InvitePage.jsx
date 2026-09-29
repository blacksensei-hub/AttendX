// client/src/pages/auth/InvitePage.jsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { inviteApi } from '../../services/consoleService';
import { SPRING, TAP } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Accept an invite: accounts an admin imported start here. The link
 * carries a one-time token; this page shows whose account it is and
 * lets them choose a password, then sends them to sign in.
 * ═════════════════════════════════════════════════════════════════
 */
export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => inviteApi.check(token),
    retry: false,
  });

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= 8 && confirm === password;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await inviteApi.accept(token, password);
      toast.success('Password set. Sign in to continue.');
      navigate('/login', { replace: true, state: { email: data.email } });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not set the password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.gentle} style={{ width: '100%', maxWidth: 440 }}>
      <p className="kicker"><span className="dot" /> Set up your account</p>

      {isPending && (
        <p style={{ marginTop: 24, color: 'var(--text-subtle)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Loader2 size={16} className="animate-spin" /> Checking your invite…
        </p>
      )}

      {isError && (
        <>
          <h1 style={titleStyle}>This link has expired.</h1>
          <p style={ledeStyle}>{error?.response?.data?.message ?? 'The invite could not be found.'}</p>
          <Link to="/login" className="btn-ghost" style={{ marginTop: 24, width: 'fit-content' }}>Go to sign in</Link>
        </>
      )}

      {data && (
        <>
          <h1 style={titleStyle}>Welcome, {data.name.split(' ')[0]}.</h1>
          <p style={ledeStyle}>
            Your AttendX {data.role} account for <strong style={{ color: 'var(--text-primary)' }}>{data.email}</strong> is ready. Choose a password to finish.
          </p>
          <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <PasswordField label="Password" value={password} onChange={setPassword} show={show} onToggle={() => setShow(s => !s)}
                           error={tooShort ? 'Use at least 8 characters' : null} autoFocus autoComplete="new-password" />
            <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} show={show}
                           error={mismatch ? 'The passwords do not match' : null} autoComplete="new-password" />
            <motion.button whileTap={TAP.button} type="submit" className="btn-accent" disabled={!ready || saving}
                           style={{ height: 52, marginTop: 8, fontSize: 'var(--text-base)' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Saving…' : <>Set password <ArrowRight size={16} /></>}
            </motion.button>
          </form>
        </>
      )}
    </motion.div>
  );
}

const titleStyle = {
  fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 4.6vw, 52px)', fontWeight: 650,
  color: 'var(--text-primary)', letterSpacing: '-0.036em', lineHeight: 1, margin: '16px 0 12px',
};
const ledeStyle = { color: 'var(--text-subtle)', fontSize: 'var(--text-base)', lineHeight: 1.55 };

function PasswordField({ label, value, onChange, show, onToggle, error, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="label" style={{ marginBottom: 0 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: error ? 'var(--red)' : 'var(--text-muted)', pointerEvents: 'none' }} />
        <input className="input-base" type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
               aria-invalid={Boolean(error)} style={{ paddingLeft: 38, paddingRight: onToggle ? 44 : undefined }} {...rest} />
        {onToggle && (
          <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 8, border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

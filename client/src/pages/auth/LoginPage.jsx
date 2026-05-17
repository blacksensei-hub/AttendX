// client/src/pages/auth/LoginPage.jsx
import { useState }                          from 'react';
import { Link, useNavigate, useLocation }    from 'react-router-dom';
import { useForm }                           from 'react-hook-form';
import { zodResolver }                       from '@hookform/resolvers/zod';
import { z }                                 from 'zod';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Eye, EyeOff, LogIn, Mail, Lock, ArrowRight,
}                                            from 'lucide-react';
import toast                                 from 'react-hot-toast';

import { useAuthStore }                      from '../../store/authStore';
import { authService }                       from '../../services/authService';
import { EASE, DURATION, SPRING, TAP }       from '../../lib/motion';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Maps a user role to its home route
function roleHome(role) {
  if (role === 'admin')    return '/admin';
  if (role === 'lecturer') return '/lecturer';
  return '/student';
}

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [showPw, setShowPw] = useState(false);
  const from = location.state?.from?.pathname || null;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, password }) => {
    try {
      const { user, token } = await authService.login(email, password);
      setAuth(user, token);
      toast.success(`Welcome back, ${user.name}`);

      const home = roleHome(user.role);
      // Only honour `from` if it's under the user's own area.
      // Prevents a stale /student redirect sending an admin the wrong way.
      const dest = from && from.startsWith(home) ? from : home;
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    }
  };

  const fillDemo = (email, password) => {
    setValue('email',    email,    { shouldValidate: true });
    setValue('password', password, { shouldValidate: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.entry }}
    >

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ...SPRING.gentle }}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)',
          fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '6px',
        }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
          Sign in to{' '}
          <span className="gradient-text" style={{ fontWeight: 600 }}>AttendX</span>
          {' '}to manage your classes and attendance.
        </p>
      </motion.div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        noValidate
      >
        {/* Email */}
        <Field label="Email address" icon={Mail} error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            placeholder="you@university.edu"
            className="input-base"
            autoComplete="email"
            style={{
              paddingLeft: '36px',
              borderColor: errors.email ? 'var(--red-border)' : undefined,
            }}
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          icon={Lock}
          error={errors.password?.message}
          action={
            <motion.button
              whileTap={TAP.button}
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
                fontWeight: 500, padding: 0,
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: `color ${DURATION.base}ms ${EASE.state}`,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={showPw ? 'hide' : 'show'}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{    opacity: 0, x: 4 }}
                  transition={{ duration: DURATION.fast, ease: EASE.state }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showPw ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Show</>}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          }
        >
          <input
            {...register('password')}
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            className="input-base"
            autoComplete="current-password"
            style={{
              paddingLeft:   '36px',
              borderColor:   errors.password ? 'var(--red-border)' : undefined,
              fontFamily:    showPw ? 'var(--font-mono)' : 'var(--font-body)',
              letterSpacing: showPw ? '0.04em' : 'normal',
            }}
          />
        </Field>

        {/* Submit */}
        <motion.button
          whileTap={TAP.button}
          whileHover={!isSubmitting ? { y: -1 } : undefined}
          transition={SPRING.snappy}
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
          style={{ height: '48px', marginTop: '8px', fontSize: 'var(--text-sm)', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? (
            <>
              <span style={{
                width: '14px', height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: 'var(--radius-pill)',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }} />
              Signing in…
            </>
          ) : (
            <><LogIn size={15} /> Sign in <ArrowRight size={14} /></>
          )}
        </motion.button>
      </form>

      {/* Demo credentials */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, ...SPRING.gentle }}
        style={{
          marginTop: 'var(--space-3)', padding: 'var(--space-3)',
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-molecular)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--brand-subtle)', filter: 'blur(40px)', opacity: 0.5, pointerEvents: 'none' }} />

        <p style={{
          position: 'relative', color: 'var(--text-muted)', fontSize: '10px',
          fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '10px',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Demo credentials · click to autofill
        </p>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { role: 'Lecturer', email: 'lecturer@demo.com', pw: 'demo1234' },
            { role: 'Student',  email: 'student@demo.com',  pw: 'demo1234' },
          ].map((d) => (
            <motion.button
              key={d.role}
              whileTap={TAP.button}
              whileHover={{ x: 2 }}
              transition={SPRING.snappy}
              type="button"
              onClick={() => fillDemo(d.email, d.pw)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '8px', padding: '8px 12px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-atomic)', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font-body)',
                transition: `border-color ${DURATION.base}ms ${EASE.state}`,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-border)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ color: 'var(--brand-text)', fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {d.role}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.email} · {d.pw}
                </span>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Register link */}
      <p style={{ marginTop: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        New to AttendX?{' '}
        <Link
          to="/register"
          style={{ color: 'var(--brand-text)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px dashed transparent', transition: `border-color ${DURATION.base}ms ${EASE.state}` }}
          onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--brand-border)'}
          onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
        >
          Create an account
        </Link>
      </p>
    </motion.div>
  );
}

// ─── Field with icon + optional action + error ────────────────
function Field({ label, icon: Icon, action, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <label style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
          {label}
        </label>
        {action}
      </div>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon size={14} style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: error ? 'var(--red)' : 'var(--text-muted)',
            pointerEvents: 'none', transition: `color ${DURATION.base}ms ${EASE.state}`,
          }} />
        )}
        {children}
      </div>
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE.state }}
            style={{ color: 'var(--red)', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
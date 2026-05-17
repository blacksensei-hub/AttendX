import { useState }                          from 'react';
import { Link, useNavigate }                 from 'react-router-dom';
import { useForm }                           from 'react-hook-form';
import { zodResolver }                       from '@hookform/resolvers/zod';
import { z }                                 from 'zod';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Eye, EyeOff, UserPlus, Mail, Lock, User,
  GraduationCap, Hash, ArrowRight, Check, X,
}                                            from 'lucide-react';
import toast                                 from 'react-hot-toast';

import { useAuthStore }                      from '../../store/authStore';
import { authService }                       from '../../services/authService';
import {
  EASE, DURATION, SPRING, TAP,
}                                            from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * RegisterPage — new-account signup.
 *
 * Shares auth-page visual language with LoginPage: same icon-in-
 * input pattern, same hero title treatment, same motion vocabulary.
 *
 * Role selector is the primary first decision — lecturer vs student
 * — and conditionally reveals the optional Student ID field.
 *
 * Password has a live strength indicator (length, uppercase, digit)
 * so users know what zod is validating as they type.
 * ═════════════════════════════════════════════════════════════════
 */

const schema = z.object({
  name:      z.string().min(2, 'Name must be at least 2 characters'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string()
               .min(8, 'Password must be at least 8 characters')
               .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
               .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPw: z.string(),
  role:      z.enum(['student', 'lecturer']),
  studentId: z.string().optional(),
}).refine(d => d.password === d.confirmPw, {
  message: 'Passwords do not match',
  path:    ['confirmPw'],
});

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [showPw, setShowPw] = useState(false);

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver:      zodResolver(schema),
    defaultValues: { role: 'student' },
  });

  const role     = watch('role');
  const password = watch('password') || '';

  // Password strength checks — live visual feedback
  const checks = [
    { label: '8+ characters',    pass: password.length >= 8 },
    { label: 'One uppercase',    pass: /[A-Z]/.test(password) },
    { label: 'One number',       pass: /[0-9]/.test(password) },
  ];

  const onSubmit = async (data) => {
    try {
      const { user, token } = await authService.register(data);
      setAuth(user, token);
      toast.success('Welcome to AttendX');
      navigate(user.role === 'lecturer' ? '/lecturer' : '/student', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.entry }}
    >

      {/* ── Title ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ...SPRING.gentle }}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <h1 style={{
          fontFamily:    'var(--font-display)',
          fontSize:      'var(--text-2xl)',
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight:    1.1,
          marginBottom:  '6px',
        }}>
          Create your account
        </h1>
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   'var(--text-sm)',
          lineHeight: 1.5,
        }}>
          Join <span className="gradient-text" style={{ fontWeight: 600 }}>AttendX</span> to manage or track class attendance.
        </p>
      </motion.div>

      {/* ── Form ────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           'var(--space-3)',
        }}
        noValidate
      >

        {/* Role selector */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '6px',
        }}>
          <label style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-xs)',
            fontWeight: 600,
          }}>
            I am a
          </label>
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 '8px',
          }}>
            {[
              { value: 'student',  label: 'Student',  icon: GraduationCap, desc: 'Join classes and mark attendance' },
              { value: 'lecturer', label: 'Lecturer', icon: User,          desc: 'Create classes and open sessions' },
            ].map(({ value, label, icon: Icon, desc }) => {
              const selected = role === value;
              return (
                <motion.label
                  key={value}
                  whileTap={TAP.button}
                  whileHover={!selected ? { y: -1 } : undefined}
                  transition={SPRING.snappy}
                  animate={{
                    borderColor:     selected ? 'var(--brand)'        : 'var(--border)',
                    backgroundColor: selected ? 'var(--brand-subtle)' : 'var(--bg-raised)',
                  }}
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'flex-start',
                    gap:           '8px',
                    padding:       '12px',
                    borderRadius:  'var(--radius-atomic)',
                    border:        '1px solid',
                    cursor:        'pointer',
                    position:      'relative',
                    overflow:      'hidden',
                  }}
                >
                  <input
                    type="radio"
                    value={value}
                    {...register('role')}
                    style={{ display: 'none' }}
                  />

                  <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    width:          '100%',
                  }}>
                    <div style={{
                      width:          '28px',
                      height:         '28px',
                      borderRadius:   'var(--radius-atomic)',
                      background:     selected ? 'var(--brand)' : 'var(--bg-card)',
                      border:         `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      transition:     `all ${DURATION.base}ms ${EASE.state}`,
                    }}>
                      <Icon size={14} style={{
                        color: selected ? '#fff' : 'var(--text-muted)',
                      }} />
                    </div>

                    {/* Checkmark when selected */}
                    <AnimatePresence>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{    scale: 0, opacity: 0 }}
                          transition={SPRING.bounce}
                          style={{
                            width:          '18px',
                            height:         '18px',
                            borderRadius:   'var(--radius-pill)',
                            background:     'var(--brand)',
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={11} style={{ color: '#fff', strokeWidth: 3 }} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <p style={{
                      color:         selected ? 'var(--brand-text)' : 'var(--text-primary)',
                      fontSize:      'var(--text-sm)',
                      fontWeight:    600,
                      fontFamily:    'var(--font-display)',
                      marginBottom:  '2px',
                    }}>
                      {label}
                    </p>
                    <p style={{
                      color:      'var(--text-muted)',
                      fontSize:   '10px',
                      lineHeight: 1.4,
                    }}>
                      {desc}
                    </p>
                  </div>
                </motion.label>
              );
            })}
          </div>
        </div>

        {/* Full name */}
        <Field
          label="Full name"
          icon={User}
          error={errors.name?.message}
        >
          <input
            {...register('name')}
            type="text"
            placeholder="Dr. Kwame Mensah"
            className="input-base"
            style={{
              paddingLeft: '36px',
              borderColor: errors.name ? 'var(--red-border)' : undefined,
            }}
          />
        </Field>

        {/* Email */}
        <Field
          label="Email"
          icon={Mail}
          error={errors.email?.message}
        >
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

        {/* Student ID — conditional */}
        <AnimatePresence initial={false}>
          {role === 'student' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{    opacity: 0, height: 0 }}
              transition={{ duration: DURATION.medium, ease: EASE.state }}
              style={{ overflow: 'hidden' }}
            >
              <Field
                label="Student ID"
                icon={Hash}
                optional
                hint="Helps your lecturer match attendance to your registration"
              >
                <input
                  {...register('studentId')}
                  type="text"
                  placeholder="10XXXXXX"
                  className="input-base"
                  style={{
                    paddingLeft:   '36px',
                    fontFamily:    'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

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
                background:   'none',
                border:       'none',
                cursor:       'pointer',
                color:        'var(--text-muted)',
                fontSize:     'var(--text-xs)',
                fontWeight:   500,
                padding:      0,
                display:      'flex',
                alignItems:   'center',
                gap:          '4px',
                transition:   `color ${DURATION.base}ms ${EASE.state}`,
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
                  transition={{ duration: DURATION.fast }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showPw
                    ? <><EyeOff size={12} /> Hide</>
                    : <><Eye size={12} /> Show</>
                  }
                </motion.span>
              </AnimatePresence>
            </motion.button>
          }
        >
          <input
            {...register('password')}
            type={showPw ? 'text' : 'password'}
            placeholder="At least 8 characters"
            className="input-base"
            autoComplete="new-password"
            style={{
              paddingLeft:   '36px',
              borderColor:   errors.password ? 'var(--red-border)' : undefined,
              fontFamily:    showPw ? 'var(--font-mono)' : 'var(--font-body)',
              letterSpacing: showPw ? '0.04em' : 'normal',
            }}
          />
        </Field>

        {/* Password strength checks — live feedback */}
        <AnimatePresence>
          {password.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: -4 }}
              animate={{ opacity: 1, height: 'auto', marginTop: -4 }}
              exit={{    opacity: 0, height: 0, marginTop: -4 }}
              transition={{ duration: DURATION.medium, ease: EASE.state }}
              style={{
                display:   'flex',
                gap:       '8px',
                flexWrap:  'wrap',
                overflow:  'hidden',
              }}
            >
              {checks.map(({ label, pass }) => (
                <motion.div
                  key={label}
                  animate={{
                    backgroundColor: pass ? 'var(--green-bg)'     : 'var(--bg-raised)',
                    borderColor:     pass ? 'var(--green-border)' : 'var(--border)',
                    color:           pass ? 'var(--green)'        : 'var(--text-muted)',
                  }}
                  transition={{ duration: DURATION.base, ease: EASE.state }}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '4px',
                    padding:      '3px 8px',
                    border:       '1px solid',
                    borderRadius: 'var(--radius-pill)',
                    fontSize:     '10px',
                    fontWeight:   600,
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={pass ? 'pass' : 'fail'}
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{    scale: 0, rotate: 90 }}
                      transition={{ duration: DURATION.fast, ease: EASE.state }}
                      style={{ display: 'flex' }}
                    >
                      {pass ? <Check size={10} /> : <X size={10} />}
                    </motion.span>
                  </AnimatePresence>
                  {label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm password */}
        <Field
          label="Confirm password"
          icon={Lock}
          error={errors.confirmPw?.message}
        >
          <input
            {...register('confirmPw')}
            type="password"
            placeholder="Repeat your password"
            className="input-base"
            autoComplete="new-password"
            style={{
              paddingLeft: '36px',
              borderColor: errors.confirmPw ? 'var(--red-border)' : undefined,
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
          style={{
            height:    '48px',
            marginTop: '8px',
            fontSize:  'var(--text-sm)',
            opacity:   isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? (
            <>
              <span style={{
                width:          '14px',
                height:         '14px',
                border:         '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius:   'var(--radius-pill)',
                animation:      'spin 0.8s linear infinite',
                display:        'inline-block',
              }} />
              Creating account…
            </>
          ) : (
            <>
              <UserPlus size={15} />
              Create account
              <ArrowRight size={14} />
            </>
          )}
        </motion.button>
      </form>

      {/* ── Sign in link ────────────────────────────────────── */}
      <p style={{
        marginTop: 'var(--space-3)',
        textAlign: 'center',
        color:     'var(--text-muted)',
        fontSize:  'var(--text-sm)',
      }}>
        Already have an account?{' '}
        <Link
          to="/login"
          style={{
            color:          'var(--brand-text)',
            textDecoration: 'none',
            fontWeight:     600,
            borderBottom:   '1px dashed transparent',
            transition:     `border-color ${DURATION.base}ms ${EASE.state}`,
          }}
          onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--brand-border)'}
          onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

// ─── Field helper with leading icon + optional trailing action ─
function Field({ label, icon: Icon, action, optional, hint, error, children }) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '6px',
    }}>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '8px',
      }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
        }}>
          <label style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-xs)',
            fontWeight: 600,
          }}>
            {label}
          </label>
          {optional && (
            <span style={{
              color:         'var(--text-muted)',
              fontSize:      '10px',
              fontWeight:    500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Optional
            </span>
          )}
        </div>
        {action}
      </div>

      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon
            size={14}
            style={{
              position:      'absolute',
              left:          '12px',
              top:           '50%',
              transform:     'translateY(-50%)',
              color:         error ? 'var(--red)' : 'var(--text-muted)',
              pointerEvents: 'none',
              transition:    `color ${DURATION.base}ms ${EASE.state}`,
            }}
          />
        )}
        {children}
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE.state }}
            style={{
              color:      'var(--red)',
              fontSize:   '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
            }}
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            style={{
              color:    'var(--text-muted)',
              fontSize: '10px',
            }}
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
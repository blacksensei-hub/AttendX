import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useForm }                           from 'react-hook-form';
import { zodResolver }                       from '@hookform/resolvers/zod';
import { z }                                 from 'zod';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  X, MapPin, BookOpen, FileText,
  Building2, CheckCircle, Loader2,
}                                            from 'lucide-react';
import { useMutation }                       from '@tanstack/react-query';
import toast                                 from 'react-hot-toast';

import { classService }                      from '../../services/classService';
import {
  EASE, DURATION, SPRING, TAP,
  overlayBackdrop, overlayContent,
}                                            from '../../lib/motion';

// ── Lazy-loaded — leaflet (~140 KB gz) is the heaviest single
// dependency in the lecturer area. Lazy-loading it here means it
// only downloads when this modal actually mounts, not when it's
// imported. Combined with the ClassesPage lazy import, leaflet
// defers all the way to "user clicked New class".
const GeofencePicker = lazy(() => import('./GeofencePicker'));

/**
 * ═════════════════════════════════════════════════════════════════
 * CreateClassModal — lecturer's new-class form.
 *
 * Combines react-hook-form text inputs with a separate geofence
 * state (managed by the interactive map picker). Form data and
 * geofence state are merged at submit time.
 *
 * The geofence picker is code-split — leaflet only downloads when
 * this modal renders.
 * ═════════════════════════════════════════════════════════════════
 */

const schema = z.object({
  name:          z.string().min(3, 'Class name must be at least 3 characters'),
  description:   z.string().optional(),
  department:    z.string().optional(),
  location_name: z.string().optional(),
});

export default function CreateClassModal({ open, onClose, onCreated }) {
  const overlayRef = useRef(null);

  const [geofence, setGeofence] = useState({
    geo_lat:    null,
    geo_lng:    null,
    geo_radius: 100,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: classService.createClass,
    onSuccess:  (data) => {
      toast.success(`Class "${data.class.name}" created`);
      reset();
      setGeofence({ geo_lat: null, geo_lng: null, geo_radius: 100 });
      onCreated(data.class);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to create class'),
  });

  const onSubmit = (formValues) => {
    mutation.mutate({
      ...formValues,
      geo_lat:    geofence.geo_lat,
      geo_lng:    geofence.geo_lng,
      geo_radius: geofence.geo_radius,
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasGeofence = geofence.geo_lat && geofence.geo_lng;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          variants={overlayBackdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleOverlayClick}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          50,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            padding:         'var(--space-3)',
            backgroundColor: 'var(--bg-overlay)',
            backdropFilter:  'blur(6px) saturate(140%)',
          }}
        >
          <motion.div
            variants={overlayContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              width:        '100%',
              maxWidth:     '580px',
              maxHeight:    '90vh',
              overflowY:    'auto',
              background:   'var(--bg-card)',
              borderRadius: 'var(--radius-organism)',
              boxShadow:    'var(--shadow-lg)',
            }}
          >

            {/* ── Header ──────────────────────────────────────── */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        'var(--space-3) var(--space-4)',
              borderBottom:   '1px solid var(--border)',
              position:       'sticky',
              top:            0,
              background:     'var(--bg-card)',
              zIndex:         2,
              overflow:       'hidden',
            }}>
              <div style={{
                position:      'absolute',
                top:           '-40px',
                right:         '-40px',
                width:         '160px',
                height:        '160px',
                background:    'var(--brand-subtle)',
                filter:        'blur(50px)',
                opacity:       0.7,
                pointerEvents: 'none',
              }} />

              <div style={{
                position:   'relative',
                display:    'flex',
                alignItems: 'center',
                gap:        'var(--space-2)',
                flex:       1,
                minWidth:   0,
              }}>
                <div style={{
                  width:          '40px',
                  height:         '40px',
                  borderRadius:   'var(--radius-atomic)',
                  background:     'var(--brand-subtle)',
                  border:         '1px solid var(--brand-border)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  boxShadow:      'var(--shadow-brand)',
                }}>
                  <BookOpen size={18} style={{ color: 'var(--brand-text)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color:      'var(--text-primary)',
                    fontSize:   'var(--text-md)',
                  }}>
                    Create class
                  </h2>
                  <p style={{
                    color:     'var(--text-muted)',
                    fontSize:  'var(--text-xs)',
                    marginTop: '2px',
                  }}>
                    Students will receive a join code to enrol
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={TAP.button}
                onClick={onClose}
                aria-label="Close"
                style={{
                  position:     'relative',
                  background:   'none',
                  border:       'none',
                  cursor:       'pointer',
                  color:        'var(--text-muted)',
                  padding:      '6px',
                  borderRadius: 'var(--radius-atomic)',
                  display:      'flex',
                  alignItems:   'center',
                  transition:   `color ${DURATION.base}ms ${EASE.state},
                                 background ${DURATION.base}ms ${EASE.state}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color      = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color      = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* ── Form ────────────────────────────────────────── */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              style={{
                padding:       'var(--space-4)',
                display:       'flex',
                flexDirection: 'column',
                gap:           'var(--space-3)',
              }}
            >

              <Field
                label="Class name"
                required
                icon={BookOpen}
                error={errors.name?.message}
              >
                <input
                  {...register('name')}
                  className="input-base"
                  placeholder="CS301: Data Structures"
                  autoFocus
                />
              </Field>

              <Field
                label="Description"
                optional
                icon={FileText}
                hint="Briefly describe what this class covers"
              >
                <textarea
                  {...register('description')}
                  rows={3}
                  className="input-base"
                  style={{ resize: 'none', lineHeight: 1.6 }}
                  placeholder="Brief description of this class…"
                />
              </Field>

              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 'var(--space-2)',
              }}>
                <Field label="Department" optional icon={Building2}>
                  <input
                    {...register('department')}
                    className="input-base"
                    placeholder="Computer Science"
                  />
                </Field>

                <Field label="Location name" optional icon={MapPin}>
                  <input
                    {...register('location_name')}
                    className="input-base"
                    placeholder="Lecture Hall A"
                  />
                </Field>
              </div>

              {/* ── Geofence section ─────────────────────────── */}
              <div style={{
                background:    'var(--bg-raised)',
                borderRadius:  'var(--radius-molecular)',
                padding:       'var(--space-3)',
                display:       'flex',
                flexDirection: 'column',
                gap:           'var(--space-2)',
                border:        `1px solid ${hasGeofence ? 'var(--green-border)' : 'var(--border)'}`,
                transition:    `border-color ${DURATION.medium}ms ${EASE.state}`,
              }}>

                <div style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        '6px',
                }}>
                  <motion.div
                    animate={{
                      backgroundColor: hasGeofence ? 'var(--green-bg)'     : 'var(--brand-subtle)',
                      borderColor:     hasGeofence ? 'var(--green-border)' : 'var(--brand-border)',
                      color:           hasGeofence ? 'var(--green)'        : 'var(--brand-text)',
                    }}
                    transition={{ duration: DURATION.medium, ease: EASE.state }}
                    style={{
                      width:          '28px',
                      height:         '28px',
                      borderRadius:   'var(--radius-atomic)',
                      border:         '1px solid',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPin size={14} />
                  </motion.div>
                  <p style={{
                    color:      'var(--text-primary)',
                    fontWeight: 600,
                    fontSize:   'var(--text-sm)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    Geofence settings
                  </p>
                  <span style={{
                    marginLeft:    'auto',
                    color:         'var(--text-muted)',
                    fontSize:      '10px',
                    fontWeight:    500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Optional
                  </span>
                </div>

                <p style={{
                  color:      'var(--text-muted)',
                  fontSize:   'var(--text-xs)',
                  lineHeight: 1.6,
                }}>
                  Set a location and radius to verify students are physically present when they mark attendance. Leave unset to skip location verification.
                </p>

                {/*
                  Map picker — lazy-loaded. The Suspense fallback
                  occupies the same vertical space as the loaded
                  picker so the modal layout doesn't jump when
                  leaflet finishes downloading.
                */}
                <Suspense fallback={<MapLoadingPlaceholder />}>
                  <GeofencePicker
                    value={{
                      lat:    geofence.geo_lat,
                      lng:    geofence.geo_lng,
                      radius: geofence.geo_radius,
                    }}
                    onChange={({ geo_lat, geo_lng, geo_radius }) => {
                      setGeofence({ geo_lat, geo_lng, geo_radius });
                    }}
                  />
                </Suspense>

                <AnimatePresence>
                  {hasGeofence && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{    opacity: 0, y: -4, height: 0 }}
                      transition={SPRING.snappy}
                      style={{
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '8px',
                        padding:      '10px 14px',
                        background:   'var(--green-bg)',
                        border:       '1px solid var(--green-border)',
                        borderRadius: 'var(--radius-atomic)',
                        fontSize:     'var(--text-xs)',
                        color:        'var(--green)',
                        fontWeight:   500,
                      }}
                    >
                      <CheckCircle size={13} style={{ flexShrink: 0 }} />
                      <span>
                        Geofence active · students must be within{' '}
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>
                          {geofence.geo_radius}m
                        </strong>{' '}
                        to mark attendance
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Actions ─────────────────────────────────── */}
              <div style={{
                display:   'flex',
                gap:       '8px',
                marginTop: '4px',
              }}>
                <motion.button
                  whileTap={TAP.button}
                  type="button"
                  onClick={onClose}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={TAP.button}
                  whileHover={!mutation.isPending ? { y: -1 } : undefined}
                  transition={SPRING.snappy}
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary"
                  style={{
                    flex:    2,
                    opacity: mutation.isPending ? 0.7 : 1,
                  }}
                >
                  {mutation.isPending ? 'Creating…' : 'Create class'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Map loading placeholder ──────────────────────────────────
// Same height as the GeofencePicker so the modal doesn't jump
// when the chunk arrives. Branded, gentle pulse.
function MapLoadingPlaceholder() {
  return (
    <div style={{
      height:         '320px',
      borderRadius:   'var(--radius-atomic)',
      background:     'var(--bg-raised)',
      border:         '1px dashed var(--border)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            '10px',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat:   Infinity,
          ease:     'linear',
        }}
      >
        <Loader2 size={20} style={{ color: 'var(--text-muted)' }} />
      </motion.div>
      <p style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
      }}>
        Loading map…
      </p>
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────
function Field({ label, icon: Icon, required, optional, hint, error, children }) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '6px',
    }}>
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '6px',
      }}>
        {Icon && <Icon size={12} style={{ color: 'var(--text-muted)' }} />}
        <label style={{
          color:      'var(--text-secondary)',
          fontSize:   'var(--text-xs)',
          fontWeight: 600,
        }}>
          {label}
          {required && (
            <span style={{
              color: 'var(--brand-text)',
              marginLeft: '3px',
            }}>
              *
            </span>
          )}
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

      {children}

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
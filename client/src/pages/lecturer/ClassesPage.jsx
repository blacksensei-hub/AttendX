import { useState, lazy, Suspense }                  from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import { Plus, BookOpen }                            from 'lucide-react';
import toast                                         from 'react-hot-toast';

import { classService }                              from '../../services/classService';
import ClassCard                                     from '../../components/classes/ClassCard';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import { SPRING, TAP, EASE, DURATION }               from '../../lib/motion';

// ── Lazy-loaded — heavy modal with form, validation, and map ─
//
// CreateClassModal pulls in react-hook-form + zod + GeofencePicker,
// and GeofencePicker pulls in leaflet (~140 KB gz). The lecturer
// usually visits this page just to *view* their classes; creating
// a new one is rare. Lazy-loading the modal means none of that
// weight ships until they actually click "New class".
const CreateClassModal = lazy(() => import('../../components/classes/CreateClassModal'));

/**
 * ═════════════════════════════════════════════════════════════════
 * ClassesPage — lecturer's class grid.
 *
 * Wraps in PageShell for consistent route-entrance motion.
 * Uses AnimatedList to orchestrate staggered card reveals — cards
 * no longer need to know their index.
 *
 * The "Create class" modal is code-split so its dependencies
 * (react-hook-form, zod, leaflet) defer until the lecturer
 * actually opens it.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ClassesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: classData, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn:  classService.getMyClasses,
  });
  const classes = classData?.classes ?? [];

  const deleteMut = useMutation({
    mutationFn: classService.deleteClass,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class deleted');
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete class'),
  });

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Your Classes"
          subtitle="Loading…"
        />
        <div style={{
          display:             'grid',
          gap:                 'var(--space-3)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '280px',
                borderRadius: 'var(--radius-molecular)',
              }}
            />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="Your Classes"
        subtitle={
          classes.length === 0
            ? 'Get started by creating your first class'
            : `${classes.length} class${classes.length !== 1 ? 'es' : ''} · click any card to manage sessions`
        }
        action={
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus size={16} />
            New class
          </motion.button>
        }
      />

      {/* ── Empty state ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {classes.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -8 }}
            transition={SPRING.snappy}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        'var(--space-6) var(--space-3)',
              background:     'var(--bg-card)',
              border:         '1px dashed var(--border-hover)',
              borderRadius:   'var(--radius-molecular)',
              textAlign:      'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: DURATION.slow,
                ease:     EASE.bounce,
                delay:    0.1,
              }}
              style={{
                width:          '64px',
                height:         '64px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--brand-subtle)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-3)',
              }}
            >
              <BookOpen size={28} style={{ color: 'var(--brand-text)' }} />
            </motion.div>

            <p style={{
              color:        'var(--text-primary)',
              fontFamily:   'var(--font-display)',
              fontWeight:   600,
              fontSize:     'var(--text-md)',
              marginBottom: '6px',
            }}>
              No classes yet
            </p>
            <p style={{
              color:        'var(--text-muted)',
              fontSize:     'var(--text-sm)',
              marginBottom: 'var(--space-3)',
              maxWidth:     '320px',
            }}>
              Create your first class to start taking attendance with QR codes and real-time tracking.
            </p>

            <motion.button
              whileTap={TAP.button}
              whileHover={{ y: -1 }}
              transition={SPRING.snappy}
              onClick={() => setShowCreate(true)}
              className="btn-primary"
            >
              <Plus size={15} />
              Create first class
            </motion.button>
          </motion.div>
        ) : (
          <AnimatedList
            key="grid"
            style={{
              display:             'grid',
              gap:                 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {classes.map(cls => (
                <AnimatedItem key={cls.id} layout>
                  <ClassCard
                    cls={cls}
                    onDelete={() => deleteMut.mutate(cls.id)}
                  />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </AnimatePresence>

      {/*
        Create class modal — wrapped in Suspense so the lazy chunk
        download doesn't break the tree. Only renders the lazy
        component when `showCreate` is true, which means the chunk
        only starts downloading on the first "New class" click.

        Suspense fallback is null because the modal slides in from
        nothing — there's no visible parent UI that needs a spinner.
        On a slow connection there's a brief delay between click
        and modal appearance; the button can be enhanced with
        `whileTap` feedback later if it feels off.
      */}
      <Suspense fallback={null}>
        {showCreate && (
          <CreateClassModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ['classes'] });
              setShowCreate(false);
            }}
          />
        )}
      </Suspense>
    </PageShell>
  );
}
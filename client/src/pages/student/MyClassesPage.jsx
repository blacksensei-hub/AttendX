// client/src/pages/student/MyClassesPage.jsx
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, BookOpen, CalendarClock, CalendarX2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import { Panel, Empty, PanelSkeleton } from '../../components/console/Panel';
import Ticker from '../../components/ui/Ticker';
import RateMeter from '../../components/teaching/RateMeter';
import { classService } from '../../services/classService';
import { meApi } from '../../services/teachingService';
import { planFor, rateTone, dayLabel, plural } from '../../components/teaching/format';
import { classLabel } from '../../lib/names';
import { SPRING, EASE } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * My classes: where you stand in each one, and what it takes.
 *
 * For every class: the rate against its minimum, and a planner that
 * counts the timetabled sessions still to come this semester (holidays
 * and exam periods left out) and answers the real question: how many
 * more can I miss, or how many must I attend? A slider tries out
 * "what if I miss N more" and shows where the rate would finish.
 *
 * Without semester dates in AttendX the student estimates how many
 * sessions are left. Joining a class by code lives here too.
 * ═════════════════════════════════════════════════════════════════
 */
export default function MyClassesPage() {
  const qc = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const { data, isPending } = useQuery({ queryKey: ['planner'], queryFn: meApi.planner });

  const join = useMutation({
    mutationFn: (c) => classService.joinClass(c),
    onSuccess: (r) => {
      toast.success(r.message ?? 'Joined');
      setCode('');
      setJoining(false);
      ['planner', 'enrolled-classes', 'student-stats', 'my-timetable'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'That code didn\'t work'),
  });

  const classes = data?.classes ?? [];
  const sem = data?.semester;
  const left = classes.reduce((t, c) => t + (c.remaining ?? 0), 0);

  return (
    <PageShell>
      <PageHeader
        kicker={`Student / Classes${sem ? ` / ${sem.name}` : ''}`}
        title="Your"
        accent="classes."
        subtitle={isPending ? 'Working out where you stand…'
          : !classes.length ? 'Join a class with the code your lecturer shares.'
            : sem ? `${sem.name} ends ${dayLabel(sem.endsOn, { day: 'numeric', month: 'long' })}. ${plural(left, 'timetabled session')} left across your classes.`
              : 'See where you stand and what it takes to stay above each minimum.'}
        action={
          <button type="button" className="btn-primary" onClick={() => setJoining(j => !j)} aria-expanded={joining}>
            {joining ? <X size={15} /> : <Plus size={15} />} {joining ? 'Cancel' : 'Join a class'}
          </button>
        }
      />

      <AnimatePresence initial={false}>
        {joining && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={SPRING.snappy}>
            <Panel label="Join a class" title="Enter the code from your lecturer">
              <form className="c-toolbar" onSubmit={e => { e.preventDefault(); if (code.trim()) join.mutate(code.trim().toUpperCase()); }}>
                <input className="c-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7B34XRM2"
                       aria-label="Class code" autoFocus maxLength={10}
                       style={{ maxWidth: 240, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }} />
                <button type="submit" className="btn-accent btn-sm" disabled={join.isPending || code.trim().length < 4}>
                  {join.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Join
                </button>
              </form>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {isPending ? (
        <div className="stack">{[0, 1].map(i => <PanelSkeleton key={i} lines={4} />)}</div>
      ) : classes.length === 0 ? (
        <Panel><Empty icon={BookOpen} title="No classes yet" action={<button type="button" className="btn-accent btn-sm" onClick={() => setJoining(true)}><Plus size={14} /> Join a class</button>}>
          Your lecturer shares an eight-character code in class or by email.
        </Empty></Panel>
      ) : (
        <div className="stack">
          {classes.map((c, i) => <PlannerCard key={c.id} c={c} semester={sem} index={i} />)}
        </div>
      )}
    </PageShell>
  );
}

function PlannerCard({ c, semester, index }) {
  const sliderId = useId();
  const known = c.remaining != null;
  const [estimate, setEstimate] = useState(() => Math.max(1, (c.weeklySlots || 1) * 6));
  const remaining = known ? c.remaining : estimate;
  const [miss, setMiss] = useState(0);
  const missing = Math.min(miss, remaining);
  const plan = planFor({ counted: c.counted, held: c.held, threshold: c.threshold, remaining }, missing);
  const tone = rateTone(plan.projected, c.threshold);

  return (
    <motion.section
      className="panel"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.gentle, delay: Math.min(index, 6) * 0.05 }}
      aria-labelledby={`${sliderId}-h`}
    >
      <div className="split" style={{ gap: 'var(--space-4)' }}>
        {/* Where you stand */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div>
            <p className="kicker">{c.code}{c.lecturerName ? ` / ${c.lecturerName}` : ''}</p>
            <h2 id={`${sliderId}-h`} style={{ fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'var(--text-lg)', letterSpacing: '-0.025em', marginTop: 8, color: 'var(--text-primary)' }}>
              {classLabel(c.code, c.name)}
            </h2>
          </div>
          <RateMeter rate={c.rate} threshold={c.threshold} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            {c.held
              ? <>{c.counted} of {c.held} sessions count: {c.present} present, {c.late} late{c.excused ? `, ${c.excused} excused` : ''}, {c.absent} absent. Minimum {c.threshold}%.</>
              : <>No sessions have closed yet. Minimum {c.threshold}%.</>}
          </p>
          <div className="c-actions" style={{ marginTop: 'auto' }}>
            {c.nextSlot && (
              <Link to="/student/timetable" className="chip brand"><CalendarClock size={12} /> Next: {dayLabel(c.nextSlot.day, { weekday: 'short' })} {c.nextSlot.start}{c.nextSlot.location ? `, ${c.nextSlot.location}` : ''}</Link>
            )}
            <Link to={`/student/requests?new=1&class=${c.id}`} className="chip"><CalendarX2 size={12} /> Excuse an absence</Link>
          </div>
        </div>

        {/* What it takes */}
        <div className="plan-take">
          <p className="c-label">What it takes{known && semester ? `, to ${dayLabel(semester.endsOn, { day: 'numeric', month: 'short' })}` : ''}</p>
          {!known && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-subtle)' }}>
              Sessions left (estimate)
              <input className="c-input" type="number" min={1} max={200} value={estimate}
                     onChange={e => { setEstimate(Math.max(1, Math.min(200, Number(e.target.value) || 1))); setMiss(0); }} style={{ width: 90 }} />
            </label>
          )}
          <Verdict plan={plan} remaining={remaining} threshold={c.threshold} rate={c.rate} />

          {remaining > 0 && (
            <>
              <label htmlFor={sliderId} style={{ fontSize: 13, color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>If I miss <strong style={{ color: 'var(--text-primary)' }}>{missing}</strong> of the {remaining} left</span>
                <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 650 }}>
                  finish at <Ticker value={plan.projected ?? 0} duration={350} format={v => `${(Math.round(v * 10) / 10).toFixed(1)}%`} />
                </span>
              </label>
              <input id={sliderId} className="plan-slider" type="range" min={0} max={remaining} step={1} value={missing}
                     onChange={e => setMiss(Number(e.target.value))}
                     aria-valuetext={`Miss ${missing}, finish at ${plan.projected}%`} />
              <div className="plan-scale" aria-hidden="true">
                <span className="now" style={{ width: `${Math.min(100, c.rate ?? 0)}%` }} />
                <motion.span className={`proj ${tone}`} style={{ width: '100%' }}
                  initial={false} animate={{ scaleX: Math.min(100, plan.projected ?? 0) / 100 }} transition={{ duration: 0.35, ease: EASE.state }} />
                <span className="min" style={{ left: `calc(${c.threshold}% - 1px)` }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Grey is where you are now, the colour is where you'd finish, the line is the {c.threshold}% minimum.
              </p>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function Verdict({ plan, remaining, threshold, rate }) {
  if (remaining === 0) {
    return <p className="plan-verdict">No sessions left. You finish at <em>{plan.projected ?? '–'}%</em>.</p>;
  }
  if (!plan.reachable) {
    return (
      <p className="plan-verdict" style={{ fontSize: 'clamp(18px, 1.9vw, 24px)' }}>
        Even with all {remaining} left, you'd finish at <em>{plan.best}%</em>, under {threshold}%.
        <span style={{ display: 'block', font: '400 13.5px/1.5 var(--font-body)', color: 'var(--text-subtle)', marginTop: 8, letterSpacing: 0 }}>
          Talk to your lecturer. Absences with a good reason can be excused.
        </span>
      </p>
    );
  }
  if (plan.mustAttend === 0 || plan.canMiss === remaining) {
    return <p className="plan-verdict">You can miss all {remaining} left and still make <em>{threshold}%</em>.</p>;
  }
  // Below the minimum: how many to attend. At or above it: how many can go.
  if (rate != null && rate < threshold) {
    return <p className="plan-verdict">Attend at least <em>{plan.mustAttend}</em> of the {remaining} left to reach {threshold}%.</p>;
  }
  if (plan.canMiss === 0) {
    return <p className="plan-verdict">You need <em>every one</em> of the {remaining} left to stay at {threshold}%.</p>;
  }
  return <p className="plan-verdict">You can miss up to <em>{plan.canMiss}</em> of the {remaining} left and stay at {threshold}% or above.</p>;
}

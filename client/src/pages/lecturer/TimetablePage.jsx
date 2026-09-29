// client/src/pages/lecturer/TimetablePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { Radio, FileBarChart2, BookOpen, CalendarClock } from 'lucide-react';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import { Panel, Empty } from '../../components/console/Panel';
import { Drawer } from '../../components/console/overlays';
import WeekTimetable, { WeekNav } from '../../components/teaching/WeekTimetable';
import CalendarFeed from '../../components/teaching/CalendarFeed';
import OpenSessionModal from '../../components/sessions/OpenSessionModal';
import StatusPill from '../../components/ui/StatusPill';
import { teachingApi, ROLE_LABEL } from '../../services/teachingService';
import { mondayOf, dayLabel, plural } from '../../components/teaching/format';
import { classLabel } from '../../lib/names';

/**
 * ═════════════════════════════════════════════════════════════════
 * The lecturer's week: every timetabled slot across the classes they
 * teach (including ones shared with them), with what happened at each.
 * Choosing a slot shows its session, or offers to open one when the
 * slot is today and nothing is running. A private calendar link puts
 * the same timetable in Google, Apple or Outlook calendar.
 * ═════════════════════════════════════════════════════════════════
 */

const STATE_TEXT = {
  held: 'The session ran and has closed.',
  live: 'A session is taking attendance now.',
  missed: 'No session was opened for this slot.',
  blocked: 'No classes that day.',
  upcoming: 'Still to come. The session opens on its own at the start time.',
};

export default function TimetablePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => mondayOf());
  const [picked, setPicked] = useState(null);
  const [opening, setOpening] = useState(null);

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['timetable', 'lecturer', week],
    queryFn: () => teachingApi.timetable(week),
    placeholderData: keepPreviousData,
  });
  const cls = picked && data?.classes.find(c => c.id === picked.classId);
  const counts = data ? {
    total: data.slots.length,
    held: data.slots.filter(s => s.state === 'held').length,
    missed: data.slots.filter(s => s.state === 'missed').length,
  } : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      <PageHeader
        kicker="Lecturer / Timetable"
        title="Your"
        accent="week."
        subtitle={counts
          ? counts.total
            ? `${plural(counts.total, 'timetabled session')} this week${counts.held ? `, ${counts.held} held` : ''}${counts.missed ? `, ${counts.missed} with no session` : ''}.`
            : 'Nothing timetabled this week.'
          : 'Loading your week…'}
        action={<WeekNav week={week} onChange={setWeek} busy={isFetching} />}
      />

      <Panel flush>
        {data && (data.slots.length || data.events.length)
          ? <div style={{ padding: '0 8px 8px', overflowX: 'auto' }}>
              <WeekTimetable
                data={data}
                onSlot={setPicked}
                sub={s => (s.session
                  ? `${s.session.scanned}/${data.classes.find(c => c.id === s.classId)?.enrolled ?? 0} scanned`
                  : s.state === 'blocked' ? s.blockedBy?.title : data.classes.find(c => c.id === s.classId)?.location)}
              />
            </div>
          : <Empty icon={CalendarClock} title={isPending ? 'Loading…' : 'No timetabled classes'}>
              {isPending ? null : 'Add weekly times to a class and they appear here. Sessions then open on their own.'}
            </Empty>}
      </Panel>

      {data?.extra?.length > 0 && (
        <Panel label="Outside the timetable" title={plural(data.extra.length, 'session') + ' opened by hand this week'}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.extra.map(x => {
              const c = data.classes.find(k => k.id === x.classId);
              return (
                <li key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span><strong>{classLabel(c?.code, c?.name)}</strong> <span className="c-muted">{new Date(x.openAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(x.status === 'open' ? `/lecturer/session/${x.id}` : `/lecturer/session/${x.id}/roster`)}>
                    {x.status === 'open' ? 'View live' : 'Register'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <CalendarFeed who="lecturer" />

      <Drawer open={Boolean(picked)} onClose={() => setPicked(null)}
              label={picked ? `${dayLabel(picked.day)} · ${picked.start} to ${picked.end}` : ''}
              title={cls ? classLabel(cls.code, cls.name) : ''}
              footer={picked && cls && (
                <>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/lecturer/classes/${cls.id}`)}><BookOpen size={14} /> Class page</button>
                  {picked.session?.status === 'open' && (
                    <button type="button" className="btn-accent btn-sm" onClick={() => navigate(`/lecturer/session/${picked.session.id}`)}><Radio size={14} /> View live</button>
                  )}
                  {picked.session?.status === 'closed' && (
                    <button type="button" className="btn-accent btn-sm" onClick={() => navigate(`/lecturer/session/${picked.session.id}/roster`)}><FileBarChart2 size={14} /> Session register</button>
                  )}
                  {!picked.session && picked.day === today && picked.state !== 'blocked' && (
                    <button type="button" className="btn-accent btn-sm" onClick={() => { setOpening(cls); setPicked(null); }}><Radio size={14} /> Open session now</button>
                  )}
                </>
              )}>
        {picked && cls && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill status={{ held: 'closed', live: 'live', missed: 'absent', blocked: 'pending', upcoming: 'scheduled' }[picked.state]}
                          label={{ held: 'Held', live: 'Live', missed: 'Not held', blocked: 'No classes', upcoming: 'Upcoming' }[picked.state]} showSweep={false} />
              {cls.myRole !== 'owner' && <span className="role-chip">{ROLE_LABEL[cls.myRole]}</span>}
            </div>
            <p style={{ color: 'var(--text-subtle)', lineHeight: 1.55 }}>
              {picked.state === 'blocked' && picked.blockedBy ? `${picked.blockedBy.title}: no classes that day.` : STATE_TEXT[picked.state]}
            </p>
            <dl className="dl">
              <dt>Students</dt><dd className="tabular">{cls.enrolled}</dd>
              {picked.session && <><dt>Scanned in</dt><dd className="tabular">{picked.session.scanned} of {cls.enrolled}</dd></>}
              {cls.location && <><dt>Room</dt><dd>{cls.location}</dd></>}
              <dt>Length</dt><dd>{picked.duration} minutes</dd>
            </dl>
          </>
        )}
      </Drawer>

      <OpenSessionModal
        classData={opening ?? { id: null, name: '' }}
        open={Boolean(opening)}
        onClose={() => setOpening(null)}
        onOpened={(session) => {
          setOpening(null);
          qc.invalidateQueries({ queryKey: ['timetable'] });
          navigate(`/lecturer/session/${session.id}`);
        }}
      />
    </PageShell>
  );
}

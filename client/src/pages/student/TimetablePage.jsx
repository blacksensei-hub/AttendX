// client/src/pages/student/TimetablePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CalendarClock, ScanLine, CalendarX2 } from 'lucide-react';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import { Panel, Empty } from '../../components/console/Panel';
import { Drawer } from '../../components/console/overlays';
import StatusPill from '../../components/ui/StatusPill';
import WeekTimetable, { WeekNav } from '../../components/teaching/WeekTimetable';
import CalendarFeed from '../../components/teaching/CalendarFeed';
import { meApi } from '../../services/teachingService';
import { mondayOf, dayLabel, plural } from '../../components/teaching/format';
import { classLabel } from '../../lib/names';

/**
 * ═════════════════════════════════════════════════════════════════
 * The student's week: every class on its timetable, what happened at
 * the ones that have passed (their own result), holidays and exam
 * periods, and a line for now. Below it: reminders before each class
 * and a private calendar link for Google, Apple or Outlook.
 * ═════════════════════════════════════════════════════════════════
 */

const MY_WORD = { present: 'You were present', late: 'You were late', excused: 'Excused', absent: 'You were absent' };

export default function StudentTimetablePage() {
  const navigate = useNavigate();
  const [week, setWeek] = useState(() => mondayOf());
  const [picked, setPicked] = useState(null);
  const { data, isPending, isFetching } = useQuery({
    queryKey: ['my-timetable', week],
    queryFn: () => meApi.timetable(week),
    placeholderData: keepPreviousData,
  });
  const cls = picked && data?.classes.find(c => c.id === picked.classId);
  const upcoming = data?.slots.filter(s => s.state === 'upcoming' || s.state === 'live').length ?? 0;

  return (
    <PageShell>
      <PageHeader
        kicker="Student / Timetable"
        title="Your"
        accent="week."
        subtitle={data
          ? data.slots.length ? `${plural(data.slots.length, 'class', 'classes')} this week, ${upcoming} still to come.` : 'No classes timetabled this week.'
          : 'Loading your week…'}
        action={<WeekNav week={week} onChange={setWeek} busy={isFetching} />}
      />

      <Panel flush>
        {data && (data.slots.length || data.events.length) ? (
          <div style={{ padding: '0 8px 8px', overflowX: 'auto' }}>
            <WeekTimetable
              data={data}
              onSlot={setPicked}
              sub={s => (s.session?.myStatus ? MY_WORD[s.session.myStatus] : s.state === 'blocked' ? s.blockedBy?.title : data.classes.find(c => c.id === s.classId)?.location)}
            />
          </div>
        ) : (
          <Empty icon={CalendarClock} title={isPending ? 'Loading…' : 'Nothing timetabled'}>
            {isPending ? null : 'When your lecturers add weekly times to their classes, they show up here.'}
          </Empty>
        )}
      </Panel>

      <CalendarFeed who="student" />

      <Drawer open={Boolean(picked)} onClose={() => setPicked(null)}
              label={picked ? `${dayLabel(picked.day)} · ${picked.start} to ${picked.end}` : ''}
              title={cls ? classLabel(cls.code, cls.name) : ''}
              footer={picked && (
                <>
                  {picked.state === 'live' && <button type="button" className="btn-accent btn-sm" onClick={() => navigate('/student/scan')}><ScanLine size={14} /> Scan in now</button>}
                  {(picked.state === 'upcoming' || picked.session?.myStatus === 'absent') && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/student/requests?new=1&class=${picked.classId}&date=${picked.day}`)}>
                      <CalendarX2 size={14} /> {picked.state === 'upcoming' ? 'I can\'t make it' : 'Ask to excuse this'}
                    </button>
                  )}
                </>
              )}>
        {picked && (
          <>
            {picked.session?.myStatus
              ? <StatusPill status={picked.session.myStatus} size="md" showSweep={false} />
              : <StatusPill status={{ live: 'live', missed: 'closed', blocked: 'pending', upcoming: 'scheduled', held: 'closed' }[picked.state]}
                            label={{ live: 'Open now', missed: 'Not held', blocked: 'No classes', upcoming: 'Upcoming', held: 'Held' }[picked.state]} showSweep={false} />}
            <p style={{ color: 'var(--text-subtle)', lineHeight: 1.55 }}>
              {picked.state === 'live' ? 'The session is open. Scan the code on the screen to mark your attendance.'
                : picked.state === 'blocked' ? `${picked.blockedBy?.title ?? 'A holiday'}: no classes that day.`
                  : picked.state === 'missed' ? 'No attendance was taken for this slot, so it doesn\'t count for or against you.'
                    : picked.state === 'upcoming' ? 'Attendance opens at the start time. You get a reminder beforehand if reminders are on.'
                      : 'Attendance was taken for this class.'}
            </p>
            {cls?.location && <dl className="dl"><dt>Room</dt><dd>{cls.location}</dd><dt>Length</dt><dd>{picked.duration} minutes</dd></dl>}
          </>
        )}
      </Drawer>
    </PageShell>
  );
}

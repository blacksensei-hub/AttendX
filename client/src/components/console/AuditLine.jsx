// client/src/components/console/AuditLine.jsx
import { timeAgo, fmtDateTime } from './format';

// Colour of the dot beside an audit event, by what kind of action it was.
function markFor(action = '') {
  if (/deleted|deactivated|force_closed|report_deleted/.test(action)) return 'red';
  if (action.startsWith('fraud.')) return 'amber';
  if (action.startsWith('impersonation.')) return 'brand';
  if (/activated|imported|invited|sent|saved/.test(action)) return 'green';
  return 'muted';
}

/** One line of the audit trail: what happened, who did it, when. */
export default function AuditLine({ event, onClick }) {
  const who = event.actor_name ?? 'System';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="feed-item" onClick={onClick} type={onClick ? 'button' : undefined}
         style={onClick ? { textAlign: 'left', width: '100%', cursor: 'pointer', background: 'none', border: 0, borderBottom: '1px solid var(--border)', font: 'inherit', color: 'inherit' } : undefined}>
      <span className={`feed-mark ${markFor(event.action)}`} aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span style={{ color: 'var(--text-primary)' }}>{event.summary ?? event.action}</span>
        <span className="c-muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
          {who}{event.actor_role ? ` · ${event.actor_role}` : ''}{event.on_behalf_of ? ' · via view as' : ''}
        </span>
      </span>
      <time dateTime={event.created_at} title={fmtDateTime(event.created_at)}>{timeAgo(event.created_at)}</time>
    </Tag>
  );
}

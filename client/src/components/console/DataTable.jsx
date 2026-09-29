// client/src/components/console/DataTable.jsx
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './Panel';
import { SPRING } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * The console's table.
 *
 * columns: [{ key, header, render?(row), num?, sort?(row) → value,
 *             width?, className? }]
 * A column with `sort` is sortable client-side (click the header).
 * Selection is on only when `selected` + `onSelect` are passed, and
 * `bulk` renders a floating bar of actions while rows are selected.
 * Server-side pagination: pass `page`, `totalPages`, `onPage`.
 * ═════════════════════════════════════════════════════════════════
 */
export default function DataTable({
  columns, rows, rowKey = (r) => r.id, loading = false, empty = null,
  onRowClick, selected, onSelect, bulk,
  page, totalPages, total, onPage, caption,
}) {
  const [sort, setSort] = useState(null);   // { key, dir }
  const selectable = Boolean(selected && onSelect);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sort(a), vb = col.sort(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const allIds = rows.map(rowKey);
  const allOn = selectable && allIds.length > 0 && allIds.every(id => selected.has(id));
  const toggleAll = () => onSelect(allOn ? new Set() : new Set(allIds));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelect(next);
  };
  const clickSort = (key) => setSort(s => (s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }));

  return (
    <>
      <div className="dt-wrap">
        <table className="dt">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th className="check" scope="col">
                  <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {columns.map(c => (
                <th key={c.key} scope="col" className={c.num ? 'num' : undefined} style={c.width ? { width: c.width } : undefined}
                    aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button type="button" onClick={() => clickSort(c.key)}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && Array.from({ length: 6 }, (_, i) => (
              <tr key={`sk${i}`}>
                {selectable && <td className="check" />}
                {columns.map(c => <td key={c.key}><Skeleton h={10} w={c.num ? '40%' : '70%'} style={c.num ? { marginLeft: 'auto' } : undefined} /></td>)}
              </tr>
            ))}
            {sorted.map(row => {
              const id = rowKey(row);
              const on = selectable && selected.has(id);
              return (
                <tr key={id}
                    className={`${on ? 'is-selected' : ''} ${onRowClick ? 'is-clickable' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}>
                  {selectable && (
                    <td className="check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={on} onChange={() => toggle(id)} aria-label="Select row" />
                    </td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className ?? ''}`}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && empty}
      </div>

      {onPage && totalPages > 1 && (
        <div className="pager">
          <span className="tabular">{total != null ? `${total.toLocaleString()} total · ` : ''}Page {page} of {totalPages}</span>
          <div className="c-actions">
            <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <button type="button" className="icon-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectable && selected.size > 0 && bulk && (
          <motion.div
            className="bulkbar"
            role="toolbar"
            aria-label="Bulk actions"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={SPRING.snappy}
          >
            <span className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
            {bulk}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

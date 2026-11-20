import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState, Spinner, inputCls } from './ui.jsx';

/**
 * columns: [{ key, label, sortable?, render?(row) }]
 * Client-side search (over searchKeys), sorting and pagination.
 */
export default function DataTable({ columns, rows, loading, error, onRetry, searchKeys = [], pageSize = 10, rowActions, toolbar, emptyTitle, emptyMessage }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = rows || [];
    if (term && searchKeys.length) r = r.filter((row) => searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(term)));
    if (sort.key) {
      r = [...r].sort((a, b) => {
        const x = a[sort.key] ?? '', y = b[sort.key] ?? '';
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, q, sort, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        {searchKeys.length > 0 && (
          <div className="relative sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search..." aria-label="Search table" className={`${inputCls} pl-9`} />
          </div>
        )}
        {toolbar}
      </div>
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={onRetry} /> : filtered.length === 0 ? (
        <EmptyState title={q ? 'No matching results' : emptyTitle} message={q ? 'Try a different search term.' : emptyMessage} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {c.sortable === false ? c.label : (
                        <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
                          {c.label} <ArrowUpDown size={12} />
                        </button>
                      )}
                    </th>
                  ))}
                  {rowActions && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-slate-50">
                    {columns.map((c) => <td key={c.key} className="px-4 py-3 align-middle">{c.render ? c.render(row) : row[c.key]}</td>)}
                    {rowActions && <td className="whitespace-nowrap px-4 py-3 text-right">{rowActions(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page" className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={18} /></button>
              <span>Page {current} of {pages}</span>
              <button disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page" className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={18} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

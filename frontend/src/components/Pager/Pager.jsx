/**
 * Page controls for a long list (lib/paging): "6–10 of 23", Previous,
 * page numbers (1 … 4 5 6 … 12) and Next. Nothing shows when the list fits
 * on one page. usePaged(items, size) keeps the page and hands back the
 * page's items and the props for <Pager>.
 *
 *   const { pageItems, pager } = usePaged(posts, 5);
 *   <ul>{pageItems.map(...)}</ul>
 *   <Pager {...pager} label="Posts" />
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, clampPage, pageButtons, pageCount, pageRange, pageSlice } from '../../lib/paging';
import './Pager.css';

export function usePaged(items, size = DEFAULT_PAGE_SIZE) {
  // An API that answers with an object where a list belongs counts as none.
  const list = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(1);
  const safe = clampPage(page, list.length, size);
  useEffect(() => { if (safe !== page) setPage(safe); }, [safe, page]);
  return { pageItems: pageSlice(list, safe, size), pager: { page: safe, total: list.length, size, onPage: setPage } };
}

export default function Pager({ page, total, size = DEFAULT_PAGE_SIZE, onPage, label = 'List' }) {
  const pages = pageCount(total, size);
  if (pages <= 1) return null;
  const { from, to } = pageRange(page, total, size);
  return (
    <nav className="pg" aria-label={`${label} pages`}>
      <span className="pg-range">{from}–{to} of {total}</span>
      <div className="pg-buttons">
        <button type="button" className="pg-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pageButtons(page, pages).map((n, i) => (n === 'gap'
          ? <span key={`gap-${i}`} className="pg-gap" aria-hidden="true">…</span>
          : (
            <button key={n} type="button" className={`pg-btn${n === page ? ' is-on' : ''}`} aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
              {n}
            </button>
          )))}
        <button type="button" className="pg-btn" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

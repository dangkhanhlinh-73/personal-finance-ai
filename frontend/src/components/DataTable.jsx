import { useState, useMemo } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import "./DataTable.css";

/**
 * Reusable table with search, sort, and pagination.
 *
 * Props:
 *   columns        [{ key, label, sortable?, render?, width?, align? }]
 *   data           array of row objects
 *   rowKey         string – primary key field name
 *   searchFields   string[] – fields to full-text search across
 *   searchPlaceholder string
 *   emptyMessage   string
 *   defaultPageSize number (default 10)
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey,
  searchFields = [],
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không có dữ liệu",
  defaultPageSize = 10,
}) {
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || searchFields.length === 0) return data;
    return data.filter((row) =>
      searchFields.some((field) =>
        String(row[field] ?? "").toLowerCase().includes(q)
      )
    );
  }, [data, search, searchFields]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const numA = Number(va);
      const numB = Number(vb);
      let cmp;
      if (!isNaN(numA) && !isNaN(numB)) {
        cmp = numA - numB;
      } else {
        cmp = String(va).localeCompare(String(vb), "vi", { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey("");
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handlePageSize = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  // Build page number list with ellipsis
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, currentPage]);
    for (let d = -2; d <= 2; d++) {
      const p = currentPage + d;
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i]);
      if (i + 1 < sorted.length && sorted[i + 1] - sorted[i] > 1) {
        result.push("...");
      }
    }
    return result;
  })();

  return (
    <div className="data-table-wrap">
      {/* Toolbar */}
      <div className="dt-toolbar">
        {searchFields.length > 0 && (
          <div className="dt-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={handleSearch}
            />
          </div>
        )}
        <div className="dt-toolbar-right">
          <span className="dt-count">
            {totalItems} kết quả
          </span>
          <label className="dt-pagesize-label">
            Hiển thị
            <select value={pageSize} onChange={handlePageSize}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            hàng
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="dt-table-container">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : {}}
                  className={col.sortable ? "dt-th-sortable" : ""}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className={`dt-th-inner ${col.align === "right" ? "dt-th-right" : ""}`}>
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="dt-sort-icon">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        ) : (
                          <ChevronsUpDown size={13} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="dt-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row[rowKey]}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.align === "right" ? "dt-td-right" : ""}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="dt-pagination">
          <span className="dt-page-info">
            {start + 1}–{Math.min(start + pageSize, totalItems)} / {totalItems}
          </span>
          <div className="dt-page-buttons">
            <button
              className="dt-page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft size={15} />
            </button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="dt-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`dt-page-btn ${currentPage === p ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="dt-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Trang sau"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

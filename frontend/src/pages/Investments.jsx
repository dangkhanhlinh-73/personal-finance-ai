import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Check,
  TrendingUp,
  Pencil,
  TrendingDown,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import DataTable from "../components/DataTable";
import "./Investments.css";

const formatCurrency = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const getErrorMessage = (err) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((i) => i.msg).join(", ");
  return "Có lỗi xảy ra";
};

export default function Investments() {
  const [sources, setSources] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");

  // Source create modal
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceForm, setSourceForm] = useState({ source_name: "", initial_balance: "", interest_rate: "0" });

  // Source edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSource, setEditSource] = useState(null);
  const [editForm, setEditForm] = useState({ source_name: "", interest_rate: "0" });

  // Investment modal
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investForm, setInvestForm] = useState({
    investment_source_id: "",
    account_id: "",
    amount: "",
    direction: "invest",
    note: "",
    invested_at: "",
  });

  const loadSources = async () => {
    try {
      const res = await api.get("/investments/sources");
      setSources(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD SOURCES ERROR:", err.response?.data || err.message);
    }
  };

  const loadInvestments = async () => {
    try {
      const res = await api.get("/investments/");
      setInvestments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD INVESTMENTS ERROR:", err.response?.data || err.message);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/accounts/");
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD ACCOUNTS ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    loadSources();
    loadInvestments();
    loadAccounts();
  }, []);

  // ── Source create ──────────────────────────────────────────────────────────
  const openSourceModal = () => {
    setError("");
    setSourceForm({ source_name: "", initial_balance: "", interest_rate: "0" });
    setShowSourceModal(true);
  };

  const handleSourceChange = (e) => {
    const { name, value } = e.target;
    setSourceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSource = async (e) => {
    e.preventDefault();
    setError("");
    if (!sourceForm.source_name.trim()) { setError("Vui lòng nhập tên nguồn đầu tư"); return; }
    if (Number(sourceForm.initial_balance) < 0) { setError("Số dư ban đầu không được âm"); return; }
    setSaving(true);
    try {
      await api.post("/investments/sources", {
        source_name: sourceForm.source_name.trim(),
        initial_balance: Number(sourceForm.initial_balance || 0),
        interest_rate: Number(sourceForm.interest_rate || 0),
      });
      setShowSourceModal(false);
      await loadSources();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Source edit ────────────────────────────────────────────────────────────
  const openEditModal = (source) => {
    setError("");
    setEditSource(source);
    setEditForm({
      source_name: source.source_name,
      interest_rate: String(source.interest_rate ?? "0"),
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateSource = async (e) => {
    e.preventDefault();
    setError("");
    if (!editForm.source_name.trim()) { setError("Vui lòng nhập tên nguồn đầu tư"); return; }
    setSaving(true);
    try {
      await api.put(`/investments/sources/${editSource.source_id}`, {
        source_name: editForm.source_name.trim(),
        interest_rate: Number(editForm.interest_rate || 0),
      });
      setShowEditModal(false);
      await loadSources();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nguồn đầu tư này không?")) return;
    try {
      await api.delete(`/investments/sources/${sourceId}`);
      await loadSources();
      await loadInvestments();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // ── Investment ─────────────────────────────────────────────────────────────
  const openInvestModal = () => {
    setError("");
    setInvestForm({
      investment_source_id: sources.length > 0 ? String(sources[0].source_id) : "",
      account_id: accounts.length > 0 ? String(accounts[0].account_id) : "",
      amount: "",
      direction: "invest",
      note: "",
      invested_at: new Date().toISOString().slice(0, 10),
    });
    setShowInvestModal(true);
  };

  const handleInvestChange = (e) => {
    const { name, value } = e.target;
    setInvestForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateInvestment = async (e) => {
    e.preventDefault();
    setError("");
    if (!investForm.investment_source_id) { setError("Vui lòng chọn nguồn đầu tư"); return; }
    if (!investForm.account_id) { setError("Vui lòng chọn tài khoản"); return; }
    if (Number(investForm.amount) <= 0) { setError("Số tiền phải lớn hơn 0"); return; }
    if (!investForm.invested_at) { setError("Vui lòng chọn ngày giao dịch"); return; }
    setSaving(true);
    try {
      await api.post("/investments/", {
        investment_source_id: Number(investForm.investment_source_id),
        account_id: Number(investForm.account_id),
        amount: Number(investForm.amount),
        direction: investForm.direction,
        note: investForm.note.trim() || null,
        invested_at: investForm.invested_at,
      });
      setShowInvestModal(false);
      await loadSources();
      await loadInvestments();
      await loadAccounts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvestment = async (investmentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch đầu tư này không?")) return;
    try {
      await api.delete(`/investments/${investmentId}`);
      await loadSources();
      await loadInvestments();
      await loadAccounts();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalValue = sources.reduce((sum, s) => sum + Number(s.value_with_interest || s.current_balance || 0), 0);
  const totalInitial = sources.reduce((sum, s) => sum + Number(s.initial_balance || 0), 0);
  const totalProfit = totalValue - totalInitial;

  const filteredInvestments = sourceFilter
    ? investments.filter((i) => String(i.investment_source_id) === sourceFilter)
    : investments;

  const columns = [
    { key: "invested_at", label: "Ngày", sortable: true, render: (row) => formatDate(row.invested_at) },
    { key: "source_name", label: "Nguồn đầu tư", sortable: true },
    { key: "account_name", label: "Tài khoản", sortable: true },
    {
      key: "direction", label: "Chiều",
      render: (row) =>
        row.direction === "invest" ? (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#ccfbf1", color: "#0f766e" }}>
            Đầu tư vào
          </span>
        ) : (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#ffedd5", color: "#c2410c" }}>
            Rút ra
          </span>
        ),
    },
    {
      key: "amount", label: "Số tiền", sortable: true, align: "right",
      render: (row) => (
        <span style={{ fontWeight: 600, color: row.direction === "invest" ? "#0f766e" : "#c2410c" }}>
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "note", label: "Ghi chú",
      render: (row) => (
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {row.note || "—"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (row) => (
        <button className="invest-delete-btn" type="button" onClick={() => handleDeleteInvestment(row.investment_id)} title="Xóa">
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  return (
    <div className="investments-layout">
      <Sidebar activePage="investments" />

      <main className="investments-main">
        <div className="investments-header">
          <div>
            <h1>Quản lý đầu tư</h1>
            <p>Theo dõi các nguồn đầu tư và lịch sử giao dịch</p>
          </div>
          <button className="add-invest-btn" type="button" onClick={openInvestModal}>
            <Plus size={20} /> Thêm giao dịch đầu tư
          </button>
        </div>

        {error && <div className="invest-error">{error}</div>}

        {/* Stats */}
        <section className="invest-stats">
          <div className="invest-stat-card blue">
            <p>Tổng giá trị (sau lãi)</p>
            <h2>{formatCurrency(totalValue)}</h2>
            <span>{sources.length} nguồn đầu tư</span>
          </div>
          <div className="invest-stat-card green">
            <p>Tổng vốn ban đầu</p>
            <h2>{formatCurrency(totalInitial)}</h2>
            <span>Tiền đã bỏ vào</span>
          </div>
          <div className={`invest-stat-card ${totalProfit >= 0 ? "teal" : "orange"}`}>
            <p>Lãi / Lỗ</p>
            <h2 style={{ color: totalProfit >= 0 ? "#0f766e" : "#c2410c" }}>
              {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
            </h2>
            <span>{totalProfit >= 0 ? "Lợi nhuận" : "Thua lỗ"}</span>
          </div>
        </section>

        {/* Sources */}
        <section className="invest-section">
          <div className="invest-section-header">
            <h2>Nguồn đầu tư</h2>
            <button className="add-source-btn" type="button" onClick={openSourceModal}>
              <Plus size={18} /> Thêm nguồn
            </button>
          </div>

          {sources.length === 0 ? (
            <div className="invest-empty">Chưa có nguồn đầu tư nào. Hãy thêm nguồn mới.</div>
          ) : (
            <div className="source-grid">
              {sources.map((source) => {
                const profit = Number(source.value_with_interest || source.current_balance) - Number(source.initial_balance);
                const isProfit = profit >= 0;
                return (
                  <div className="source-card" key={source.source_id}>
                    <div className="source-card-top">
                      <div className="source-icon">
                        <TrendingUp size={26} />
                      </div>
                      <div className="source-info">
                        <h3>{source.source_name}</h3>
                        <p>Tạo: {formatDate(source.created_at)}</p>
                      </div>
                      <button className="source-edit-btn" type="button" onClick={() => openEditModal(source)} title="Chỉnh sửa">
                        <Pencil size={16} />
                      </button>
                      <button className="source-delete-btn" type="button" onClick={() => handleDeleteSource(source.source_id)} title="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="source-balances">
                      <div className="source-balance-row">
                        <span>Vốn ban đầu</span>
                        <b>{formatCurrency(source.initial_balance)}</b>
                      </div>
                      <div className="source-balance-row">
                        <span>Giá trị hiện tại</span>
                        <b>{formatCurrency(source.current_balance)}</b>
                      </div>
                      {Number(source.interest_rate) > 0 && (
                        <div className="source-balance-row interest-row">
                          <span>Lãi suất: <b className="rate-badge">{Number(source.interest_rate)}%/năm</b></span>
                          <b style={{ color: "#2563eb" }}>{formatCurrency(source.value_with_interest)}</b>
                        </div>
                      )}
                      <div className={`source-balance-row profit-row ${isProfit ? "profit" : "loss"}`}>
                        <span>{isProfit ? "Lợi nhuận" : "Thua lỗ"}</span>
                        <b>{isProfit ? "+" : ""}{formatCurrency(profit)}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Investment history */}
        <section className="invest-section">
          <h2>Lịch sử đầu tư</h2>
          <div className="invest-external-filters">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">Tất cả nguồn</option>
              {sources.map((s) => (
                <option key={s.source_id} value={String(s.source_id)}>{s.source_name}</option>
              ))}
            </select>
          </div>
          <DataTable
            columns={columns}
            data={filteredInvestments}
            rowKey="investment_id"
            searchFields={["source_name", "account_name", "note"]}
            searchPlaceholder="Tìm kiếm giao dịch đầu tư..."
            emptyMessage="Chưa có giao dịch đầu tư nào."
            defaultPageSize={10}
          />
        </section>
      </main>

      {/* Source create modal */}
      {showSourceModal && (
        <div className="invest-modal-backdrop">
          <form className="invest-modal" onSubmit={handleCreateSource}>
            <div className="invest-modal-header">
              <h2>Thêm nguồn đầu tư</h2>
              <button type="button" onClick={() => setShowSourceModal(false)}><X size={22} /></button>
            </div>
            {error && <div className="invest-error">{error}</div>}

            <label>Tên nguồn đầu tư</label>
            <input name="source_name" placeholder="Cổ phiếu, Quỹ ETF, Bất động sản..." value={sourceForm.source_name} onChange={handleSourceChange} autoFocus required />

            <label>Số dư ban đầu (VNĐ)</label>
            <MoneyInput name="initial_balance" placeholder="0" value={sourceForm.initial_balance} onChange={handleSourceChange} />

            <label>Lãi suất kỳ vọng (%/năm)</label>
            <input name="interest_rate" type="number" min="0" max="1000" step="0.01" placeholder="0" value={sourceForm.interest_rate} onChange={handleSourceChange} />
            <p className="invest-field-hint">Giá trị hiển thị = Giá trị hiện tại × (1 + lãi suất%). Mặc định 0 nếu chưa có.</p>

            <div className="invest-modal-actions">
              <button className="invest-save-btn" type="submit" disabled={saving}>
                <Check size={18} /> {saving ? "Đang lưu..." : "Thêm nguồn"}
              </button>
              <button className="invest-cancel-btn" type="button" onClick={() => setShowSourceModal(false)}>
                <X size={18} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Source edit modal */}
      {showEditModal && editSource && (
        <div className="invest-modal-backdrop">
          <form className="invest-modal invest-modal-sm" onSubmit={handleUpdateSource}>
            <div className="invest-modal-header">
              <h2>Chỉnh sửa nguồn đầu tư</h2>
              <button type="button" onClick={() => setShowEditModal(false)}><X size={22} /></button>
            </div>
            {error && <div className="invest-error">{error}</div>}

            <label>Tên nguồn đầu tư</label>
            <input name="source_name" value={editForm.source_name} onChange={handleEditChange} required autoFocus />

            <label>Lãi suất kỳ vọng (%/năm)</label>
            <input name="interest_rate" type="number" min="0" max="1000" step="0.01" value={editForm.interest_rate} onChange={handleEditChange} />
            <p className="invest-field-hint">
              Giá trị sau lãi = {formatCurrency(Number(editSource.current_balance))} × (1 + {editForm.interest_rate || 0}%) = {formatCurrency(Number(editSource.current_balance) * (1 + Number(editForm.interest_rate || 0) / 100))}
            </p>

            <div className="invest-modal-actions">
              <button className="invest-save-btn" type="submit" disabled={saving}>
                <Check size={18} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button className="invest-cancel-btn" type="button" onClick={() => setShowEditModal(false)}>
                <X size={18} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investment modal */}
      {showInvestModal && (
        <div className="invest-modal-backdrop">
          <form className="invest-modal" onSubmit={handleCreateInvestment}>
            <div className="invest-modal-header">
              <h2>Thêm giao dịch đầu tư</h2>
              <button type="button" onClick={() => setShowInvestModal(false)}><X size={22} /></button>
            </div>
            {error && <div className="invest-error">{error}</div>}

            <div className="invest-form-grid">
              <div>
                <label>Nguồn đầu tư</label>
                <select name="investment_source_id" value={investForm.investment_source_id} onChange={handleInvestChange}>
                  <option value="">Chọn nguồn đầu tư</option>
                  {sources.map((s) => (
                    <option key={s.source_id} value={s.source_id}>{s.source_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Tài khoản</label>
                <select name="account_id" value={investForm.account_id} onChange={handleInvestChange}>
                  <option value="">Chọn tài khoản</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>{a.account_name} — {formatCurrency(a.balance)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Loại giao dịch</label>
                <select name="direction" value={investForm.direction} onChange={handleInvestChange}>
                  <option value="invest">Bỏ tiền vào (Đầu tư)</option>
                  <option value="withdraw">Rút tiền ra (Thoát vị)</option>
                </select>
              </div>
              <div>
                <label>Số tiền (VNĐ)</label>
                <MoneyInput name="amount" placeholder="0" value={investForm.amount} onChange={handleInvestChange} />
              </div>
              <div>
                <label>Ngày giao dịch</label>
                <input name="invested_at" type="date" value={investForm.invested_at} onChange={handleInvestChange} />
              </div>
            </div>

            <label>Ghi chú</label>
            <textarea name="note" placeholder="Mua thêm cổ phiếu, rút lợi nhuận..." value={investForm.note} onChange={handleInvestChange} />

            <div className="invest-modal-actions">
              <button className="invest-save-btn" type="submit" disabled={saving}>
                <Check size={18} /> {saving ? "Đang lưu..." : "Lưu giao dịch"}
              </button>
              <button className="invest-cancel-btn" type="button" onClick={() => setShowInvestModal(false)}>
                <X size={18} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

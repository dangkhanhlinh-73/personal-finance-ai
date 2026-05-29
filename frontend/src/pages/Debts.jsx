import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  X,
  Check,
  Clock,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  CalendarDays,
  Search,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import DataTable from "../components/DataTable";
import "./Debts.css";

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

function DebtCard({ debt, onPayment, onViewPayments, onDelete }) {
  const isPaid = debt.status === "paid";
  const isOverdue = debt.status === "overdue";
  const isBorrow = debt.debt_type === "borrow";
  const paidPct = debt.total_amount > 0
    ? Math.min(100, ((debt.total_amount - debt.remaining_amount) / debt.total_amount) * 100)
    : 0;

  return (
    <div className="debt-card">
      <div className="debt-card-header">
        <div className={`debt-type-icon ${isBorrow ? "borrow" : "lend"}`}>
          {isBorrow ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
        </div>
        <div className="debt-card-info">
          <div className="debt-card-title-row">
            <h3>{debt.partner_name}</h3>
            <span className={`debt-type-badge ${isBorrow ? "type-borrow" : "type-lend"}`}>
              {isBorrow ? "Đi mượn" : "Cho mượn"}
            </span>
            <span className={`debt-status-badge status-${debt.status}`}>
              {isPaid ? "Đã tất toán" : isOverdue ? "Quá hạn" : "Hoạt động"}
            </span>
          </div>
          <div className="debt-card-meta">
            <span><Wallet size={13} /> {debt.account_name || "—"}</span>
            <span><User size={13} /> Lãi suất: {debt.interest_rate ?? 0}%/năm</span>
            <span><CalendarDays size={13} /> Bắt đầu: {formatDate(debt.start_date)}</span>
            {debt.due_date && (
              <span className={isOverdue ? "overdue-text" : ""}>
                <CalendarDays size={13} /> Hạn trả: {formatDate(debt.due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="debt-card-amounts">
          <div className="debt-amount-row">
            <span>Tổng:</span>
            <b>{formatCurrency(debt.total_amount)}</b>
          </div>
          <div className="debt-amount-row remaining">
            <span>Còn lại:</span>
            <b>{formatCurrency(debt.remaining_amount)}</b>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="debt-progress-wrap">
        <div className="debt-progress-bar">
          <div
            className="debt-progress-fill"
            style={{ width: `${paidPct}%`, background: isPaid ? "#22c55e" : isBorrow ? "#ef4444" : "#0891b2" }}
          />
        </div>
        <span className="debt-progress-label">{paidPct.toFixed(0)}% đã thanh toán</span>
      </div>

      {/* Action buttons */}
      <div className="debt-card-actions">
        {!isPaid && (
          <button className="payment-btn" type="button" onClick={() => onPayment(debt)}>
            <Check size={15} /> Thanh toán
          </button>
        )}
        <button className="view-payments-btn" type="button" onClick={() => onViewPayments(debt)}>
          <Clock size={15} /> Lịch sử TT
        </button>
        <button className="delete-debt-btn" type="button" onClick={() => onDelete(debt.debt_id)}>
          <Trash2 size={15} /> Xóa
        </button>
      </div>
    </div>
  );
}

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Payments history modal
  const [paymentsModalDebt, setPaymentsModalDebt] = useState(null);
  const [paymentsModalList, setPaymentsModalList] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Debt modal
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtForm, setDebtForm] = useState({
    account_id: "",
    debt_type: "borrow",
    partner_name: "",
    total_amount: "",
    interest_rate: "0",
    start_date: "",
    due_date: "",
    note: "",
  });

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    account_id: "",
    payment_amount: "",
    payment_date: "",
    note: "",
  });

  const loadDebts = async () => {
    try {
      const res = await api.get("/debts/");
      setDebts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD DEBTS ERROR:", err.response?.data || err.message);
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
    loadDebts();
    loadAccounts();
  }, []);

  // ── Debt form ──────────────────────────────────────────────────────────────
  const openDebtModal = () => {
    setError("");
    setDebtForm({
      account_id: accounts.length > 0 ? String(accounts[0].account_id) : "",
      debt_type: "borrow",
      partner_name: "",
      total_amount: "",
      interest_rate: "0",
      start_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      note: "",
    });
    setShowDebtModal(true);
  };

  const handleDebtChange = (e) => {
    const { name, value } = e.target;
    setDebtForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    setError("");
    if (!debtForm.account_id) { setError("Vui lòng chọn tài khoản"); return; }
    if (!debtForm.partner_name.trim()) { setError("Vui lòng nhập tên đối tác"); return; }
    if (Number(debtForm.total_amount) <= 0) { setError("Số tiền phải lớn hơn 0"); return; }
    if (!debtForm.start_date) { setError("Vui lòng chọn ngày bắt đầu"); return; }

    setSaving(true);
    try {
      await api.post("/debts/", {
        account_id: Number(debtForm.account_id),
        debt_type: debtForm.debt_type,
        partner_name: debtForm.partner_name.trim(),
        total_amount: Number(debtForm.total_amount),
        interest_rate: Number(debtForm.interest_rate || 0),
        start_date: debtForm.start_date,
        due_date: debtForm.due_date || null,
        note: debtForm.note.trim() || null,
      });
      setShowDebtModal(false);
      await loadDebts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDebt = async (debtId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khoản vay/nợ này không?")) return;
    try {
      await api.delete(`/debts/${debtId}`);
      await loadDebts();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const openPaymentModal = (debt) => {
    setError("");
    setPaymentDebt(debt);
    setPaymentForm({
      account_id: accounts.length > 0 ? String(accounts[0].account_id) : "",
      payment_amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setShowPaymentModal(true);
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setError("");
    if (!paymentForm.account_id) { setError("Vui lòng chọn tài khoản"); return; }
    if (Number(paymentForm.payment_amount) <= 0) { setError("Số tiền phải lớn hơn 0"); return; }
    if (!paymentForm.payment_date) { setError("Vui lòng chọn ngày thanh toán"); return; }

    setSaving(true);
    try {
      await api.post(`/debts/${paymentDebt.debt_id}/payments`, {
        account_id: Number(paymentForm.account_id),
        payment_amount: Number(paymentForm.payment_amount),
        payment_date: paymentForm.payment_date,
        note: paymentForm.note.trim() || null,
      });
      setShowPaymentModal(false);
      await loadDebts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (debtId, paymentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa thanh toán này không?")) return;
    try {
      await api.delete(`/debts/${debtId}/payments/${paymentId}`);
      await loadDebts();
      if (paymentsModalDebt && paymentsModalDebt.debt_id === debtId) {
        const res = await api.get(`/debts/${debtId}/payments`);
        setPaymentsModalList(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // ── Payments history modal ─────────────────────────────────────────────────
  const openPaymentsModal = async (debt) => {
    setPaymentsModalDebt(debt);
    setPaymentsModalList([]);
    setPaymentsLoading(true);
    try {
      const res = await api.get(`/debts/${debt.debt_id}/payments`);
      setPaymentsModalList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD PAYMENTS ERROR:", err.response?.data || err.message);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const closePaymentsModal = () => {
    setPaymentsModalDebt(null);
    setPaymentsModalList([]);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalBorrowRemaining = debts
    .filter((d) => d.debt_type === "borrow")
    .reduce((sum, d) => sum + Number(d.remaining_amount || 0), 0);
  const totalLendRemaining = debts
    .filter((d) => d.debt_type === "lend")
    .reduce((sum, d) => sum + Number(d.remaining_amount || 0), 0);
  const activeCount = debts.filter((d) => d.status === "active").length;
  const overdueCount = debts.filter((d) => d.status === "overdue").length;

  // ── Filter + search ────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = debts;
    if (filterType !== "all") list = list.filter((d) => d.debt_type === filterType);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.partner_name.toLowerCase().includes(q) || (d.account_name || "").toLowerCase().includes(q));
    }
    return list;
  }, [debts, filterType, search]);

  const paymentColumns = [
    { key: "payment_date", label: "Ngày", sortable: true, render: (row) => formatDate(row.payment_date) },
    { key: "account_name", label: "Tài khoản" },
    {
      key: "payment_amount", label: "Số tiền", sortable: true, align: "right",
      render: (row) => <span style={{ fontWeight: 600, color: "#16a34a" }}>{formatCurrency(row.payment_amount)}</span>,
    },
    { key: "note", label: "Ghi chú", render: (row) => row.note || "—" },
    {
      key: "actions", label: "",
      render: (row) => (
        <button
          className="delete-payment-btn" type="button"
          onClick={() => handleDeletePayment(paymentsModalDebt.debt_id, row.payment_id)}
          title="Xóa thanh toán"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="debts-layout">
      <Sidebar activePage="debts" />

      <main className="debts-main">
        <div className="debts-header">
          <div>
            <h1>Quản lý vay nợ</h1>
            <p>Theo dõi các khoản vay và cho mượn</p>
          </div>
          <button className="add-debt-btn" type="button" onClick={openDebtModal}>
            <Plus size={20} /> Thêm khoản vay/nợ
          </button>
        </div>

        {/* Stats */}
        <section className="debt-stats">
          <div className="debt-stat-card">
            <p>Đang hoạt động</p>
            <h2>{activeCount}</h2>
            <span>{overdueCount > 0 ? `${overdueCount} quá hạn` : "Không quá hạn"}</span>
          </div>
          <div className="debt-stat-card borrow">
            <p>Tổng còn nợ (đi mượn)</p>
            <h2>{formatCurrency(totalBorrowRemaining)}</h2>
            <span>Số tiền cần trả</span>
          </div>
          <div className="debt-stat-card lend">
            <p>Tổng còn cho vay</p>
            <h2>{formatCurrency(totalLendRemaining)}</h2>
            <span>Số tiền cần thu về</span>
          </div>
        </section>

        {/* Toolbar */}
        <div className="debt-toolbar">
          <div className="debt-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Tìm theo tên đối tác..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="debt-filter-chips">
            {[
              { id: "all", label: "Tất cả" },
              { id: "borrow", label: "Đi mượn" },
              { id: "lend", label: "Cho mượn" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`debt-chip ${filterType === f.id ? "active" : ""}`}
                onClick={() => setFilterType(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="debt-count">{visible.length} khoản</span>
        </div>

        {/* Debt list */}
        {visible.length === 0 ? (
          <div className="debt-empty">
            <HandCoins size={40} strokeWidth={1.2} />
            <p>Chưa có khoản vay/nợ nào.</p>
          </div>
        ) : (
          <div className="debt-list">
            {visible.map((debt) => (
              <DebtCard
                key={debt.debt_id}
                debt={debt}
                onPayment={openPaymentModal}
                onViewPayments={openPaymentsModal}
                onDelete={handleDeleteDebt}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add debt modal */}
      {showDebtModal && (
        <div className="debt-modal-backdrop">
          <form className="debt-modal" onSubmit={handleCreateDebt}>
            <div className="debt-modal-header">
              <h2>Thêm khoản vay/nợ</h2>
              <button type="button" onClick={() => setShowDebtModal(false)}><X size={22} /></button>
            </div>
            {error && <div className="debt-error">{error}</div>}

            <div className="debt-form-grid">
              <div>
                <label>Loại</label>
                <select name="debt_type" value={debtForm.debt_type} onChange={handleDebtChange}>
                  <option value="borrow">Đi mượn (nhận tiền)</option>
                  <option value="lend">Cho mượn (cho tiền)</option>
                </select>
              </div>
              <div>
                <label>Tài khoản</label>
                <select name="account_id" value={debtForm.account_id} onChange={handleDebtChange}>
                  <option value="">Chọn tài khoản</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_name} — {formatCurrency(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Tên đối tác</label>
                <input
                  name="partner_name"
                  placeholder="Tên người hoặc tổ chức"
                  value={debtForm.partner_name}
                  onChange={handleDebtChange}
                  required
                />
              </div>
              <div>
                <label>Tổng số tiền (VNĐ)</label>
                <MoneyInput name="total_amount" placeholder="0" value={debtForm.total_amount} onChange={handleDebtChange} />
              </div>
              <div>
                <label>Lãi suất (%/năm)</label>
                <input name="interest_rate" type="number" min="0" step="0.01" placeholder="0" value={debtForm.interest_rate} onChange={handleDebtChange} />
              </div>
              <div>
                <label>Ngày bắt đầu</label>
                <input name="start_date" type="date" value={debtForm.start_date} onChange={handleDebtChange} />
              </div>
              <div>
                <label>Ngày đến hạn (tuỳ chọn)</label>
                <input name="due_date" type="date" value={debtForm.due_date} onChange={handleDebtChange} />
              </div>
            </div>

            <label>Ghi chú</label>
            <textarea name="note" placeholder="Mô tả thêm..." value={debtForm.note} onChange={handleDebtChange} />

            <div className="debt-modal-actions">
              <button className="debt-save-btn" type="submit" disabled={saving}>
                <Check size={18} /> {saving ? "Đang lưu..." : "Thêm khoản vay/nợ"}
              </button>
              <button className="debt-cancel-btn" type="button" onClick={() => setShowDebtModal(false)}>
                <X size={18} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && paymentDebt && (
        <div className="debt-modal-backdrop">
          <form className="debt-modal debt-modal-sm" onSubmit={handleCreatePayment}>
            <div className="debt-modal-header">
              <div>
                <h2>Thanh toán</h2>
                <p className="payment-debt-name">
                  {paymentDebt.debt_type === "borrow" ? "Trả nợ cho" : "Thu hồi từ"}: {paymentDebt.partner_name}
                </p>
                <p className="payment-debt-name" style={{ color: "#2563eb" }}>
                  Còn lại: {formatCurrency(paymentDebt.remaining_amount)}
                </p>
              </div>
              <button type="button" onClick={() => setShowPaymentModal(false)}><X size={22} /></button>
            </div>
            {error && <div className="debt-error">{error}</div>}

            <label>Tài khoản thanh toán</label>
            <select name="account_id" value={paymentForm.account_id} onChange={handlePaymentChange}>
              <option value="">Chọn tài khoản</option>
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.account_name} — {formatCurrency(a.balance)}
                </option>
              ))}
            </select>

            <label>Số tiền thanh toán (VNĐ)</label>
            <MoneyInput name="payment_amount" placeholder="0" value={paymentForm.payment_amount} onChange={handlePaymentChange} />

            <label>Ngày thanh toán</label>
            <input name="payment_date" type="date" value={paymentForm.payment_date} onChange={handlePaymentChange} />

            <label>Ghi chú</label>
            <textarea name="note" placeholder="Thanh toán kỳ 1, trả lãi tháng 3..." value={paymentForm.note} onChange={handlePaymentChange} />

            <div className="debt-modal-actions">
              <button className="debt-save-btn" type="submit" disabled={saving}>
                <Check size={18} /> {saving ? "Đang lưu..." : "Xác nhận thanh toán"}
              </button>
              <button className="debt-cancel-btn" type="button" onClick={() => setShowPaymentModal(false)}>
                <X size={18} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments history modal */}
      {paymentsModalDebt && (
        <div className="debt-modal-backdrop">
          <div className="debt-modal debt-modal-lg">
            <div className="debt-modal-header">
              <div>
                <h2>Lịch sử thanh toán</h2>
                <p className="payment-debt-name">Khoản: {paymentsModalDebt.partner_name}</p>
              </div>
              <button type="button" onClick={closePaymentsModal}><X size={22} /></button>
            </div>

            {paymentsLoading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Đang tải...</div>
            ) : (
              <DataTable
                columns={paymentColumns}
                data={paymentsModalList}
                rowKey="payment_id"
                searchFields={["account_name", "note"]}
                searchPlaceholder="Tìm kiếm thanh toán..."
                emptyMessage="Chưa có lần thanh toán nào."
                defaultPageSize={10}
              />
            )}

            <div className="debt-modal-actions" style={{ marginTop: 16 }}>
              <button className="debt-cancel-btn" type="button" onClick={closePaymentsModal}>
                <X size={18} /> Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

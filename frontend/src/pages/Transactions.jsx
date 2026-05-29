import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  ScanLine,
  Trash2,
  X,
  Check,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import DataTable from "../components/DataTable";
import "./Transactions.css";

export default function Transactions() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState("");

  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deleteTransaction, setDeleteTransaction] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    transaction_type: "expense",
    amount: "",
    transaction_date: "",
    category_id: "",
    account_id: "",
    description: "",
    merchant_name: "",
  });

  const loadTransactions = async () => {
    try {
      const res = await api.get("/transactions/");
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD TRANSACTIONS ERROR:", err.response?.data || err.message);
      setError("Không tải được danh sách giao dịch");
      setTransactions([]);
    }
  };

  const loadOptions = async () => {
    try {
      const res = await api.get("/transactions/options");
      setAccounts(Array.isArray(res.data.accounts) ? res.data.accounts : []);
      setAllCategories(Array.isArray(res.data.categories) ? res.data.categories : []);
    } catch (err) {
      console.log("LOAD OPTIONS ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    loadTransactions();
    loadOptions();
  }, []);

  const categories = useMemo(() => {
    const map = new Map();
    transactions.forEach((item) => {
      if (item.category_id && item.category_name) {
        map.set(item.category_id, item.category_name);
      }
    });
    return Array.from(map.entries()).map(([category_id, category_name]) => ({
      category_id,
      category_name,
    }));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchType = typeFilter ? item.transaction_type === typeFilter : true;
      const matchCategory = categoryFilter ? Number(item.category_id) === Number(categoryFilter) : true;
      return matchType && matchCategory;
    });
  }, [transactions, typeFilter, categoryFilter]);

  const tableData = filteredTransactions.map((t) => ({
    ...t,
    display_title: t.merchant_name || t.description || "",
  }));

  const editCategories = allCategories.filter((category) => {
    if (editForm.transaction_type === "income") return category.group_type === "income";
    return ["expense", "debt", "investment"].includes(category.group_type);
  });

  const totalIncome = filteredTransactions
    .filter((item) => item.transaction_type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalExpense = filteredTransactions
    .filter((item) => item.transaction_type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const incomeCount = filteredTransactions.filter((item) => item.transaction_type === "income").length;
  const expenseCount = filteredTransactions.filter((item) => item.transaction_type === "expense").length;

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const formatDateTime = (value) => {
    if (!value) return "";
    const cleanValue = value.replace("T", " ").slice(0, 16);
    const [datePart, timePart] = cleanValue.split(" ");
    const [year, month, day] = datePart.split("-");
    return `${timePart} ${day}/${month}/${year}`;
  };

  const toDateTimeLocalValue = (value) => {
    if (!value) return "";
    return value.replace(" ", "T").slice(0, 16);
  };

  const normalizeDateTime = (value) => {
    if (!value) return "";
    return value.length === 16 ? `${value}:00` : value;
  };

  const getTitle = (item) => {
    if (item.merchant_name) return item.merchant_name;
    if (item.description) return item.description;
    return item.transaction_type === "income" ? "Giao dịch thu nhập" : "Giao dịch chi tiêu";
  };

  const getErrorMessage = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
    return "Có lỗi xảy ra";
  };

  const openEditModal = (item) => {
    setError("");
    setEditingTransaction(item);
    setEditForm({
      transaction_type: item.transaction_type || "expense",
      amount: String(item.amount || ""),
      transaction_date: toDateTimeLocalValue(item.transaction_date),
      category_id: String(item.category_id || ""),
      account_id: String(item.account_id || ""),
      description: item.description || "",
      merchant_name: item.merchant_name || "",
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "transaction_type" ? { category_id: "" } : {}),
    }));
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    if (!editingTransaction) return;

    if (!editForm.transaction_date) { setError("Vui lòng chọn ngày giờ giao dịch"); return; }
    if (!editForm.account_id) { setError("Vui lòng chọn tài khoản"); return; }
    if (!editForm.category_id) { setError("Vui lòng chọn danh mục"); return; }
    if (Number(editForm.amount) <= 0) { setError("Số tiền phải lớn hơn 0"); return; }

    setSaving(true);
    setError("");

    try {
      await api.put(`/transactions/${editingTransaction.transaction_id}`, {
        account_id: Number(editForm.account_id),
        category_id: Number(editForm.category_id),
        amount: Number(editForm.amount),
        transaction_type: editForm.transaction_type,
        transaction_date: normalizeDateTime(editForm.transaction_date),
        description: editForm.description.trim() || null,
        merchant_name: editForm.merchant_name.trim() || null,
      });

      setEditingTransaction(null);
      await loadTransactions();
      await loadOptions();
    } catch (err) {
      console.log("UPDATE TRANSACTION ERROR:", err.response?.data || err.message);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransaction) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/transactions/${deleteTransaction.transaction_id}`);
      setDeleteTransaction(null);
      await loadTransactions();
      await loadOptions();
    } catch (err) {
      console.log("DELETE TRANSACTION ERROR:", err.response?.data || err.message);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmTransaction = async (id) => {
    try {
      await api.patch(`/transactions/${id}/confirm`);
      await loadTransactions();
    } catch (err) {
      console.log("CONFIRM ERROR:", err.response?.data || err.message);
      alert(getErrorMessage(err));
    }
  };

  const handleCancelTransaction = async (id) => {
    if (!window.confirm("Bạn có chắc muốn hủy giao dịch này không?")) return;
    try {
      await api.patch(`/transactions/${id}/cancel`);
      await loadTransactions();
    } catch (err) {
      console.log("CANCEL ERROR:", err.response?.data || err.message);
      alert(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: "transaction_date",
      label: "Ngày GD",
      sortable: true,
      render: (row) => formatDateTime(row.transaction_date),
    },
    {
      key: "transaction_type",
      label: "Loại",
      sortable: true,
      render: (row) =>
        row.transaction_type === "income" ? (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#dcfce7", color: "#16a34a" }}>
            Thu
          </span>
        ) : (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#fee2e2", color: "#dc2626" }}>
            Chi
          </span>
        ),
    },
    {
      key: "category_name",
      label: "Danh mục",
      sortable: true,
    },
    {
      key: "account_name",
      label: "Tài khoản",
      sortable: true,
    },
    {
      key: "display_title",
      label: "Người bán / Mô tả",
      render: (row) => (
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {row.display_title || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Số tiền",
      sortable: true,
      align: "right",
      render: (row) => (
        <span style={{ fontWeight: 600, color: row.transaction_type === "income" ? "#16a34a" : "#dc2626" }}>
          {row.transaction_type === "income" ? "+" : "-"}
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Trạng thái",
      render: (row) => {
        const statusBadge = row.status === "confirmed"
          ? <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#dcfce7", color: "#16a34a" }}>XN</span>
          : row.status === "cancelled"
          ? <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}>Hủy</span>
          : <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#fef9c3", color: "#ca8a04" }}>Chờ</span>;
        const ocrBadge = (row.source_type === "image" || row.source_type === "ai")
          ? <span style={{ padding: "1px 6px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: "#e0f2fe", color: "#0369a1", marginLeft: 4 }}>OCR</span>
          : null;
        return <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>{statusBadge}{ocrBadge}</span>;
      },
    },
    {
      key: "created_at",
      label: "Ngày tạo",
      sortable: true,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "actions",
      label: "Hành động",
      width: "140px",
      render: (row) => (
        <div className="tx-row-actions">
          <button
            type="button"
            className="tx-icon-btn edit"
            title="Sửa"
            onClick={() => openEditModal(row)}
          >
            <Pencil size={15} />
          </button>
          {row.status === "pending" && (
            <button
              type="button"
              className="tx-icon-btn confirm"
              title="Xác nhận giao dịch"
              onClick={() => handleConfirmTransaction(row.transaction_id)}
            >
              <CheckCircle size={15} />
            </button>
          )}
          {row.status === "pending" && (
            <button
              type="button"
              className="tx-icon-btn cancel-tx"
              title="Hủy giao dịch"
              onClick={() => handleCancelTransaction(row.transaction_id)}
            >
              <XCircle size={15} />
            </button>
          )}
          <button
            type="button"
            className="tx-icon-btn delete"
            title="Xóa"
            onClick={() => setDeleteTransaction(row)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="transactions-layout">
      <Sidebar activePage="transactions" />

      <main className="transactions-main">
        <div className="transactions-header">
          <div>
            <h1>Quản lý giao dịch</h1>
            <p>Theo dõi và quản lý tất cả các giao dịch tài chính</p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="add-transaction-btn" type="button" onClick={() => navigate("/scan")} style={{ background: "#f1f5f9", color: "#334155" }}>
              <ScanLine size={20} />
              Quét hóa đơn
            </button>
            <button className="add-transaction-btn" type="button" onClick={() => navigate("/transactions/add")}>
              <Plus size={22} />
              Thêm giao dịch
            </button>
          </div>
        </div>

        {error && <div className="transactions-error">{error}</div>}

        <section className="transaction-stats">
          <div className="stat-card">
            <p>Tổng giao dịch</p>
            <h2>{filteredTransactions.length}</h2>
            <span>Hiện có</span>
          </div>

          <div className="stat-card">
            <p>Tổng thu nhập</p>
            <h2 className="income">+ {formatCurrency(totalIncome)}</h2>
            <span>{incomeCount} giao dịch</span>
          </div>

          <div className="stat-card">
            <p>Tổng chi tiêu</p>
            <h2 className="expense">- {formatCurrency(totalExpense)}</h2>
            <span>{expenseCount} giao dịch</span>
          </div>
        </section>

        {/* External filters */}
        <div className="tx-external-filters">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tất cả loại</option>
            <option value="income">Thu nhập</option>
            <option value="expense">Chi tiêu</option>
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_name}
              </option>
            ))}
          </select>
        </div>

        <DataTable
          columns={columns}
          data={tableData}
          rowKey="transaction_id"
          searchFields={["category_name", "account_name", "display_title"]}
          searchPlaceholder="Tìm kiếm giao dịch..."
          emptyMessage="Chưa có giao dịch nào"
          defaultPageSize={10}
        />
      </main>

      {editingTransaction && (
        <div className="transaction-modal-backdrop">
          <form className="transaction-modal" onSubmit={handleUpdateTransaction}>
            <div className="transaction-modal-header">
              <h2>Sửa giao dịch</h2>
              <button type="button" onClick={() => setEditingTransaction(null)}>
                <X size={22} />
              </button>
            </div>

            {error && <div className="transactions-error">{error}</div>}

            <div className="modal-grid">
              <div>
                <label>Loại giao dịch</label>
                <select name="transaction_type" value={editForm.transaction_type} onChange={handleEditChange}>
                  <option value="expense">Chi tiêu</option>
                  <option value="income">Thu nhập</option>
                </select>
              </div>

              <div>
                <label>Số tiền</label>
                <MoneyInput name="amount" value={editForm.amount} onChange={handleEditChange} />
              </div>

              <div>
                <label>Ngày giờ</label>
                <input name="transaction_date" type="datetime-local" value={editForm.transaction_date} onChange={handleEditChange} />
              </div>

              <div>
                <label>Danh mục</label>
                <select name="category_id" value={editForm.category_id} onChange={handleEditChange}>
                  <option value="">Chọn danh mục</option>
                  {editCategories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label>Tài khoản</label>
            <select name="account_id" value={editForm.account_id} onChange={handleEditChange}>
              <option value="">Chọn tài khoản</option>
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.account_name} - {Number(account.balance).toLocaleString("vi-VN")} đ
                </option>
              ))}
            </select>

            <label>Người bán / nơi nhận tiền</label>
            <input name="merchant_name" type="text" value={editForm.merchant_name} onChange={handleEditChange} />

            <label>Mô tả</label>
            <textarea name="description" value={editForm.description} onChange={handleEditChange} />

            <div className="modal-actions">
              <button className="save-modal-btn" type="submit" disabled={saving}>
                <Check size={19} />
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>

              <button className="cancel-modal-btn" type="button" onClick={() => setEditingTransaction(null)}>
                <X size={19} />
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTransaction && (
        <div className="transaction-modal-backdrop">
          <div className="delete-modal">
            <h2>Xóa giao dịch</h2>
            <p>
              Bạn có chắc muốn xóa giao dịch <b>{getTitle(deleteTransaction)}</b> không?
            </p>

            <div className="modal-actions">
              <button className="delete-confirm-btn" type="button" disabled={saving} onClick={handleDeleteTransaction}>
                <Trash2 size={19} />
                {saving ? "Đang xóa..." : "Xóa"}
              </button>

              <button className="cancel-modal-btn" type="button" onClick={() => setDeleteTransaction(null)}>
                <X size={19} />
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

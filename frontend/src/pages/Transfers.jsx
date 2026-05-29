import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import DataTable from "../components/DataTable";
import "./Transfers.css";

export default function Transfers() {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTransfer, setDeleteTransfer] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transfer_date: "",
    note: "",
  });

  const normalizeDateTime = (value) => {
    if (!value) return "";
    return value.length === 16 ? `${value}:00` : value;
  };

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const formatDateTime = (value) => {
    if (!value) return "";
    const cleanValue = value.replace("T", " ").slice(0, 16);
    const [datePart, timePart] = cleanValue.split(" ");
    const [year, month, day] = datePart.split("-");
    return `${timePart} ${day}/${month}/${year}`;
  };

  const getErrorMessage = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
    return "Có lỗi xảy ra";
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/accounts/");
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD ACCOUNTS ERROR:", err.response?.data || err.message);
      setError("Không tải được tài khoản");
    }
  };

  const loadTransfers = async () => {
    try {
      const res = await api.get("/transfers/");
      setTransfers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD TRANSFERS ERROR:", err.response?.data || err.message);
      setError("Không tải được danh sách chuyển tiền");
    }
  };

  useEffect(() => {
    loadAccounts();
    loadTransfers();
  }, []);

  const totalTransferAmount = transfers.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const todayIso = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const openCreateModal = () => {
    setError("");
    setFormData({
      from_account_id: "",
      to_account_id: "",
      amount: "",
      transfer_date: todayIso(),
      note: "",
    });
    setShowCreateModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.from_account_id) { setError("Vui lòng chọn tài khoản nguồn"); return; }
    if (!formData.to_account_id) { setError("Vui lòng chọn tài khoản nhận"); return; }
    if (Number(formData.from_account_id) === Number(formData.to_account_id)) {
      setError("Tài khoản nguồn và tài khoản nhận không được trùng nhau");
      return;
    }
    if (Number(formData.amount) <= 0) { setError("Số tiền chuyển phải lớn hơn 0"); return; }
    if (!formData.transfer_date) { setError("Vui lòng chọn ngày giờ chuyển tiền"); return; }

    setSaving(true);

    try {
      await api.post("/transfers/", {
        from_account_id: Number(formData.from_account_id),
        to_account_id: Number(formData.to_account_id),
        amount: Number(formData.amount),
        transfer_date: normalizeDateTime(formData.transfer_date),
        note: formData.note.trim() || null,
      });

      setShowCreateModal(false);
      await loadAccounts();
      await loadTransfers();
    } catch (err) {
      console.log("CREATE TRANSFER ERROR:", err.response?.data || err.message);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!deleteTransfer) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/transfers/${deleteTransfer.transfer_id}`);
      setDeleteTransfer(null);
      await loadAccounts();
      await loadTransfers();
    } catch (err) {
      console.log("DELETE TRANSFER ERROR:", err.response?.data || err.message);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "transfer_date",
      label: "Ngày giờ",
      sortable: true,
      render: (row) => formatDateTime(row.transfer_date),
    },
    {
      key: "from_account_name",
      label: "Từ tài khoản",
      sortable: true,
    },
    {
      key: "_arrow",
      label: "",
      width: "32px",
      render: () => (
        <span style={{ color: "#9ca3af" }}>
          <ArrowRight size={16} />
        </span>
      ),
    },
    {
      key: "to_account_name",
      label: "Đến tài khoản",
      sortable: true,
    },
    {
      key: "amount",
      label: "Số tiền",
      sortable: true,
      align: "right",
      render: (row) => (
        <span style={{ fontWeight: 600 }}>{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: "note",
      label: "Ghi chú",
      render: (row) => (
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {row.note || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Hành động",
      render: (row) => (
        <button
          className="delete-transfer-btn"
          type="button"
          onClick={() => setDeleteTransfer(row)}
          title="Xóa"
        >
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  return (
    <div className="transfers-layout">
      <Sidebar activePage="transfers" />

      <main className="transfers-main">
        <div className="transfers-header">
          <div>
            <h1>Chuyển tiền</h1>
            <p>Chuyển tiền giữa các tài khoản cá nhân của bạn</p>
          </div>

          <button className="add-transfer-btn" type="button" onClick={openCreateModal}>
            <Plus size={22} />
            Tạo chuyển tiền
          </button>
        </div>

        {error && <div className="transfers-error">{error}</div>}

        <section className="transfer-stats">
          <div className="transfer-stat-card">
            <p>Tổng lượt chuyển</p>
            <h2>{transfers.length}</h2>
            <span>Giao dịch chuyển tiền</span>
          </div>

          <div className="transfer-stat-card">
            <p>Tổng tiền đã chuyển</p>
            <h2>{formatCurrency(totalTransferAmount)}</h2>
            <span>Tổng số tiền</span>
          </div>
        </section>

        <DataTable
          columns={columns}
          data={transfers}
          rowKey="transfer_id"
          searchFields={["from_account_name", "to_account_name", "note"]}
          searchPlaceholder="Tìm theo tài khoản hoặc ghi chú..."
          emptyMessage="Chưa có giao dịch chuyển tiền nào"
          defaultPageSize={10}
        />
      </main>

      {showCreateModal && (
        <div className="transfer-modal-backdrop">
          <form className="transfer-modal" onSubmit={handleCreateTransfer}>
            <div className="transfer-modal-header">
              <h2>Tạo chuyển tiền</h2>
              <button type="button" onClick={() => setShowCreateModal(false)}>
                <X size={22} />
              </button>
            </div>

            {error && <div className="transfers-error" style={{ marginBottom: 14 }}>{error}</div>}

            <div className="transfer-form-grid">
              <div>
                <label>Tài khoản nguồn</label>
                <select name="from_account_id" value={formData.from_account_id} onChange={handleChange}>
                  <option value="">Chọn tài khoản nguồn</option>
                  {accounts.map((account) => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name} - {formatCurrency(account.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Tài khoản nhận</label>
                <select name="to_account_id" value={formData.to_account_id} onChange={handleChange}>
                  <option value="">Chọn tài khoản nhận</option>
                  {accounts.map((account) => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name} - {formatCurrency(account.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Số tiền chuyển</label>
                <MoneyInput
                  name="amount"
                  placeholder="0"
                  value={formData.amount}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Ngày giờ chuyển</label>
                <input
                  name="transfer_date"
                  type="datetime-local"
                  value={formData.transfer_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <label>Ghi chú</label>
            <textarea
              name="note"
              placeholder="Ví dụ: Chuyển tiền sang ví điện tử, nộp tiền vào ngân hàng..."
              value={formData.note}
              onChange={handleChange}
            />

            <div className="transfer-modal-actions">
              <button className="save-transfer-btn" type="submit" disabled={saving}>
                <Check size={19} />
                {saving ? "Đang lưu..." : "Lưu chuyển tiền"}
              </button>

              <button className="cancel-transfer-btn" type="button" onClick={() => setShowCreateModal(false)}>
                <X size={19} />
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTransfer && (
        <div className="transfer-modal-backdrop">
          <div className="delete-transfer-modal">
            <h2>Xóa chuyển tiền</h2>
            <p>
              Bạn có chắc muốn xóa chuyển tiền từ <b>{deleteTransfer.from_account_name}</b> sang{" "}
              <b>{deleteTransfer.to_account_name}</b> không? Số dư sẽ được hoàn tác.
            </p>

            <div className="transfer-modal-actions">
              <button className="delete-confirm-btn" type="button" disabled={saving} onClick={handleDeleteTransfer}>
                <Trash2 size={19} />
                {saving ? "Đang xóa..." : "Xóa"}
              </button>

              <button className="cancel-transfer-btn" type="button" onClick={() => setDeleteTransfer(null)}>
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

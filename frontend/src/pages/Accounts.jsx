import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import DataTable from "../components/DataTable";
import "./Accounts.css";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    account_name: "",
    account_type: "bank",
    balance: "",
    currency: "VND",
    is_default: false,
  });

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balance || 0),
    0
  );

  const loadData = async () => {
    try {
      const accRes = await api.get("/accounts/");
      setAccounts(accRes.data);
    } catch (err) {
      console.log("LOAD ACCOUNTS ERROR:", err);
      setError("Không tải được dữ liệu");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setError("");
    setEditingId(null);
    setFormData({
      account_name: "",
      account_type: "bank",
      balance: "",
      currency: "VND",
      is_default: false,
    });
    setShowAddModal(true);
  };

  const openEditModal = (account) => {
    setError("");
    setEditingId(account.account_id);
    setFormData({
      account_name: account.account_name,
      account_type: account.account_type,
      balance: account.balance,
      currency: account.currency,
      is_default: account.is_default,
    });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setError("");
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.account_name.trim()) {
      setError("Vui lòng nhập tên tài khoản");
      return;
    }

    if (Number(formData.balance || 0) < 0) {
      setError("Số dư không được nhỏ hơn 0");
      return;
    }

    try {
      const payload = {
        account_name: formData.account_name.trim(),
        account_type: formData.account_type,
        balance: Number(formData.balance || 0),
        currency: "VND",
        is_default: false,
      };

      if (editingId) {
        await api.put(`/accounts/${editingId}`, payload);
      } else {
        await api.post("/accounts/", payload);
      }

      closeAddModal();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Thao tác thất bại");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này không?")) return;
    try {
      await api.delete(`/accounts/${id}`);
      await loadData();
    } catch (err) {
      alert("Xóa thất bại!");
    }
  };

  const getTypeName = (type) => {
    if (type === "bank") return "Ngân hàng";
    if (type === "ewallet") return "Ví điện tử";
    return "Tiền mặt";
  };

  const TYPE_BADGE = {
    bank:    { bg: "#dbeafe", color: "#2563eb" },
    ewallet: { bg: "#f3e8ff", color: "#7c3aed" },
    cash:    { bg: "#dcfce7", color: "#16a34a" },
  };

  const columns = [
    {
      key: "account_name",
      label: "Tên tài khoản",
      sortable: true,
    },
    {
      key: "account_type",
      label: "Loại tài khoản",
      sortable: true,
      render: (row) => {
        const style = TYPE_BADGE[row.account_type] || { bg: "#f3f4f6", color: "#374151" };
        return (
          <span style={{
            padding: "2px 10px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            background: style.bg,
            color: style.color,
          }}>
            {getTypeName(row.account_type)}
          </span>
        );
      },
    },
    {
      key: "balance",
      label: "Số dư",
      sortable: true,
      align: "right",
      render: (row) => (
        <span style={{ fontWeight: 600 }}>{formatMoney(row.balance)}</span>
      ),
    },
    {
      key: "currency",
      label: "Tiền tệ",
    },
    {
      key: "actions",
      label: "Hành động",
      render: (row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="cat-edit-btn"
            onClick={() => openEditModal(row)}
            title="Sửa"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="cat-delete-btn"
            onClick={() => handleDelete(row.account_id)}
            title="Xóa"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="accounts-layout">
      <Sidebar activePage="accounts" />

      <main className="accounts-main">
        <div className="accounts-header">
          <div>
            <h1>Quản lý tài khoản</h1>
            <p>Quản lý các tài khoản ngân hàng, ví điện tử và tiền mặt</p>
          </div>
          <button className="add-account-btn" type="button" onClick={openAddModal}>
            <Plus size={20} />
            Thêm tài khoản
          </button>
        </div>

        {error && <div className="account-error">{error}</div>}

        <section className="account-total-card">
          <div>
            <p>Tổng số dư tất cả tài khoản</p>
            <h2>{formatMoney(totalBalance)}</h2>
            <span>{accounts.length} tài khoản</span>
          </div>
          <div className="account-total-icon">
            <Wallet size={56} />
          </div>
        </section>

        <DataTable
          columns={columns}
          data={accounts}
          rowKey="account_id"
          searchFields={["account_name"]}
          searchPlaceholder="Tìm kiếm tài khoản..."
          emptyMessage={'Bạn chưa có tài khoản nào. Hãy bấm "Thêm tài khoản".'}
          defaultPageSize={10}
        />
      </main>

      {showAddModal && (
        <div className="modal-overlay">
          <form className="add-modal" onSubmit={handleSubmit}>
            <div className="modal-title-row">
              <div>
                <h2>{editingId ? "Sửa tài khoản" : "Thêm tài khoản mới"}</h2>
                <p>{editingId ? "Cập nhật lại tên và số dư" : "Thêm tài khoản ngân hàng, ví điện tử hoặc tiền mặt"}</p>
              </div>
              <button type="button" className="close-btn" onClick={closeAddModal}>
                <X size={24} />
              </button>
            </div>

            {error && <div className="account-error">{error}</div>}

            <label>Tên tài khoản</label>
            <input
              name="account_name"
              placeholder="Vietcombank, MoMo, Tiền mặt..."
              value={formData.account_name}
              onChange={handleChange}
              autoFocus
              required
            />

            <label>Loại tài khoản</label>
            <select name="account_type" value={formData.account_type} onChange={handleChange}>
              <option value="bank">Ngân hàng</option>
              <option value="ewallet">Ví điện tử</option>
              <option value="cash">Tiền mặt</option>
            </select>

            <label>Số dư hiện tại (VNĐ)</label>
            <MoneyInput
              name="balance"
              placeholder="0"
              value={formData.balance}
              onChange={handleChange}
            />

            <div className="modal-actions">
              <button className="submit-btn" type="submit">
                {editingId ? "Lưu thay đổi" : "Thêm tài khoản"}
              </button>
              <button className="cancel-btn" type="button" onClick={closeAddModal}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

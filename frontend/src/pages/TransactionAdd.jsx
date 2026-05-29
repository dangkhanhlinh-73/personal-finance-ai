import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import MoneyInput from "../components/MoneyInput";
import "./TransactionAdd.css";

export default function TransactionAdd() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const todayIso = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const [formData, setFormData] = useState({
    transaction_type: "expense",
    amount: "",
    transaction_date: todayIso(),
    category_id: "",
    account_id: "",
    description: "",
    merchant_name: "",
  });

  const normalizeDateTime = (value) => {
    if (!value) return "";
    if (value.length === 16) return `${value}:00`;
    return value;
  };

  const loadOptions = async () => {
    try {
      const res = await api.get("/transactions/options");
      setAccounts(Array.isArray(res.data.accounts) ? res.data.accounts : []);
      setCategories(Array.isArray(res.data.categories) ? res.data.categories : []);
    } catch (err) {
      console.log("LOAD OPTIONS ERROR:", err.response?.data || err.message);
      setError("Không tải được tài khoản hoặc danh mục");
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const filteredCategories = categories.filter((c) => {
    if (formData.transaction_type === "income") return c.group_type === "income";
    return ["expense", "debt", "investment"].includes(c.group_type);
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "transaction_type" ? { category_id: "" } : {}),
    }));
  };

  const getErrorMessage = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
    return "Lưu giao dịch thất bại";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.transaction_date) { setError("Vui lòng chọn ngày giờ giao dịch"); return; }
    if (!formData.account_id)       { setError("Vui lòng chọn tài khoản"); return; }
    if (!formData.category_id)      { setError("Vui lòng chọn danh mục"); return; }
    if (Number(formData.amount) <= 0) { setError("Số tiền phải lớn hơn 0"); return; }

    setSaving(true);
    try {
      await api.post("/transactions/", {
        account_id:       Number(formData.account_id),
        category_id:      Number(formData.category_id),
        amount:           Number(formData.amount),
        transaction_type: formData.transaction_type,
        transaction_date: normalizeDateTime(formData.transaction_date),
        description:      formData.description.trim() || null,
        merchant_name:    formData.merchant_name.trim() || null,
      });
      navigate("/transactions");
    } catch (err) {
      console.log("CREATE TRANSACTION ERROR:", err.response?.data || err.message);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="transaction-add-layout">
      <Sidebar activePage="transactions" />

      <main className="transaction-add-main">
        <div className="back-row">
          <button type="button" onClick={() => navigate("/transactions")}>
            <ArrowLeft />
            Quay lại
          </button>
        </div>

        <div className="add-title">
          <h1>Thêm giao dịch mới</h1>
          <p>Nhập thủ công thông tin giao dịch</p>
        </div>

        {error && <div className="transaction-error">{error}</div>}

        <form className="manual-form" onSubmit={handleSubmit}>
          <h2>Thông tin giao dịch</h2>

          <div className="form-grid">
            <div>
              <label>Loại giao dịch</label>
              <select name="transaction_type" value={formData.transaction_type} onChange={handleChange}>
                <option value="expense">Chi tiêu</option>
                <option value="income">Thu nhập</option>
              </select>
            </div>

            <div>
              <label>Số tiền (VNĐ)</label>
              <MoneyInput
                name="amount"
                placeholder="0"
                value={formData.amount}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Ngày giờ giao dịch</label>
              <input
                name="transaction_date"
                type="datetime-local"
                value={formData.transaction_date}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Danh mục</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange}>
                <option value="">Chọn danh mục</option>
                {filteredCategories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                ))}
              </select>
            </div>
          </div>

          <label>Tài khoản</label>
          <select name="account_id" value={formData.account_id} onChange={handleChange}>
            <option value="">Chọn tài khoản</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} đ
              </option>
            ))}
          </select>

          <label>Người bán / nơi nhận tiền</label>
          <input
            name="merchant_name"
            type="text"
            placeholder="Tên cửa hàng, siêu thị..."
            value={formData.merchant_name}
            onChange={handleChange}
          />

          <label>Mô tả</label>
          <textarea
            name="description"
            placeholder="Nhập mô tả giao dịch..."
            value={formData.description}
            onChange={handleChange}
          />

          <div className="form-actions">
            <button className="save-btn" type="submit" disabled={saving}>
              <Check size={20} />
              {saving ? "Đang lưu..." : "Lưu giao dịch"}
            </button>
            <button className="cancel-btn" type="button" onClick={() => navigate("/transactions")}>
              <X size={20} />
              Hủy
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

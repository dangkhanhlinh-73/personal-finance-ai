import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, FileText, X } from "lucide-react";
import api from "../services/api";

function Transactions() {
  const [transactions, setTransactions] = useState([]);

  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formMode, setFormMode] = useState("manual");

  const emptyForm = {
    account_id: "",
    category_id: "",
    amount: "",
    transaction_type: "expense",
    transaction_date: "",
    description: "",
    merchant_name: "",
    source_type: "manual",
    status: "confirmed",
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = () => {
    api
      .get("/transactions/")
      .then((res) => setTransactions(res.data))
      .catch((err) => console.error("Lỗi lấy giao dịch:", err));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTodayInputDate = () => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleString("vi-VN");
  };

  const formatDateForInput = (date) => {
    if (!date) return "";
    return date.slice(0, 16);
  };

  const getCategoryLabel = (categoryId, type) => {
    if (type === "income") return "Thu nhập";

    const map = {
      3: "Ăn uống",
      4: "Mua sắm",
      5: "Giải trí",
      6: "Học tập",
    };

    return map[categoryId] || "Khác";
  };

  const getAccountLabel = (accountId) => {
    const map = {
      1: "Vietcombank",
      2: "Techcombank",
      3: "Ví MoMo",
      4: "Tiền mặt",
    };

    return map[accountId] || `Tài khoản #${accountId}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });
  };

  const handleTypeChange = (e) => {
    const value = e.target.value;

    setForm({
      ...form,
      transaction_type: value,
      category_id: value === "income" ? "1" : "",
    });
  };

  const openAddForm = () => {
    setEditId(null);
    setForm({
      ...emptyForm,
      transaction_date: getTodayInputDate(),
    });
    setFormMode("manual");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditForm = (item) => {
    setEditId(item.transaction_id);

    setForm({
      account_id: item.account_id || "",
      category_id: item.category_id || "",
      amount: item.amount || "",
      transaction_type: item.transaction_type || "expense",
      transaction_date: formatDateForInput(item.transaction_date),
      description: item.description || "",
      merchant_name: item.merchant_name || "",
      source_type: item.source_type || "manual",
      status: item.status || "confirmed",
    });

    setFormMode("manual");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      user_id: 1,
      account_id: Number(form.account_id),
      category_id: form.category_id ? Number(form.category_id) : null,
      amount: Number(form.amount),
      transaction_type: form.transaction_type,
      transaction_date: form.transaction_date,
      description: form.description,
      merchant_name: form.merchant_name,
      source_type: formMode === "scan" ? "image" : "manual",
      status: form.status,
    };

    if (editId) {
      await api.put(`/transactions/${editId}`, payload);
    } else {
      await api.post("/transactions/", payload);
    }

    closeForm();
    loadData();
  };

  const handleDelete = async (transactionId) => {
    if (!window.confirm("Bạn có chắc muốn xóa giao dịch này không?")) return;
    await api.delete(`/transactions/${transactionId}`);
    loadData();
  };

  const filteredTransactions = transactions.filter((item) => {
    const text = `${item.description || ""} ${
      item.merchant_name || ""
    }`.toLowerCase();

    const matchKeyword = text.includes(keyword.toLowerCase());

    const matchType =
      typeFilter === "all" || item.transaction_type === typeFilter;

    const categoryName = getCategoryLabel(
      item.category_id,
      item.transaction_type
    );

    const matchCategory =
      categoryFilter === "all" || categoryName === categoryFilter;

    return matchKeyword && matchType && matchCategory;
  });

  const totalIncome = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  if (showForm) {
    return (
      <div className="transaction-form-page">
        <button type="button" className="back-btn" onClick={closeForm}>
          <ArrowLeft size={20} />
          Quay lại
        </button>

        <div className="transaction-form-header">
          <h1>{editId ? "Sửa giao dịch" : "Thêm giao dịch mới"}</h1>
          <p>Nhập thủ công hoặc quét hóa đơn để thêm giao dịch</p>
        </div>

        <div className="transaction-tabs">
          <button
            type="button"
            className={formMode === "manual" ? "active" : ""}
            onClick={() => setFormMode("manual")}
          >
            <FileText size={18} />
            Nhập thủ công
          </button>

          <button
            type="button"
            className={formMode === "scan" ? "active" : ""}
            onClick={() => setFormMode("scan")}
          >
            <Camera size={18} />
            Quét hóa đơn
          </button>
        </div>

        <form className="transaction-create-card" onSubmit={handleSubmit}>
          <h3>Thông tin giao dịch</h3>

          {formMode === "scan" && (
            <div className="scan-placeholder">
              <Camera size={36} />
              <b>Chức năng quét hóa đơn</b>
              <p>Phần OCR sẽ được tích hợp ở bước sau theo đề cương.</p>
            </div>
          )}

          <div className="transaction-form-grid">
            <div className="form-control">
              <label>Loại giao dịch</label>
              <select
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleTypeChange}
              >
                <option value="expense">Chi tiêu</option>
                <option value="income">Thu nhập</option>
              </select>
            </div>

            <div className="form-control">
              <label>Số tiền (VNĐ)</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>

            <div className="form-control">
              <label>Ngày giao dịch</label>
              <input
                type="datetime-local"
                name="transaction_date"
                value={form.transaction_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-control">
              <label>Danh mục</label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                disabled={form.transaction_type === "income"}
              >
                <option value="">Chọn danh mục</option>
                <option value="3">Ăn uống</option>
                <option value="4">Mua sắm</option>
                <option value="5">Giải trí</option>
                <option value="6">Học tập</option>
              </select>
            </div>

            <div className="form-control full">
              <label>Tài khoản</label>
              <select
                name="account_id"
                value={form.account_id}
                onChange={handleChange}
                required
              >
                <option value="">Chọn tài khoản</option>
                <option value="1">Vietcombank</option>
                <option value="2">Techcombank</option>
                <option value="3">Ví MoMo</option>
                <option value="4">Tiền mặt</option>
              </select>
            </div>

            <div className="form-control full">
              <label>Mô tả</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Nhập mô tả giao dịch..."
              />
            </div>

            <div className="form-control full">
              <label>Cửa hàng / đơn vị</label>
              <input
                name="merchant_name"
                value={form.merchant_name}
                onChange={handleChange}
                placeholder="Ví dụ: Highlands, CoopMart..."
              />
            </div>
          </div>

          <div className="transaction-form-actions">
            <button type="submit" className="save-transaction-btn">
              <Check size={20} />
              {editId ? "Cập nhật giao dịch" : "Lưu giao dịch"}
            </button>

            <button
              type="button"
              className="cancel-transaction-btn"
              onClick={closeForm}
            >
              <X size={20} />
              Hủy
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Quản lý giao dịch</h1>
          <p>Theo dõi và quản lý tất cả các giao dịch tài chính</p>
        </div>

        <div className="actions">
          <button type="button" onClick={openAddForm}>
            + Thêm giao dịch
          </button>
        </div>
      </div>

      <section className="stats">
        <div className="stat-card">
          <p>Tổng giao dịch</p>
          <h2>{transactions.length}</h2>
          <span>Tháng này</span>
        </div>

        <div className="stat-card">
          <p>Tổng thu nhập</p>
          <h2 className="green">+{formatMoney(totalIncome)}</h2>
        </div>

        <div className="stat-card">
          <p>Tổng chi tiêu</p>
          <h2 className="red">-{formatMoney(totalExpense)}</h2>
        </div>
      </section>

      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            placeholder="Tìm kiếm giao dịch..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="income">Thu nhập</option>
            <option value="expense">Chi tiêu</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="Thu nhập">Thu nhập</option>
            <option value="Ăn uống">Ăn uống</option>
            <option value="Mua sắm">Mua sắm</option>
            <option value="Giải trí">Giải trí</option>
            <option value="Học tập">Học tập</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Danh sách giao dịch ({filteredTransactions.length})</h3>

        {filteredTransactions.map((item) => {
          const isIncome = item.transaction_type === "income";

          return (
            <div className="transaction-item" key={item.transaction_id}>
              <div>
                <strong>
                  {item.description || item.merchant_name || "Giao dịch"}
                </strong>

                <p>
                  {formatDate(item.transaction_date)} •{" "}
                  {getCategoryLabel(item.category_id, item.transaction_type)}
                  {" • "}
                  {getAccountLabel(item.account_id)}
                </p>
              </div>

              <div
                className={isIncome ? "green" : "red"}
                style={{ fontWeight: "bold" }}
              >
                {isIncome ? "+" : "-"}
                {formatMoney(item.amount)}
              </div>

              <div className="transaction-actions">
                <button type="button" onClick={() => openEditForm(item)}>
                  Sửa
                </button>

                <button
                  type="button"
                  className="delete-debt-btn"
                  onClick={() => handleDelete(item.transaction_id)}
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default Transactions;
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  MoreVertical,
} from "lucide-react";
import api from "../services/api";

function Debts() {
  const [data, setData] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const emptyForm = {
    account_id: 1,
    debt_type: "borrowed",
    partner_name: "",
    total_amount: "",
    remaining_amount: "",
    interest_rate: 0,
    start_date: "",
    due_date: "",
    status: "ongoing",
    note: "",
  };

  const [form, setForm] = useState(emptyForm);

  const loadDebts = () => {
    api
      .get("/debts/")
      .then((res) => setData(res.data))
      .catch((err) => console.error("Lỗi lấy dữ liệu vay nợ:", err));
  };

  useEffect(() => {
    loadDebts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const openAddForm = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = (item) => {
    setEditId(item.debt_id);
    setForm({
      account_id: item.account_id || 1,
      debt_type: item.debt_type || "borrowed",
      partner_name: item.partner_name || "",
      total_amount: item.total_amount || "",
      remaining_amount: item.remaining_amount || "",
      interest_rate: item.interest_rate || 0,
      start_date: item.start_date || "",
      due_date: item.due_date || "",
      status: item.status || "ongoing",
      note: item.note || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      user_id: 1,
      account_id: Number(form.account_id),
      total_amount: Number(form.total_amount),
      remaining_amount: Number(form.remaining_amount),
      interest_rate: Number(form.interest_rate || 0),
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };

    if (editId) {
      await api.put(`/debts/${editId}`, payload);
    } else {
      await api.post("/debts/", payload);
    }

    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    loadDebts();
  };

  const handleDelete = async (debtId) => {
    if (!window.confirm("Bạn có chắc muốn xóa khoản nợ này không?")) return;
    await api.delete(`/debts/${debtId}`);
    loadDebts();
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const formatDate = (date) => {
    if (!date) return "-";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };

  const totalLent = data
    .filter((item) => item.debt_type === "lent")
    .reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0);

  const totalBorrowed = data
    .filter((item) => item.debt_type === "borrowed")
    .reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0);

  const netDebt = totalLent - totalBorrowed;
  const overdueCount = data.filter((item) => item.status === "overdue").length;

  const getProgress = (item) => {
    const total = Number(item.total_amount || 0);
    const remaining = Number(item.remaining_amount || 0);
    if (total <= 0) return 0;
    return Math.round(((total - remaining) / total) * 100);
  };

  const getStatusLabel = (status) => {
    if (status === "paid") return "Hoàn thành";
    if (status === "overdue") return "Quá hạn";
    return "Đang thực hiện";
  };

  const getStatusIcon = (status) => {
    if (status === "paid") return <CheckCircle size={14} />;
    if (status === "overdue") return <AlertCircle size={14} />;
    return <Clock size={14} />;
  };

  const getStatusDescription = (status) => {
    if (status === "paid") return "Đã thanh toán đủ";
    if (status === "overdue") return "Khoản này đã quá hạn";
    return "Đang trong quá trình thanh toán";
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Quản lý vay nợ</h1>
          <p>Theo dõi các khoản cho vay và đi vay</p>
        </div>

        <div className="actions">
          <button type="button" onClick={openAddForm}>
            <Plus size={20} /> Thêm khoản nợ
          </button>
        </div>
      </div>

      {showForm && (
        <form className="debt-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Sửa khoản vay/nợ" : "Thêm khoản vay/nợ"}</h3>

          <div className="form-grid">
            <div>
              <label>Loại khoản</label>
              <select name="debt_type" value={form.debt_type} onChange={handleChange}>
                <option value="borrowed">Đi vay</option>
                <option value="lent">Cho vay</option>
              </select>
            </div>

            <div>
              <label>Người liên quan</label>
              <input
                name="partner_name"
                value={form.partner_name}
                onChange={handleChange}
                placeholder="Nhập tên người liên quan"
                required
              />
            </div>

            <div>
              <label>Tổng số tiền</label>
              <input
                type="number"
                name="total_amount"
                value={form.total_amount}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label>Số tiền còn lại</label>
              <input
                type="number"
                name="remaining_amount"
                value={form.remaining_amount}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label>Lãi suất (%)</label>
              <input
                type="number"
                name="interest_rate"
                value={form.interest_rate}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Tài khoản ID</label>
              <input
                type="number"
                name="account_id"
                value={form.account_id}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label>Trạng thái</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="ongoing">Đang thực hiện</option>
                <option value="paid">Hoàn thành</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>

            <div>
              <label>Ngày bắt đầu</label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>Ngày đến hạn</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label>Ghi chú</label>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Nhập ghi chú"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              Hủy
            </button>

            <button type="submit">
              {editId ? "Cập nhật khoản nợ" : "Lưu khoản nợ"}
            </button>
          </div>
        </form>
      )}

      <section className="debt-stats">
        <div className="debt-stat-card">
          <p>Tổng cho vay</p>
          <h2 className="green">{formatMoney(totalLent)}</h2>
          <span>↗ Người khác nợ tôi</span>
        </div>

        <div className="debt-stat-card">
          <p>Tổng đi vay</p>
          <h2 className="red">{formatMoney(totalBorrowed)}</h2>
          <span>↘ Tôi nợ người khác</span>
        </div>

        <div className="debt-stat-card">
          <p>Nợ ròng</p>
          <h2 className={netDebt >= 0 ? "green" : "red"}>
            {formatMoney(netDebt)}
          </h2>
          <span>{netDebt >= 0 ? "Dương" : "Âm"}</span>
        </div>

        <div className="debt-stat-card">
          <p>Trạng thái</p>
          <h2>
            {data.length - overdueCount}/{data.length}
          </h2>
          <span className="red">{overdueCount} quá hạn</span>
        </div>
      </section>

      <section className="debt-grid">
        {data.map((item) => {
          const isBorrowed = item.debt_type === "borrowed";
          const progress = getProgress(item);

          return (
            <div className="debt-card" key={item.debt_id}>
              <div className="debt-card-top">
                <div className={`debt-icon ${isBorrowed ? "borrowed" : "lent"}`}>
                  {isBorrowed ? <ArrowDownRight size={28} /> : <ArrowUpRight size={28} />}
                </div>

                <div className="debt-title">
                  <h3>{isBorrowed ? "Đi vay" : "Cho vay"}</h3>

                  <span className={`debt-status ${item.status}`}>
                    {getStatusIcon(item.status)}
                    {getStatusLabel(item.status)}
                  </span>

                  <p>
                    <User size={17} /> {item.partner_name}
                  </p>
                </div>

                <MoreVertical size={22} />
              </div>

              <div className="debt-money-row">
                <div>
                  <p>Tổng số tiền</p>
                  <strong>{formatMoney(item.total_amount)}</strong>
                </div>

                <div>
                  <p>Còn lại</p>
                  <strong className={isBorrowed ? "red" : "green"}>
                    {formatMoney(item.remaining_amount)}
                  </strong>
                </div>
              </div>

              <div className="progress-info">
                <span>Tiến độ thanh toán</span>
                <b>{progress}%</b>
              </div>

              <div className="progress-bar">
                <div style={{ width: `${progress}%` }}></div>
              </div>

              <div className="debt-dates">
                <p>
                  <span>Ngày bắt đầu:</span>
                  <b>{formatDate(item.start_date)}</b>
                </p>

                <p>
                  <span>Ngày đến hạn:</span>
                  <b>{formatDate(item.due_date)}</b>
                </p>
              </div>

              <em>{item.note}</em>

              <p className="debt-note-status">
                {getStatusDescription(item.status)}
              </p>

              <div className="debt-card-actions">
                <button type="button" className="edit-btn" onClick={() => handleEdit(item)}>
                  Sửa
                </button>

                <button
                  type="button"
                  className="delete-debt-btn"
                  onClick={() => handleDelete(item.debt_id)}
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="debt-summary">
        <div className="summary-box">
          <h3>Khoản cho vay</h3>

          {data
            .filter((item) => item.debt_type === "lent")
            .map((item) => (
              <div className="summary-item" key={item.debt_id}>
                <div>
                  <b>{item.partner_name}</b>
                  <p>{formatDate(item.due_date)}</p>
                </div>

                <div>
                  <strong className="green">
                    {formatMoney(item.remaining_amount)}
                  </strong>
                  <span className={`debt-status ${item.status}`}>
                    {getStatusIcon(item.status)}
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        <div className="summary-box">
          <h3>Khoản đi vay</h3>

          {data
            .filter((item) => item.debt_type === "borrowed")
            .map((item) => (
              <div className="summary-item" key={item.debt_id}>
                <div>
                  <b>{item.partner_name}</b>
                  <p>{formatDate(item.due_date)}</p>
                </div>

                <div>
                  <strong className="red">
                    {formatMoney(item.remaining_amount)}
                  </strong>
                  <span className={`debt-status ${item.status}`}>
                    {getStatusIcon(item.status)}
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}

export default Debts;
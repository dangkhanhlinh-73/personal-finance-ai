import { useEffect, useState } from "react";
import api from "../services/api";

function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [overview, setOverview] = useState({
    total_income: 0,
    total_expense: 0,
    saving: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const accRes = await api.get("/accounts/");
    const tranRes = await api.get("/transactions/");
    const reportRes = await api.get("/reports/overview/1");

    setAccounts(accRes.data);
    setTransactions(tranRes.data);
    setOverview(reportRes.data);
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  const totalBalance = accounts.reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tổng quan tài chính</h1>
          <p>Chào mừng bạn trở lại! Đây là tình hình tài chính của bạn.</p>
        </div>

        <div className="actions">
          <button>+ Thêm giao dịch</button>
          <button className="outline">Quét hóa đơn</button>
        </div>
      </div>

      <section className="stats">
        <div className="stat-card primary">
          <p>Tổng số dư</p>
          <h2>{formatMoney(totalBalance)}</h2>
          <span>{accounts.length} tài khoản</span>
        </div>

        <div className="stat-card">
          <p>Thu nhập</p>
          <h2 className="green">+{formatMoney(overview.total_income)}</h2>
        </div>

        <div className="stat-card">
          <p>Chi tiêu</p>
          <h2 className="red">-{formatMoney(overview.total_expense)}</h2>
        </div>

        <div className="stat-card">
          <p>Tiết kiệm</p>
          <h2 className="blue">{formatMoney(overview.saving)}</h2>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <h3>Tài khoản</h3>

          {accounts.map((acc) => (
            <div className="account-item" key={acc.account_id}>
              <div>
                <b>{acc.account_name}</b>
                <p>{acc.account_type}</p>
              </div>
              <strong>{formatMoney(acc.balance)}</strong>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>Giao dịch gần đây</h3>

          {transactions.slice(0, 5).map((t) => (
            <div className="transaction-item" key={t.transaction_id}>
              <div>
                <b>{t.description || t.merchant_name || "Giao dịch"}</b>
                <p>{t.transaction_date}</p>
              </div>

              <strong className={t.transaction_type === "income" ? "green" : "red"}>
                {t.transaction_type === "income" ? "+" : "-"}
                {formatMoney(t.amount)}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default Dashboard;
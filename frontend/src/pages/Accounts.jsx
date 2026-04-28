import { useEffect, useState } from "react";
import api from "../services/api";

function Accounts() {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api.get("/accounts/").then((res) => setAccounts(res.data));
  }, []);

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("vi-VN") + " đ";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tài khoản tài chính</h1>
          <p>Quản lý tiền mặt, ngân hàng và ví điện tử.</p>
        </div>

        <div className="actions">
          <button>+ Thêm tài khoản</button>
        </div>
      </div>

      <section className="card-grid">
        {accounts.map((acc) => (
          <div className="finance-card" key={acc.account_id}>
            <p>{acc.account_type}</p>
            <h2>{acc.account_name}</h2>
            <strong>{formatMoney(acc.balance)}</strong>
            <span>{acc.currency}</span>
          </div>
        ))}
      </section>
    </>
  );
}

export default Accounts;
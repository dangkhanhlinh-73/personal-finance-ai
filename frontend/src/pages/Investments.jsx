import { useEffect, useState } from "react";
import api from "../services/api";

function Investments() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get("/investments/").then((res) => setData(res.data));
  }, []);

  const formatMoney = (v) =>
    Number(v || 0).toLocaleString("vi-VN") + " đ";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Quản lý đầu tư</h1>
          <p>Theo dõi các khoản đầu tư của bạn.</p>
        </div>
      </div>

      <section className="card-grid">
        {data.map((item) => (
          <div className="finance-card" key={item.investment_id}>
            <p>ID: {item.investment_type_id}</p>
            <h2>{item.investment_name}</h2>

            <strong>{formatMoney(item.invested_amount)}</strong>

            <p>Giá trị hiện tại: {formatMoney(item.current_value)}</p>
          </div>
        ))}
      </section>
    </>
  );
}

export default Investments;
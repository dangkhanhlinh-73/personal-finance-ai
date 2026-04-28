import { NavLink } from "react-router-dom";
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  CreditCard,
  TrendingUp,
  Landmark,
  BarChart3,
  LogOut,
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">
          <Wallet size={28} />
        </div>
        <div>
          <h2>SmartFinance</h2>
          <p>Quản lý tài chính</p>
        </div>
      </div>

      <nav>
        <NavLink to="/">
          <LayoutDashboard size={22} /> Tổng quan
        </NavLink>

        <NavLink to="/transactions">
          <Receipt size={22} /> Giao dịch
        </NavLink>

        <NavLink to="/accounts">
          <CreditCard size={22} /> Tài khoản
        </NavLink>

        <NavLink to="/investments">
          <TrendingUp size={22} /> Đầu tư
        </NavLink>

        <NavLink to="/debts">
          <Landmark size={22} /> Vay nợ
        </NavLink>

        <NavLink to="/reports">
          <BarChart3 size={22} /> Báo cáo
        </NavLink>
      </nav>

      <div className="user-box">
        <div className="avatar">NV</div>
        <div>
          <b>Nguyễn Văn A</b>
          <p>user@email.com</p>
        </div>
      </div>

      <button className="logout">
        <LogOut size={20} /> Đăng xuất
      </button>
    </aside>
  );
}

export default Sidebar;
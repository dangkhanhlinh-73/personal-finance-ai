import { useNavigate } from "react-router-dom";
import {
  Wallet,
  LayoutDashboard,
  ReceiptText,
  CreditCard,
  ArrowLeftRight,
  TrendingUp,
  HandCoins,
  Tags,
  ScanLine,
  LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "./Sidebar.css";

export default function Sidebar({ activePage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const items = [
    { id: "home", icon: <LayoutDashboard />, text: "Tổng quan", path: "/home" },
    { id: "transactions", icon: <ReceiptText />, text: "Giao dịch", path: "/transactions" },
    { id: "accounts", icon: <CreditCard />, text: "Tài khoản", path: "/accounts" },
    { id: "transfers", icon: <ArrowLeftRight />, text: "Chuyển tiền", path: "/transfers" },
    { id: "investments", icon: <TrendingUp />, text: "Đầu tư", path: "/investments" },
    { id: "debts", icon: <HandCoins />, text: "Vay nợ", path: "/debts" },
    { id: "categories", icon: <Tags />, text: "Danh mục", path: "/categories" },
    { id: "scan", icon: <ScanLine />, text: "Quét hóa đơn", path: "/scan" },
  ];

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-logo">
          <div className="sidebar-icon"><Wallet /></div>
          <div>
            <h2>SmartFinance</h2>
            <p>Quản lý tài chính</p>
          </div>
        </div>
        <nav className="sidebar-menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`menu-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.text}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="sidebar-user">
        <button
          type="button"
          className={`user-info user-info-btn ${activePage === "profile" ? "active" : ""}`}
          onClick={() => navigate("/profile")}
          title="Chỉnh sửa thông tin"
        >
          <div className="avatar">{user?.full_name?.charAt(0)?.toUpperCase() || "U"}</div>
          <div className="user-text">
            <b>{user?.full_name || "Người dùng"}</b>
            <p>{user?.email || ""}</p>
          </div>
        </button>
        <button className="logout-btn" type="button" onClick={handleLogout}>
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

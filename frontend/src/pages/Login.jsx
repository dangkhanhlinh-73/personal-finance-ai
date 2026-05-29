import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Wallet } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }

    if (!password.trim()) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate("/home");
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="logo-box">
          <Wallet size={42} />
        </div>

        <h1>SmartFinance AI</h1>
        <p>Quản lý tài chính cá nhân thông minh</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Đăng nhập</h2>
        <p className="auth-subtitle">
          Nhập thông tin để truy cập vào tài khoản của bạn
        </p>

        {error && <div className="auth-error">{error}</div>}

        <label>Email</label>
        <div className="input-box">
          <Mail size={20} />
          <input
            type="email"
            placeholder="Nhập email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <label>Mật khẩu</label>
        <div className="input-box">
          <Lock size={20} />
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="auth-row">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>

          <a href="#">Quên mật khẩu?</a>
        </div>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="divider">
          <span></span>
          <p>HOẶC</p>
          <span></span>
        </div>

        <Link className="outline-btn" to="/register">
          Tạo tài khoản mới
        </Link>
      </form>

      <div className="auth-features">
        <div>
          <b>AI</b>
          <span>Phân loại tự động</span>
        </div>

        <div>
          <b>OCR</b>
          <span>Quét hóa đơn</span>
        </div>

        <div>
          <b>Báo cáo</b>
          <span>Thống kê chi tiết</span>
        </div>
      </div>
    </div>
  );
}
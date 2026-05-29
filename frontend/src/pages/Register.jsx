import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Phone, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.full_name.trim()) {
      setError("Vui lòng nhập họ và tên");
      return;
    }

    if (!formData.email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }

    if (!formData.username.trim()) {
      setError("Vui lòng nhập tên đăng nhập");
      return;
    }

    if (!formData.password.trim()) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }

    if (formData.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setLoading(true);

      await register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        username: formData.username.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
      });

      navigate("/home");
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-logo compact">
        <h1>SmartFinance AI</h1>
        <p>Tạo tài khoản mới</p>
      </div>

      <form className="auth-card register-card" onSubmit={handleSubmit}>
        <h2>Đăng ký</h2>
        <p className="auth-subtitle">Điền thông tin để tạo tài khoản mới</p>

        {error && <div className="auth-error">{error}</div>}

        <label>Họ và tên</label>
        <div className="input-box">
          <User size={20} />
          <input
            name="full_name"
            placeholder="Nhập họ và tên"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>

        <label>Email</label>
        <div className="input-box">
          <Mail size={20} />
          <input
            name="email"
            type="email"
            placeholder="Nhập email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <label>Tên đăng nhập</label>
        <div className="input-box">
          <User size={20} />
          <input
            name="username"
            placeholder="Nhập tên đăng nhập"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        <label>Số điện thoại</label>
        <div className="input-box">
          <Phone size={20} />
          <input
            name="phone"
            placeholder="Nhập số điện thoại"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <label>Mật khẩu</label>
        <div className="input-box">
          <Lock size={20} />
          <input
            name="password"
            type="password"
            placeholder="Nhập mật khẩu"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <label>Xác nhận mật khẩu</label>
        <div className="input-box">
          <Lock size={20} />
          <input
            name="confirm_password"
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={formData.confirm_password}
            onChange={handleChange}
            required
          />
        </div>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Đang đăng ký..." : "Đăng ký"}
        </button>

        <p className="switch-auth">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </form>
    </div>
  );
}
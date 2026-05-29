import { useEffect, useState } from "react";
import { Check, X, KeyRound, User, Phone, Mail, AtSign, ShieldCheck, Calendar } from "lucide-react";
import api from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import "./Profile.css";

const getErr = (err) => {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((i) => i.msg).join(", ");
  return "Có lỗi xảy ra";
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("info");

  // ── Info form ────────────────────────────────────────────────────────────
  const [info, setInfo] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
  });
  const [infoError, setInfoError]   = useState("");
  const [infoSuccess, setInfoSuccess] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);

  // ── Password form ────────────────────────────────────────────────────────
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_new_password: "" });
  const [pwError, setPwError]     = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving]   = useState(false);
  const [showPw, setShowPw]       = useState({ cur: false, nw: false, cf: false });

  // ── Load profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setInfo({
          full_name: res.data.full_name || "",
          username:  res.data.username  || "",
          email:     res.data.email     || "",
          phone:     res.data.phone     || "",
        });
      } catch {
        // fallback to context
        setInfo({
          full_name: user?.full_name || "",
          username:  user?.username  || "",
          email:     user?.email     || "",
          phone:     user?.phone     || "",
        });
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setInfoError(""); setInfoSuccess("");
    setInfoSaving(true);
    try {
      const res = await api.put("/auth/me", info);
      updateUser(res.data);
      setInfoSuccess("Cập nhật thông tin thành công!");
    } catch (err) {
      setInfoError(getErr(err));
    } finally {
      setInfoSaving(false);
    }
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    setPwError(""); setPwSuccess("");
    setPwSaving(true);
    try {
      await api.put("/auth/me/password", pw);
      setPwSuccess("Đổi mật khẩu thành công!");
      setPw({ current_password: "", new_password: "", confirm_new_password: "" });
    } catch (err) {
      setPwError(getErr(err));
    } finally {
      setPwSaving(false);
    }
  };

  const initials = (user?.full_name || info.full_name || "U")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="profile-layout">
      <Sidebar activePage="profile" />

      <main className="profile-main">
        {/* Header card */}
        <div className="profile-header-card">
          <div className="profile-avatar-lg">{initials}</div>
          <div className="profile-header-info">
            <h1>{info.full_name || "—"}</h1>
            <p className="profile-username">@{info.username}</p>
            <div className="profile-header-meta">
              <span><Mail size={14} /> {info.email}</span>
              {info.phone && <span><Phone size={14} /> {info.phone}</span>}
              {createdAt && <span><Calendar size={14} /> Tham gia {createdAt}</span>}
              <span className="role-badge"><ShieldCheck size={13} /> {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            <User size={16} /> Thông tin cá nhân
          </button>
          <button
            className={`profile-tab ${activeTab === "password" ? "active" : ""}`}
            onClick={() => setActiveTab("password")}
          >
            <KeyRound size={16} /> Đổi mật khẩu
          </button>
        </div>

        {/* Tab: Info */}
        {activeTab === "info" && (
          <div className="profile-card">
            <h2>Chỉnh sửa thông tin</h2>
            <p className="profile-card-sub">Cập nhật họ tên, tên đăng nhập, email và số điện thoại</p>

            {infoError   && <div className="profile-alert error">{infoError}</div>}
            {infoSuccess && <div className="profile-alert success"><Check size={16} /> {infoSuccess}</div>}

            <form onSubmit={handleInfoSubmit} className="profile-form">
              <div className="profile-form-grid">
                <div className="profile-field">
                  <label><User size={15} /> Họ và tên</label>
                  <input
                    value={info.full_name}
                    onChange={(e) => setInfo((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>

                <div className="profile-field">
                  <label><AtSign size={15} /> Tên đăng nhập</label>
                  <input
                    value={info.username}
                    onChange={(e) => setInfo((p) => ({ ...p, username: e.target.value }))}
                    placeholder="username"
                    required
                  />
                </div>

                <div className="profile-field">
                  <label><Mail size={15} /> Email</label>
                  <input
                    type="email"
                    value={info.email}
                    onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div className="profile-field">
                  <label><Phone size={15} /> Số điện thoại</label>
                  <input
                    value={info.phone}
                    onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="0912 345 678 (tùy chọn)"
                  />
                </div>
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="profile-save-btn" disabled={infoSaving}>
                  <Check size={17} /> {infoSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Password */}
        {activeTab === "password" && (
          <div className="profile-card">
            <h2>Đổi mật khẩu</h2>
            <p className="profile-card-sub">Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật</p>

            {pwError   && <div className="profile-alert error">{pwError}</div>}
            {pwSuccess && <div className="profile-alert success"><Check size={16} /> {pwSuccess}</div>}

            <form onSubmit={handlePwSubmit} className="profile-form">
              <div className="profile-form-narrow">
                <PwField
                  label="Mật khẩu hiện tại"
                  value={pw.current_password}
                  show={showPw.cur}
                  onToggle={() => setShowPw((p) => ({ ...p, cur: !p.cur }))}
                  onChange={(v) => setPw((p) => ({ ...p, current_password: v }))}
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <PwField
                  label="Mật khẩu mới"
                  value={pw.new_password}
                  show={showPw.nw}
                  onToggle={() => setShowPw((p) => ({ ...p, nw: !p.nw }))}
                  onChange={(v) => setPw((p) => ({ ...p, new_password: v }))}
                  placeholder="Tối thiểu 6 ký tự"
                />
                <PwField
                  label="Xác nhận mật khẩu mới"
                  value={pw.confirm_new_password}
                  show={showPw.cf}
                  onToggle={() => setShowPw((p) => ({ ...p, cf: !p.cf }))}
                  onChange={(v) => setPw((p) => ({ ...p, confirm_new_password: v }))}
                  placeholder="Nhập lại mật khẩu mới"
                />

                {/* Strength indicator */}
                {pw.new_password && (
                  <PasswordStrength password={pw.new_password} />
                )}

                {/* Match indicator */}
                {pw.confirm_new_password && (
                  <div className={`pw-match ${pw.new_password === pw.confirm_new_password ? "ok" : "bad"}`}>
                    {pw.new_password === pw.confirm_new_password
                      ? <><Check size={14} /> Mật khẩu khớp</>
                      : <><X size={14} /> Mật khẩu chưa khớp</>}
                  </div>
                )}
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="profile-save-btn" disabled={pwSaving}>
                  <KeyRound size={17} /> {pwSaving ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function PwField({ label, value, show, onToggle, onChange, placeholder }) {
  return (
    <div className="profile-field">
      <label><KeyRound size={15} /> {label}</label>
      <div className="pw-input-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
        />
        <button type="button" className="pw-toggle" onClick={onToggle}>
          {show ? "Ẩn" : "Hiện"}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["Rất yếu", "Yếu", "Trung bình", "Khá mạnh", "Mạnh"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#22c55e"];

  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="pw-bar"
            style={{ background: i <= score ? colors[score - 1] : "#e5e7eb" }}
          />
        ))}
      </div>
      <span style={{ color: colors[score - 1] || "#94a3b8" }}>
        {score > 0 ? labels[score - 1] : ""}
      </span>
    </div>
  );
}

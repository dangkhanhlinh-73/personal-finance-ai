import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Plus, ScanLine, TrendingUp, TrendingDown,
  Wallet, PiggyBank, Building2, CreditCard, Banknote,
  ArrowUpRight, ArrowDownRight, AlertCircle,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import "./Home.css";

const fmt = (v) => Number(v || 0).toLocaleString("vi-VN") + " đ";
const fmtShort = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " tỷ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString("vi-VN");
};

const PIE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#7c3aed", "#0891b2", "#c2410c", "#059669", "#db2777",
];

const ACCOUNT_ICON = {
  bank:    <Building2 size={20} />,
  ewallet: <CreditCard size={20} />,
  cash:    <Banknote size={20} />,
};
const ACCOUNT_COLOR = {
  bank:    { bg: "#dbeafe", color: "#2563eb" },
  ewallet: { bg: "#f3e8ff", color: "#7c3aed" },
  cash:    { bg: "#dcfce7", color: "#16a34a" },
};

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div className={`kpi-card ${accent}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "income" ? "Thu nhập" : "Chi tiêu"}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <p style={{ color: d.payload.fill }}>{d.name}</p>
      <p style={{ fontWeight: 700 }}>{fmt(d.value)}</p>
    </div>
  );
};

function EmptyChart({ message }) {
  return (
    <div className="chart-empty">
      <AlertCircle size={28} />
      <p>{message}</p>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/dashboard/summary");
        setData(res.data);
      } catch (e) {
        console.log("Dashboard error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="home-layout">
        <Sidebar activePage="home" />
        <main className="home-main">
          <div className="home-loading">Đang tải dữ liệu...</div>
        </main>
      </div>
    );
  }

  const s = data?.summary || {};
  const trend = data?.monthly_trend || [];
  const expGroups = data?.expense_by_group || [];
  const recentTx = data?.recent_transactions || [];
  const accounts = data?.accounts || [];
  const invSources = data?.investment_sources || [];
  const activeDebts = data?.active_debts || [];

  const saving = s.monthly_saving ?? 0;
  const totalAssets = s.total_balance + s.total_investment_value + s.total_lend_remaining;
  const totalDebt = s.total_borrow_remaining;

  const borrowDebts = activeDebts.filter((d) => d.debt_type === "borrow");
  const lendDebts   = activeDebts.filter((d) => d.debt_type === "lend");

  return (
    <div className="home-layout">
      <Sidebar activePage="home" />

      <main className="home-main">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="home-header">
          <div>
            <h1>Tổng quan tài chính</h1>
            <p>Xin chào, <strong>{user?.full_name || "bạn"}</strong> — {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="home-actions">
            <button className="btn-primary" onClick={() => navigate("/transactions/add")}>
              <Plus size={18} /> Thêm giao dịch
            </button>
            <button className="btn-secondary" onClick={() => navigate("/scan")}>
              <ScanLine size={18} /> Quét hóa đơn
            </button>
          </div>
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="kpi-grid">
          <KpiCard
            label="Tổng số dư"
            value={fmt(s.total_balance)}
            sub={`${accounts.length} tài khoản`}
            accent="blue"
            icon={<Wallet size={22} />}
          />
          <KpiCard
            label="Thu nhập tháng này"
            value={"+" + fmt(s.monthly_income)}
            accent="green"
            icon={<ArrowUpRight size={22} />}
          />
          <KpiCard
            label="Chi tiêu tháng này"
            value={"-" + fmt(s.monthly_expense)}
            accent="red"
            icon={<ArrowDownRight size={22} />}
          />
          <KpiCard
            label="Tiết kiệm tháng này"
            value={(saving >= 0 ? "+" : "") + fmt(saving)}
            accent={saving >= 0 ? "teal" : "orange"}
            icon={<PiggyBank size={22} />}
          />
        </div>

        {/* ── Charts row ───────────────────────────────────────────────────── */}
        <div className="charts-row">
          {/* Bar chart */}
          <div className="chart-card chart-bar">
            <div className="chart-card-header">
              <h3>Thu chi 6 tháng gần nhất</h3>
              <div className="chart-legend-inline">
                <span className="legend-dot green" /> Thu nhập
                <span className="legend-dot red" /> Chi tiêu
              </div>
            </div>
            {trend.every((t) => t.income === 0 && t.expense === 0) ? (
              <EmptyChart message="Chưa có dữ liệu giao dịch" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trend} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tickFormatter={(v) => fmtShort(v)} tick={{ fontSize: 11, fill: "#64748b" }} width={60} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="income" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="expense" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart */}
          <div className="chart-card chart-pie">
            <div className="chart-card-header">
              <h3>Chi tiêu theo nhóm tháng này</h3>
            </div>
            {expGroups.length === 0 ? (
              <EmptyChart message="Chưa có chi tiêu tháng này" />
            ) : (
              <div className="pie-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expGroups}
                      dataKey="amount"
                      nameKey="group_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {expGroups.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {expGroups.map((g, i) => (
                    <div key={i} className="pie-legend-item">
                      <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="pie-legend-name">{g.group_name}</span>
                      <span className="pie-legend-val">{fmt(g.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Assets & Debts row ───────────────────────────────────────────── */}
        <div className="bottom-row">
          {/* Assets */}
          <div className="section-card assets-card">
            <div className="section-card-header">
              <h3>Tài sản</h3>
              <span className="section-total green">{fmt(totalAssets)}</span>
            </div>

            {/* Accounts */}
            <p className="asset-group-label">Tài khoản</p>
            {accounts.length === 0 ? (
              <p className="asset-empty">Chưa có tài khoản</p>
            ) : (
              <div className="asset-list">
                {accounts.map((a) => {
                  const style = ACCOUNT_COLOR[a.account_type] || { bg: "#f3f4f6", color: "#374151" };
                  return (
                    <div key={a.account_id} className="asset-item">
                      <span className="asset-icon" style={{ background: style.bg, color: style.color }}>
                        {ACCOUNT_ICON[a.account_type] || <Wallet size={18} />}
                      </span>
                      <span className="asset-name">{a.account_name}</span>
                      <span className="asset-val">{fmt(a.balance)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Investments */}
            <p className="asset-group-label" style={{ marginTop: 16 }}>Đầu tư</p>
            {invSources.length === 0 ? (
              <p className="asset-empty">Chưa có nguồn đầu tư</p>
            ) : (
              <div className="asset-list">
                {invSources.map((s) => (
                  <div key={s.source_id} className="asset-item">
                    <span className="asset-icon" style={{ background: "#e0f2fe", color: "#0891b2" }}>
                      <TrendingUp size={18} />
                    </span>
                    <span className="asset-name">{s.source_name}</span>
                    <div className="asset-right">
                      <span className="asset-val">{fmt(s.current_balance)}</span>
                      {s.profit !== 0 && (
                        <span className={`asset-profit ${s.profit >= 0 ? "pos" : "neg"}`}>
                          {s.profit >= 0 ? "+" : ""}{fmt(s.profit)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lend */}
            {lendDebts.length > 0 && (
              <>
                <p className="asset-group-label" style={{ marginTop: 16 }}>Đang cho vay</p>
                <div className="asset-list">
                  {lendDebts.map((d) => (
                    <div key={d.debt_id} className="asset-item">
                      <span className="asset-icon" style={{ background: "#fef9c3", color: "#ca8a04" }}>
                        <ArrowUpRight size={18} />
                      </span>
                      <span className="asset-name">{d.partner_name}</span>
                      <span className="asset-val">{fmt(d.remaining_amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Debts */}
          <div className="section-card debts-card">
            <div className="section-card-header">
              <h3>Vay nợ</h3>
              <span className="section-total red">{fmt(totalDebt)}</span>
            </div>

            {s.active_debts_count === 0 ? (
              <div className="no-debt">
                <span>Không có khoản vay nào đang hoạt động</span>
              </div>
            ) : (
              <>
                {borrowDebts.length > 0 && (
                  <>
                    <p className="asset-group-label">Đang đi vay</p>
                    <div className="debt-list">
                      {borrowDebts.map((d) => {
                        const pct = Math.round((1 - d.remaining_amount / d.total_amount) * 100);
                        const overdue = d.due_date && new Date(d.due_date) < new Date();
                        return (
                          <div key={d.debt_id} className="debt-item">
                            <div className="debt-row1">
                              <span className="debt-partner">{d.partner_name}</span>
                              <span className="debt-amount red">{fmt(d.remaining_amount)}</span>
                            </div>
                            <div className="debt-progress-bar">
                              <div className="debt-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="debt-row2">
                              <span>Đã trả {pct}%</span>
                              {d.due_date && (
                                <span className={overdue ? "overdue" : ""}>
                                  {overdue ? "⚠ Quá hạn" : "Hết hạn"}: {new Date(d.due_date).toLocaleDateString("vi-VN")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {lendDebts.length > 0 && (
                  <>
                    <p className="asset-group-label" style={{ marginTop: 16 }}>Đang cho vay</p>
                    <div className="debt-list">
                      {lendDebts.map((d) => {
                        const pct = Math.round((1 - d.remaining_amount / d.total_amount) * 100);
                        return (
                          <div key={d.debt_id} className="debt-item">
                            <div className="debt-row1">
                              <span className="debt-partner">{d.partner_name}</span>
                              <span className="debt-amount green">{fmt(d.remaining_amount)}</span>
                            </div>
                            <div className="debt-progress-bar">
                              <div className="debt-progress-fill green" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="debt-row2">
                              <span>Đã thu {pct}%</span>
                              {d.due_date && (
                                <span>Hết hạn: {new Date(d.due_date).toLocaleDateString("vi-VN")}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Recent transactions ──────────────────────────────────────────── */}
        <div className="recent-card">
          <div className="section-card-header">
            <h3>Giao dịch gần đây</h3>
            <button className="link-btn" onClick={() => navigate("/transactions")}>
              Xem tất cả →
            </button>
          </div>

          {recentTx.length === 0 ? (
            <div className="no-debt">Chưa có giao dịch nào được xác nhận</div>
          ) : (
            <div className="recent-list">
              {recentTx.map((tx) => {
                const isIncome = tx.transaction_type === "income";
                const d = new Date(tx.transaction_date);
                const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={tx.transaction_id} className="recent-item">
                    <div className={`recent-icon ${isIncome ? "income" : "expense"}`}>
                      {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="recent-info">
                      <span className="recent-title">{tx.title}</span>
                      <span className="recent-meta">{tx.category_name} · {tx.group_name}</span>
                    </div>
                    <div className="recent-right">
                      <span className={`recent-amount ${isIncome ? "income" : "expense"}`}>
                        {isIncome ? "+" : "-"}{fmt(tx.amount)}
                      </span>
                      <span className="recent-date">{timeStr} · {dateStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

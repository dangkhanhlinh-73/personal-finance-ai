import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ScanLine, Upload, Building2, FileText, Clock,
  CheckCircle, AlertCircle, Loader, Trash2, Eye,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import "./Scan.css";

const STATUS_LABEL = {
  pending:    { text: "Đang chờ",   color: "#94a3b8", icon: Clock },
  processing: { text: "Đang xử lý", color: "#2563eb", icon: Loader },
  done:       { text: "Hoàn tất",   color: "#16a34a", icon: CheckCircle },
  error:      { text: "Lỗi",        color: "#dc2626", icon: AlertCircle },
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

export default function Scan() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef(null);

  const [scanType, setScanType] = useState("bank_noti");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [toast, setToast] = useState("");

  // Show toast passed from ScanReview on navigate back
  useEffect(() => {
    if (location.state?.toast) {
      showToast(location.state.toast);
      window.history.replaceState({}, "");
    }
  }, []);

  // ── Load jobs ────────────────────────────────────────────────────────────
  const loadJobs = async () => {
    try {
      const res = await api.get("/ocr/jobs");
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    loadJobs().then(setJobs);
  }, []);

  // ── Poll while any job is pending/processing ──────────────────────────────
  useEffect(() => {
    const hasPending = jobs.some((j) => j.status === "pending" || j.status === "processing");
    if (!hasPending) return;

    const prevStatuses = Object.fromEntries(jobs.map((j) => [j.job_id, j.status]));

    const id = setInterval(async () => {
      const fresh = await loadJobs();
      setJobs(fresh);

      // Notify when any job transitions → done
      for (const j of fresh) {
        if (prevStatuses[j.job_id] !== "done" && j.status === "done") {
          showToast("✅ OCR hoàn tất! Nhấn Review để kiểm tra kết quả.");
          prevStatuses[j.job_id] = "done";
        }
      }
    }, 3000);

    return () => clearInterval(id);
  }, [jobs]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("scan_type", scanType);
    try {
      const res = await api.post("/ocr/jobs", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJobs((prev) => [res.data, ...prev]);
      showToast("📤 Đã tải ảnh lên. Đang xử lý OCR...");
    } catch (err) {
      showToast("❌ Upload thất bại: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm("Xóa job này?")) return;
    try {
      await api.delete(`/ocr/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
    } catch (err) {
      alert(err.response?.data?.detail || "Xóa thất bại");
    }
  };

  return (
    <div className="scan-layout">
      <Sidebar activePage="scan" />

      <main className="scan-main">
        {/* Toast */}
        {toast && <div className="scan-toast">{toast}</div>}

        <div className="scan-header">
          <div>
            <h1><ScanLine size={32} /> Quét hóa đơn thông minh</h1>
            <p>Tải ảnh lên để tự động trích xuất giao dịch bằng AI</p>
          </div>
        </div>

        {/* Type selector */}
        <div className="scan-type-row">
          <button
            className={`scan-type-card ${scanType === "bank_noti" ? "active" : ""}`}
            onClick={() => setScanType("bank_noti")}
            type="button"
          >
            <div className="scan-type-icon blue"><Building2 size={26} /></div>
            <div>
              <b>Thông báo ngân hàng</b>
              <p>VCB, MoMo, HSBC, UOB — tạo giao dịch, chuyển tiền hoặc đầu tư</p>
            </div>
          </button>
          <button
            className={`scan-type-card ${scanType === "invoice" ? "active" : ""}`}
            onClick={() => setScanType("invoice")}
            type="button"
          >
            <div className="scan-type-icon green"><FileText size={26} /></div>
            <div>
              <b>Hóa đơn / Biên lai</b>
              <p>Siêu thị, nhà hàng, cửa hàng — tạo giao dịch chi tiêu</p>
            </div>
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`scan-dropzone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {uploading ? (
            <>
              <Loader size={40} className="spin" />
              <p>Đang tải ảnh lên...</p>
            </>
          ) : (
            <>
              <Upload size={40} />
              <p><b>Kéo thả hoặc nhấn để chọn ảnh</b></p>
              <span>PNG, JPG — ảnh chụp màn hình thông báo ngân hàng hoặc hóa đơn</span>
            </>
          )}
        </div>

        {/* Jobs list */}
        {jobs.length > 0 && (
          <section className="scan-jobs-section">
            <h2>Lịch sử quét ({jobs.length})</h2>
            <div className="scan-jobs-list">
              {jobs.map((job) => {
                const st = STATUS_LABEL[job.status] || STATUS_LABEL.pending;
                const Icon = st.icon;
                const txnCount = job.extracted_json?.transactions?.length ?? 0;
                return (
                  <div className="scan-job-card" key={job.job_id}>
                    <div className="scan-job-thumb">
                      {job.status === "done" ? (
                        <img
                          src={`${api.defaults.baseURL}/ocr/jobs/${job.job_id}/image`}
                          alt="preview"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div className="scan-job-thumb-placeholder">
                          {job.scan_type === "invoice" ? <FileText size={24} /> : <Building2 size={24} />}
                        </div>
                      )}
                    </div>

                    <div className="scan-job-info">
                      <div className="scan-job-row">
                        <span className="scan-job-type">
                          {job.scan_type === "bank_noti" ? "Thông báo NH" : "Hóa đơn"}
                        </span>
                        <span className="scan-job-status" style={{ color: st.color }}>
                          <Icon size={14} className={job.status === "processing" ? "spin" : ""} />
                          {st.text}
                        </span>
                      </div>
                      <div className="scan-job-meta">
                        <span>{fmtTime(job.created_at)}</span>
                        {job.status === "done" && (
                          <span style={{ color: "#16a34a" }}>
                            {job.detected_format} · {txnCount} giao dịch
                          </span>
                        )}
                        {job.status === "error" && (
                          <span style={{ color: "#dc2626" }} title={job.error_message}>Xem lỗi</span>
                        )}
                      </div>
                      {job.status === "done" && (
                        <div className="scan-job-save-status">
                          {(job.saved_count ?? 0) > 0 ? (
                            <span className="save-status-badge saved">
                              <CheckCircle size={13} /> Đã lưu ({job.saved_count})
                            </span>
                          ) : (
                            <span className="save-status-badge pending">
                              <Clock size={13} /> Chưa xác nhận
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="scan-job-actions">
                      {job.status === "done" && (
                        <button
                          className="scan-review-btn"
                          onClick={() => navigate(`/scan/review/${job.job_id}`)}
                        >
                          <Eye size={15} /> Xem lại
                        </button>
                      )}
                      <button
                        className="scan-delete-btn"
                        onClick={() => handleDelete(job.job_id)}
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

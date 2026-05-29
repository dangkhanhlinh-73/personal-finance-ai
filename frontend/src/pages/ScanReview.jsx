import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Check, Loader,
  AlertCircle, ReceiptText, ArrowLeftRight, TrendingUp,
  ShoppingCart, List, CheckCircle2,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import "./ScanReview.css";

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseOcrDate(raw) {
  if (!raw) return "";
  const s = raw.trim();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, hh, mm, dd, mo, yyyy] = m;
    return `${yyyy}-${mo.padStart(2,"0")}-${dd.padStart(2,"0")}T${hh.padStart(2,"0")}:${mm}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const [, dd, mo, yyyy, hh, mm] = m;
    return `${yyyy}-${mo.padStart(2,"0")}-${dd.padStart(2,"0")}T${hh.padStart(2,"0")}:${mm}`;
  }
  if (s.length >= 10 && s[4] === "-") return s.slice(0, 16);
  return "";
}

const fmtMoney = (n) =>
  n == null ? "" : Number(n).toLocaleString("vi-VN") + " ₫";

function matchAccount(accounts, txn) {
  if (!accounts.length) return "";
  const norm = (s) => (s || "").replace(/\s/g, "").toLowerCase();
  const source     = norm(txn.source);
  const isOut      = txn.direction === "out";
  const accountNum = norm(isOut ? txn.sender_account    : txn.recipient_account);
  const holderName = norm(isOut ? txn.sender_name       : txn.recipient_name);

  const bySource = source   ? accounts.find((a) => norm(a.account_name).includes(source)) : null;
  if (bySource) return String(bySource.account_id);
  const byNum  = accountNum ? accounts.find((a) => norm(a.account_name).includes(accountNum)) : null;
  if (byNum) return String(byNum.account_id);
  const byName = holderName.length > 3
    ? accounts.find((a) => norm(a.account_name).includes(holderName)) : null;
  if (byName) return String(byName.account_id);
  return "";
}

function findSupermarketCat(categories) {
  const kw = ["siêu thị", "sieu thi", "mua sắm", "mua sam", "tiêu dùng"];
  const found = categories.find((c) => kw.some((k) => c.category_name.toLowerCase().includes(k)));
  return found ? String(found.category_id) : "";
}

function matchAiCategory(categories, aiName) {
  if (!aiName || !categories.length) return null;
  const norm = (s) => (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");
  const target = norm(aiName);
  return (
    categories.find((c) => norm(c.category_name) === target) ||
    categories.find((c) => {
      const n = norm(c.category_name);
      return n.includes(target) || target.includes(n);
    }) ||
    null
  );
}

const TABS_BANK = ["transaction", "transfer", "investment"];
const TABS_INV  = ["transaction"];
const TAB_LABEL = { transaction: "Giao dịch", transfer: "Chuyển tiền", investment: "Đầu tư" };
const TAB_ICON  = { transaction: ReceiptText, transfer: ArrowLeftRight, investment: TrendingUp };

const emptyTx = () => ({ transaction_type:"expense", amount:"", transaction_date:"", category_id:"", account_id:"", description:"", merchant_name:"" });
const emptyTr = () => ({ from_account_id:"", to_account_id:"", amount:"", transfer_date:"", note:"" });
const emptyInv= () => ({ investment_source_id:"", account_id:"", amount:"", direction:"invest", invested_at:"", note:"" });

function buildTxForm(txn, accounts, scanType) {
  const account_id = scanType === "bank_noti" ? matchAccount(accounts, txn) : "";
  return { ...emptyTx(), transaction_type: txn.direction === "in" ? "income" : "expense", amount: txn.amount ? String(txn.amount) : "", transaction_date: parseOcrDate(txn.datetime) || todayIso(), description: txn.description || txn.merchant || "", merchant_name: txn.merchant || "", account_id };
}
function buildTrForm(txn) {
  return { ...emptyTr(), amount: txn.amount ? String(txn.amount) : "", transfer_date: parseOcrDate(txn.datetime) || todayIso(), note: txn.description || "" };
}
function buildInvForm(txn) {
  return { ...emptyInv(), amount: txn.amount ? String(txn.amount) : "", direction: txn.direction === "out" ? "withdraw" : "invest", invested_at: parseOcrDate(txn.datetime) || todayIso(), note: txn.description || "" };
}

const normalizeDateTime = (v) => (!v ? v : v.length === 16 ? `${v}:00` : v);

const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

// ── AI Category Combobox ───────────────────────────────────────────────────────
function AiCategoryField({
  categories, txForm, changeTx,
  aiCatName, aiCatConfidence, aiCatMatchId,
  showQuickCreate, setShowQuickCreate,
  qcName, setQcName, qcGroupId, setQcGroupId,
  qcCreating, groups, onQuickCreate,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showBadge = aiCatName && aiCatConfidence >= 0.4;
  const pct = Math.round(aiCatConfidence * 100);

  const selectedCat = categories.find((c) => String(c.category_id) === String(txForm.category_id));

  const matched = search.trim()
    ? categories.filter((c) => c.category_name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  // Group by group_name
  const grouped = matched.reduce((acc, c) => {
    const key = c.group_name || "Khác";
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const exactMatch = categories.some(
    (c) => c.category_name.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = search.trim() && !exactMatch;

  const selectCat = (catId) => {
    changeTx({ target: { name: "category_id", value: String(catId) } });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="review-field-row" ref={boxRef}>
      <label>
        Danh mục
        {showBadge && (
          <span
            className={`ai-suggest-badge ${String(txForm.category_id) === aiCatMatchId && aiCatMatchId ? "matched" : ""}`}
            title={`AI gợi ý: ${aiCatName}`}
          >
            ✦ AI {pct}%
          </span>
        )}
      </label>

      {/* Trigger */}
      <div className="cat-combobox" onClick={() => { setOpen(true); }}>
        <div className="cat-display">
          {selectedCat
            ? <span>{selectedCat.category_name}</span>
            : <span className="cat-placeholder">Chọn danh mục...</span>
          }
          <span className="cat-arrow">▾</span>
        </div>

        {open && (
          <div className="cat-dropdown" onClick={(e) => e.stopPropagation()}>
            {/* Search input at top */}
            <div className="cat-search-row">
              <input
                autoFocus
                type="text"
                className="cat-search-input"
                placeholder="Tìm hoặc nhập tên mới..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cat-options-scroll">
              {Object.entries(grouped).map(([groupName, cats]) => (
                <div key={groupName}>
                  <div className="cat-group-header">{groupName}</div>
                  {cats.map((c) => (
                    <div
                      key={c.category_id}
                      className={`cat-option ${String(txForm.category_id) === String(c.category_id) ? "active" : ""}`}
                      onMouseDown={() => selectCat(c.category_id)}
                    >
                      {c.category_name}
                    </div>
                  ))}
                </div>
              ))}

              {canCreate && (
                <div
                  className="cat-option cat-create-opt"
                  onMouseDown={() => {
                    setQcName(search.trim());
                    setShowQuickCreate(true);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  + Tạo "{search.trim()}"
                </div>
              )}

              {Object.keys(grouped).length === 0 && !canCreate && (
                <div className="cat-empty-msg">Không tìm thấy</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick-create form */}
      {showQuickCreate && (
        <div className="ai-qc-form">
          <input
            value={qcName}
            onChange={(e) => setQcName(e.target.value)}
            placeholder="Tên danh mục"
            className="ai-qc-input"
          />
          <select
            value={qcGroupId}
            onChange={(e) => setQcGroupId(e.target.value)}
            className="ai-qc-select"
          >
            <option value="">Chọn nhóm</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>{g.group_name} ({g.group_type})</option>
            ))}
          </select>
          <div className="ai-qc-actions">
            <button type="button" className="ai-qc-save-btn" onClick={onQuickCreate}
              disabled={qcCreating || !qcName.trim() || !qcGroupId}>
              {qcCreating ? "Đang tạo..." : "Lưu danh mục"}
            </button>
            <button type="button" className="ai-qc-cancel-btn" onClick={() => setShowQuickCreate(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScanReview() {
  const { jobId } = useParams();
  const navigate  = useNavigate();

  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [txnIndex, setTxnIndex] = useState(0);
  const [tab, setTab]           = useState("transaction");

  const [txForm, setTxForm]   = useState(emptyTx());
  const [trForm, setTrForm]   = useState(emptyTr());
  const [invForm, setInvForm] = useState(emptyInv());

  // Invoice-specific
  const [invoiceMode, setInvoiceMode]       = useState("total");
  const [itemSelections, setItemSelections]   = useState([]);
  const [itemAmounts, setItemAmounts]         = useState([]);
  const [itemCategories, setItemCategories]   = useState([]);
  const [removedItemIndices, setRemovedItemIndices] = useState(new Set());

  const [accounts, setAccounts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources]       = useState([]);

  // Per-transaction saved state: { [txnIndex]: { id, tab, count? } }
  const [savedMap, setSavedMap] = useState({});
  // Saved transaction data from DB keyed by txn_index
  const [savedTransactions, setSavedTransactions] = useState({});

  // AI category suggestion for current transaction
  const [aiCatName, setAiCatName]           = useState("");
  const [aiCatConfidence, setAiCatConfidence] = useState(0);
  const [aiCatMatchId, setAiCatMatchId]     = useState("");

  // Quick-create category dialog
  const [groups, setGroups]               = useState([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [qcName, setQcName]               = useState("");
  const [qcGroupId, setQcGroupId]         = useState("");
  const [qcCreating, setQcCreating]       = useState(false);

  const [saving, setSaving]       = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  const [imgUrl, setImgUrl]     = useState(null);
  const [debugUrl, setDebugUrl] = useState(null);

  const pollRef = useRef(null);

  // ── Options ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/transactions/options").then((r) => {
      setAccounts(r.data.accounts || []);
      setCategories(r.data.categories || []);
    }).catch(() => {});
    api.get("/investments/sources").then((r) => {
      setSources(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
    api.get("/categories/groups").then((r) => {
      setGroups(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, []);

  // Re-fill account when accounts load (bank_noti)
  useEffect(() => {
    if (!job || job.status !== "done" || job.scan_type !== "bank_noti") return;
    if (txForm.account_id) return;
    const txn = (job.extracted_json?.transactions ?? [])[txnIndex] ?? {};
    const account_id = matchAccount(accounts, txn);
    if (account_id) setTxForm((p) => ({ ...p, account_id }));
  }, [accounts, job]);

  // Fill category from AI suggestion (or fallback to supermarket) when categories load
  // Skip if txn was already restored from DB (category_id already set from saved data)
  useEffect(() => {
    if (!job || job.status !== "done" || !categories.length) return;
    const txn = (job.extracted_json?.transactions ?? [])[txnIndex] ?? {};
    const aiName = txn.ai_category || "";
    const aiConf = txn.ai_category_confidence || 0;
    const matchedCat = matchAiCategory(categories, aiName);
    const matchedId  = matchedCat ? String(matchedCat.category_id) : "";
    setAiCatName(aiName);
    setAiCatConfidence(aiConf);
    setAiCatMatchId(matchedId);
    setTxForm((p) => {
      if (p.category_id) return p; // already set (from saved DB data or prior applyJobData)
      if (matchedId && aiConf >= 0.4) return { ...p, category_id: matchedId };
      if (job.scan_type === "invoice") {
        const catId = findSupermarketCat(categories);
        if (catId) return { ...p, category_id: catId };
      }
      return p;
    });
  }, [categories, job]);

  // Fill per-item categories when categories arrive after job data
  useEffect(() => {
    if (!job || job.status !== "done" || !categories.length || job.scan_type !== "invoice") return;
    const txn = (job.extracted_json?.transactions ?? [])[txnIndex] ?? {};
    const items = txn.items ?? [];
    setItemCategories((prev) =>
      items.map((it, i) => {
        if (prev[i]) return prev[i];
        const matched = it.ai_category ? matchAiCategory(categories, it.ai_category) : null;
        return (matched && (it.ai_category_confidence || 0) >= 0.4)
          ? String(matched.category_id) : "";
      })
    );
  }, [categories, job, txnIndex]);

  // ── Load job ──────────────────────────────────────────────────────────────────
  const loadJob = async () => {
    try { return (await api.get(`/ocr/jobs/${jobId}`)).data; }
    catch { return null; }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/ocr/jobs/${jobId}`).catch(() => null),
      api.get(`/ocr/jobs/${jobId}/transactions`).catch(() => ({ data: [] })),
    ]).then(([jobRes, txnsRes]) => {
      const j = jobRes?.data ?? null;
      if (!j) { setError("Không tìm thấy job"); setLoading(false); return; }

      const savedTxns = Array.isArray(txnsRes?.data) ? txnsRes.data : [];
      const dbSavedMap = {};
      const dbSavedTxns = {};
      for (const txn of savedTxns) {
        if (txn.txn_index != null) {
          dbSavedMap[txn.txn_index] = { id: txn.transaction_id, tab: "transaction" };
          dbSavedTxns[txn.txn_index] = txn;
        }
      }

      setSavedMap(dbSavedMap);
      setSavedTransactions(dbSavedTxns);
      setJob(j);
      setLoading(false);
      if (j.status === "done") applyJobData(j, 0, dbSavedTxns);
    });
  }, [jobId]);

  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "processing")) return;
    pollRef.current = setInterval(async () => {
      const fresh = await loadJob();
      if (!fresh) return;
      setJob(fresh);
      if (fresh.status === "done" || fresh.status === "error") {
        clearInterval(pollRef.current);
        if (fresh.status === "done") applyJobData(fresh, 0);
      }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [job?.status]);

  // ── Images ────────────────────────────────────────────────────────────────────
  const fetchBlob = async (endpoint, setter) => {
    try {
      const res = await api.get(endpoint, { responseType: "blob" });
      setter((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(res.data); });
    } catch { setter(null); }
  };
  useEffect(() => { if (jobId) fetchBlob(`/ocr/jobs/${jobId}/image`, setImgUrl); }, [jobId]);
  useEffect(() => { if (job?.status === "done") fetchBlob(`/ocr/jobs/${jobId}/debug`, setDebugUrl); }, [job?.status]);
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); if (debugUrl) URL.revokeObjectURL(debugUrl); }, []);

  // ── Apply data → forms ────────────────────────────────────────────────────────
  // savedTxnsOverride: pass explicitly when state hasn't updated yet (initial load)
  function applyJobData(j, idx, savedTxnsOverride) {
    const resolved = savedTxnsOverride ?? savedTransactions;
    const txns = j.extracted_json?.transactions ?? [];
    const txn  = txns[idx] ?? {};

    // AI category suggestion for this transaction (always from OCR data)
    const aiName = txn.ai_category || "";
    const aiConf = txn.ai_category_confidence || 0;
    setAiCatName(aiName);
    setAiCatConfidence(aiConf);
    setShowQuickCreate(false);

    const matchedCat = aiName && categories.length ? matchAiCategory(categories, aiName) : null;
    const matchedId  = matchedCat ? String(matchedCat.category_id) : "";
    setAiCatMatchId(matchedId);

    const savedTxnData = resolved[idx];

    if (savedTxnData) {
      // Restore what the user actually saved
      const rawDt = savedTxnData.transaction_date || "";
      const dt = rawDt.replace("T", "T").replace(/[+Z].*$/, "").slice(0, 16);
      setTxForm({
        transaction_type: savedTxnData.transaction_type || "expense",
        amount: String(savedTxnData.amount || ""),
        transaction_date: dt,
        category_id: String(savedTxnData.category_id || ""),
        account_id: String(savedTxnData.account_id || ""),
        description: savedTxnData.description || "",
        merchant_name: savedTxnData.merchant_name || "",
      });
    } else {
      // Not yet saved — build from OCR data
      const base = buildTxForm(txn, accounts, j.scan_type);
      if (!base.category_id) {
        if (matchedId && aiConf >= 0.4) {
          base.category_id = matchedId;
        } else if (j.scan_type === "invoice" && categories.length) {
          base.category_id = findSupermarketCat(categories);
        }
      }
      setTxForm(base);
    }

    setTrForm(buildTrForm(txn));
    setInvForm(buildInvForm(txn));
    setRemovedItemIndices(new Set());
    const items = txn.items ?? [];
    setItemSelections(items.map(() => true));
    setItemAmounts(items.map((it) => it.total != null ? String(it.total) : ""));
    setItemCategories(items.map((it) => {
      const matched = it.ai_category && categories.length
        ? matchAiCategory(categories, it.ai_category) : null;
      return (matched && (it.ai_category_confidence || 0) >= 0.4)
        ? String(matched.category_id) : "";
    }));
    setSubmitErr("");
  }

  // Navigate to a transaction index
  const goTo = (idx) => {
    setTxnIndex(idx);
    applyJobData(job, idx);
  };

  const handleTxnNav = (delta) => {
    const txns = job?.extracted_json?.transactions ?? [];
    const next = Math.max(0, Math.min(txns.length - 1, txnIndex + delta));
    goTo(next);
  };

  // ── Form handlers ─────────────────────────────────────────────────────────────
  const changeTx  = (e) => setTxForm((p)  => ({ ...p, [e.target.name]: e.target.value }));
  const changeTr  = (e) => setTrForm((p)  => ({ ...p, [e.target.name]: e.target.value }));
  const changeInv = (e) => setInvForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const toggleItem = (i) => setItemSelections((p) => p.map((v, j) => j === i ? !v : v));
  const changeItemAmount    = (i, val) => setItemAmounts((p)    => p.map((v, j) => j === i ? val : v));
  const changeItemCategory  = (i, val) => setItemCategories((p) => p.map((v, j) => j === i ? val : v));
  const removeItem = (i) => {
    setRemovedItemIndices((prev) => new Set([...prev, i]));
    setItemSelections((p) => p.map((v, j) => j === i ? false : v));
  };

  const handleInvoiceModeChange = (mode) => {
    setInvoiceMode(mode);
    if (mode === "total" && !txForm.category_id) {
      const catId = findSupermarketCat(categories);
      if (catId) setTxForm((p) => ({ ...p, category_id: catId }));
    }
  };

  const handleQuickCreate = async () => {
    if (!qcName.trim() || !qcGroupId) return;
    setQcCreating(true);
    try {
      const res = await api.post("/categories/", {
        category_name: qcName.trim(),
        group_id: Number(qcGroupId),
      });
      const newCat = res.data;
      // Refresh categories list
      const catRes = await api.get("/transactions/options");
      const newCats = catRes.data.categories || [];
      setCategories(newCats);
      // Auto-select the newly created category
      setAiCatMatchId(String(newCat.category_id));
      setTxForm((p) => ({ ...p, category_id: String(newCat.category_id) }));
      setShowQuickCreate(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setSubmitErr(typeof detail === "string" ? detail : "Tạo danh mục thất bại");
    } finally {
      setQcCreating(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const currentSaved = savedMap[txnIndex];
  const isEditMode   = !!currentSaved;
  const isInvoiceItems = job?.scan_type === "invoice" && tab === "transaction" && invoiceMode === "items";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitErr("");
    setSaving(true);
    try {
      let savedEntry = null;

      if (tab === "transaction" && !isInvoiceItems) {
        if (!txForm.account_id)  throw new Error("Vui lòng chọn tài khoản");
        if (!txForm.category_id) throw new Error("Vui lòng chọn danh mục");
        if (!txForm.amount || Number(txForm.amount) <= 0) throw new Error("Số tiền phải lớn hơn 0");
        const payload = {
          account_id: Number(txForm.account_id), category_id: Number(txForm.category_id),
          amount: Number(txForm.amount), transaction_type: txForm.transaction_type,
          transaction_date: normalizeDateTime(txForm.transaction_date),
          description: txForm.description.trim() || null, merchant_name: txForm.merchant_name.trim() || null,
          // OCR provenance & AI classification context
          ocr_job_id: Number(jobId) || null,
          txn_index: txnIndex,
          ai_predicted_category: currentTxn.ai_category || null,
          ai_confidence: currentTxn.ai_category_confidence || null,
        };
        if (isEditMode && currentSaved.id) {
          await api.put(`/transactions/${currentSaved.id}`, payload);
          savedEntry = currentSaved; // keep same id
        } else {
          const res = await api.post("/transactions/", payload);
          savedEntry = { id: res.data.transaction_id, tab };
        }

      } else if (isInvoiceItems) {
        if (!txForm.account_id) throw new Error("Vui lòng chọn tài khoản");
        const batchItems = [];
        for (let i = 0; i < currentItems.length; i++) {
          if (!itemSelections[i]) continue;
          const amt = Number(itemAmounts[i]);
          if (!amt || amt <= 0) continue;
          const catId = itemCategories[i];
          if (!catId) throw new Error(`Chọn danh mục cho "${currentItems[i].name || `Item ${i + 1}`}"`);
          const item = currentItems[i];
          batchItems.push({
            account_id: Number(txForm.account_id),
            category_id: Number(catId),
            amount: amt,
            transaction_type: "expense",
            transaction_date: normalizeDateTime(txForm.transaction_date),
            description: item.name || null,
            merchant_name: txForm.merchant_name.trim() || null,
            ocr_job_id: Number(jobId) || null,
            txn_index: txnIndex,
            ai_predicted_category: item.ai_category || null,
            ai_confidence: item.ai_category_confidence || null,
          });
        }
        if (!batchItems.length) throw new Error("Vui lòng chọn ít nhất 1 item hợp lệ");
        const res = await api.post("/transactions/batch", { items: batchItems });
        savedEntry = { id: null, tab, count: res.data.length };

      } else if (tab === "transfer") {
        if (!trForm.from_account_id) throw new Error("Vui lòng chọn tài khoản nguồn");
        if (!trForm.to_account_id)   throw new Error("Vui lòng chọn tài khoản đích");
        if (!trForm.amount || Number(trForm.amount) <= 0) throw new Error("Số tiền phải lớn hơn 0");
        const payload = {
          from_account_id: Number(trForm.from_account_id), to_account_id: Number(trForm.to_account_id),
          amount: Number(trForm.amount), transfer_date: normalizeDateTime(trForm.transfer_date),
          note: trForm.note.trim() || null,
        };
        if (isEditMode && currentSaved.id) {
          await api.put(`/transfers/${currentSaved.id}`, payload);
          savedEntry = currentSaved;
        } else {
          const res = await api.post("/transfers/", payload);
          savedEntry = { id: res.data.transfer_id, tab };
        }

      } else {
        if (!invForm.investment_source_id) throw new Error("Vui lòng chọn nguồn đầu tư");
        if (!invForm.account_id)           throw new Error("Vui lòng chọn tài khoản");
        if (!invForm.amount || Number(invForm.amount) <= 0) throw new Error("Số tiền phải lớn hơn 0");
        const res = await api.post("/investments/", {
          investment_source_id: Number(invForm.investment_source_id), account_id: Number(invForm.account_id),
          amount: Number(invForm.amount), direction: invForm.direction,
          invested_at: normalizeDateTime(invForm.invested_at), note: invForm.note.trim() || null,
        });
        savedEntry = { id: res.data.investment_id, tab };
      }

      // Mark this index as saved
      const newMap = { ...savedMap, [txnIndex]: savedEntry };
      setSavedMap(newMap);

      // Auto-advance or finish
      const txns = job?.extracted_json?.transactions ?? [];
      const nextUnsaved = txns.findIndex((_, i) => i > txnIndex && !newMap[i]);
      if (nextUnsaved !== -1) {
        setTimeout(() => goTo(nextUnsaved), 400);
      } else {
        const allSaved = txns.every((_, i) => newMap[i] !== undefined);
        if (allSaved) {
          navigate("/scan", { state: { toast: `✅ Đã lưu ${Object.keys(newMap).length} giao dịch` } });
        }
      }

    } catch (err) {
      const detail = err.response?.data?.detail;
      setSubmitErr(
        typeof detail === "string" ? detail :
        Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") :
        err.message || "Lưu thất bại"
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const txns         = job?.extracted_json?.transactions ?? [];
  const hasManyTx    = txns.length > 1;
  const tabs         = job?.scan_type === "bank_noti" ? TABS_BANK : TABS_INV;
  const isInvoice    = job?.scan_type === "invoice";
  const currentTxn   = txns[txnIndex] ?? {};
  const currentItems = currentTxn.items ?? [];
  const hasItems     = currentItems.length > 0;

  const filteredCats = categories.filter((c) =>
    txForm.transaction_type === "income"
      ? c.group_type === "income"
      : ["expense", "debt", "investment"].includes(c.group_type)
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="scan-layout"><Sidebar activePage="scan" />
      <main className="review-main review-loading"><Loader size={36} className="spin" /><span>Đang tải...</span></main>
    </div>
  );
  if (error) return (
    <div className="scan-layout"><Sidebar activePage="scan" />
      <main className="review-main review-loading"><AlertCircle size={36} color="#dc2626" /><span>{error}</span></main>
    </div>
  );

  const isProcessing = job.status === "pending" || job.status === "processing";

  return (
    <div className="scan-layout">
      <Sidebar activePage="scan" />
      <main className="review-main">
        <button className="review-back" type="button" onClick={() => navigate("/scan")}>
          <ArrowLeft size={16} /> Quay lại
        </button>

        <h1 className="review-title">
          Xem xét kết quả OCR
          {job.detected_format && <span className="review-format-badge">{job.detected_format}</span>}
          {Object.keys(savedMap).length > 0 && (
            <span className="review-progress-badge">
              {Object.keys(savedMap).length}/{txns.length} đã lưu
            </span>
          )}
        </h1>

        {isProcessing && (
          <div className="review-processing">
            <Loader size={24} className="spin" />
            <span>Đang xử lý OCR... Vui lòng chờ.</span>
          </div>
        )}
        {job.status === "error" && (
          <div className="review-error-banner">
            <AlertCircle size={18} /> OCR thất bại: {job.error_message}
          </div>
        )}

        {job.status === "done" && (
          <div className="review-body">
            {/* ── Image ── */}
            <div className="review-image-panel">
              {(debugUrl || imgUrl)
                ? <img src={debugUrl || imgUrl} alt="OCR result" className="review-image" />
                : <div className="review-img-loading"><Loader size={28} className="spin" /></div>
              }
            </div>

            {/* ── Form ── */}
            <div className="review-form-panel">
              {/* Transaction navigator with saved indicators */}
              {hasManyTx && (
                <div className="review-txn-nav">
                  <button type="button" onClick={() => handleTxnNav(-1)} disabled={txnIndex === 0}>
                    <ChevronLeft size={16} />
                  </button>
                  <div className="txn-nav-dots">
                    {txns.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`txn-dot ${i === txnIndex ? "active" : ""} ${savedMap[i] ? "saved" : ""}`}
                        onClick={() => goTo(i)}
                        title={savedMap[i] ? "Đã lưu" : `Giao dịch ${i + 1}`}
                      >
                        {savedMap[i] ? <Check size={10} /> : i + 1}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => handleTxnNav(1)} disabled={txnIndex === txns.length - 1}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="review-tabs">
                {tabs.map((t) => {
                  const Icon = TAB_ICON[t];
                  return (
                    <button key={t} type="button"
                      className={`review-tab ${tab === t ? "active" : ""}`}
                      onClick={() => { setTab(t); setSubmitErr(""); }}>
                      <Icon size={15} /> {TAB_LABEL[t]}
                    </button>
                  );
                })}
              </div>

              {/* Saved indicator for current transaction */}
              {isEditMode && (
                <div className="review-saved-banner">
                  <CheckCircle2 size={16} /> Đã lưu — đang ở chế độ chỉnh sửa
                </div>
              )}

              {/* Invoice mode toggle */}
              {isInvoice && tab === "transaction" && (
                <div className="invoice-mode-toggle">
                  <button type="button" className={`invoice-mode-btn ${invoiceMode === "total" ? "active" : ""}`} onClick={() => handleInvoiceModeChange("total")}>
                    <ShoppingCart size={14} /> Tổng bill
                  </button>
                  <button type="button" className={`invoice-mode-btn ${invoiceMode === "items" ? "active" : ""}`} onClick={() => handleInvoiceModeChange("items")} disabled={!hasItems} title={!hasItems ? "Không tìm thấy items" : ""}>
                    <List size={14} /> Từng item {hasItems ? `(${currentItems.length})` : "(0)"}
                  </button>
                </div>
              )}

              {submitErr && <div className="review-submit-err">{submitErr}</div>}

              <form className="review-form" onSubmit={handleSubmit}>

                {/* ── Transaction / total ── */}
                {tab === "transaction" && invoiceMode === "total" && (
                  <>
                    <div className="review-field-row">
                      <label>Loại giao dịch</label>
                      <select name="transaction_type" value={txForm.transaction_type} onChange={changeTx}>
                        <option value="expense">Chi tiêu</option>
                        <option value="income">Thu nhập</option>
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Số tiền (VNĐ) <span className="ocr-hint">{fmtMoney(currentTxn.amount)}</span></label>
                      <input name="amount" type="number" min="1" value={txForm.amount} onChange={changeTx} placeholder="0" />
                    </div>
                    <div className="review-field-row">
                      <label>Ngày giờ giao dịch</label>
                      <input name="transaction_date" type="datetime-local" value={txForm.transaction_date} onChange={changeTx} />
                    </div>
                    <div className="review-field-row">
                      <label>Tài khoản</label>
                      <select name="account_id" value={txForm.account_id} onChange={changeTx}>
                        <option value="">Chọn tài khoản</option>
                        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} ₫</option>)}
                      </select>
                    </div>
                    <AiCategoryField
                      categories={categories} txForm={txForm} changeTx={changeTx}
                      aiCatName={aiCatName} aiCatConfidence={aiCatConfidence} aiCatMatchId={aiCatMatchId}
                      showQuickCreate={showQuickCreate} setShowQuickCreate={setShowQuickCreate}
                      qcName={qcName} setQcName={setQcName}
                      qcGroupId={qcGroupId} setQcGroupId={setQcGroupId}
                      qcCreating={qcCreating} groups={groups}
                      onQuickCreate={handleQuickCreate}
                    />
                    <div className="review-field-row">
                      <label>Người bán / Nơi nhận</label>
                      <input name="merchant_name" type="text" value={txForm.merchant_name} onChange={changeTx} placeholder="Tên cửa hàng..." />
                    </div>
                    <div className="review-field-row">
                      <label>Mô tả</label>
                      <textarea name="description" rows={2} value={txForm.description} onChange={changeTx} placeholder="Nội dung..." />
                    </div>
                  </>
                )}

                {/* ── Invoice items ── */}
                {tab === "transaction" && invoiceMode === "items" && (
                  <>
                    <div className="review-field-row">
                      <label>Ngày giờ giao dịch</label>
                      <input name="transaction_date" type="datetime-local" value={txForm.transaction_date} onChange={changeTx} />
                    </div>
                    <div className="review-field-row">
                      <label>Tài khoản</label>
                      <select name="account_id" value={txForm.account_id} onChange={changeTx}>
                        <option value="">Chọn tài khoản</option>
                        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} ₫</option>)}
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Người bán</label>
                      <input name="merchant_name" type="text" value={txForm.merchant_name} onChange={changeTx} placeholder="Tên cửa hàng..." />
                    </div>

                    <div className="invoice-items-label">
                      Items ({itemSelections.filter(Boolean).length}/{currentItems.length - removedItemIndices.size} đã chọn)
                    </div>
                    <div className="invoice-items-list">
                      {currentItems.map((item, i) => {
                        if (removedItemIndices.has(i)) return null;
                        return (
                          <div key={i} className={`invoice-item-row ${itemSelections[i] ? "selected" : "deselected"}`}>
                            <input type="checkbox" checked={itemSelections[i] ?? true} onChange={() => toggleItem(i)} className="invoice-item-check" />
                            <div className="invoice-item-info">
                              <span className="invoice-item-name">
                                {item.name || `Item ${i + 1}`}
                                {item.qty && <span className="invoice-item-qty">×{item.qty}</span>}
                              </span>
                              <select
                                className={`invoice-item-cat-select ${!itemCategories[i] && itemSelections[i] ? "missing" : ""}`}
                                value={itemCategories[i] ?? ""}
                                onChange={(e) => changeItemCategory(i, e.target.value)}
                                disabled={!itemSelections[i]}
                              >
                                <option value="">— danh mục —</option>
                                {categories.map((c) => (
                                  <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                                ))}
                              </select>
                              {item.ai_category && (
                                <span className="invoice-item-ai-hint" title={`AI: ${item.ai_category}`}>
                                  ✦ {Math.round((item.ai_category_confidence || 0) * 100)}%
                                </span>
                              )}
                            </div>
                            <div className="invoice-item-amount-col">
                              <input type="number" className="invoice-item-amount" value={itemAmounts[i] ?? ""} onChange={(e) => changeItemAmount(i, e.target.value)} min="1" placeholder="0" disabled={!itemSelections[i]} />
                              <span className="invoice-item-currency">₫</span>
                            </div>
                            <button
                              type="button"
                              className="invoice-item-remove"
                              onClick={() => removeItem(i)}
                              title="Xóa item này"
                            >×</button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="invoice-items-total">
                      Tổng chọn: <b>{fmtMoney(itemSelections.reduce((s, sel, i) => s + (!removedItemIndices.has(i) && sel ? Number(itemAmounts[i] || 0) : 0), 0))}</b>
                    </div>
                  </>
                )}

                {/* ── Transfer ── */}
                {tab === "transfer" && (
                  <>
                    <div className="review-field-row">
                      <label>Số tiền (VNĐ) <span className="ocr-hint">{fmtMoney(currentTxn.amount)}</span></label>
                      <input name="amount" type="number" min="1" value={trForm.amount} onChange={changeTr} placeholder="0" />
                    </div>
                    <div className="review-field-row">
                      <label>Ngày giờ chuyển</label>
                      <input name="transfer_date" type="datetime-local" value={trForm.transfer_date} onChange={changeTr} />
                    </div>
                    <div className="review-field-row">
                      <label>Tài khoản nguồn {currentTxn.sender_account && <span className="ocr-hint">{currentTxn.sender_account}</span>}</label>
                      <select name="from_account_id" value={trForm.from_account_id} onChange={changeTr}>
                        <option value="">Chọn tài khoản nguồn</option>
                        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} ₫</option>)}
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Tài khoản đích {currentTxn.recipient_account && <span className="ocr-hint">{currentTxn.recipient_account}</span>}</label>
                      <select name="to_account_id" value={trForm.to_account_id} onChange={changeTr}>
                        <option value="">Chọn tài khoản đích</option>
                        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} ₫</option>)}
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Ghi chú</label>
                      <textarea name="note" rows={2} value={trForm.note} onChange={changeTr} placeholder="Nội dung..." />
                    </div>
                  </>
                )}

                {/* ── Investment ── */}
                {tab === "investment" && (
                  <>
                    <div className="review-field-row">
                      <label>Loại</label>
                      <select name="direction" value={invForm.direction} onChange={changeInv}>
                        <option value="invest">Nạp / Đầu tư</option>
                        <option value="withdraw">Rút</option>
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Số tiền (VNĐ) <span className="ocr-hint">{fmtMoney(currentTxn.amount)}</span></label>
                      <input name="amount" type="number" min="1" value={invForm.amount} onChange={changeInv} placeholder="0" />
                    </div>
                    <div className="review-field-row">
                      <label>Ngày đầu tư</label>
                      <input name="invested_at" type="datetime-local" value={invForm.invested_at} onChange={changeInv} />
                    </div>
                    <div className="review-field-row">
                      <label>Nguồn đầu tư</label>
                      <select name="investment_source_id" value={invForm.investment_source_id} onChange={changeInv}>
                        <option value="">Chọn nguồn đầu tư</option>
                        {sources.map((s) => <option key={s.source_id} value={s.source_id}>{s.source_name}</option>)}
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Tài khoản</label>
                      <select name="account_id" value={invForm.account_id} onChange={changeInv}>
                        <option value="">Chọn tài khoản</option>
                        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name} — {Number(a.balance).toLocaleString("vi-VN")} ₫</option>)}
                      </select>
                    </div>
                    <div className="review-field-row">
                      <label>Ghi chú</label>
                      <textarea name="note" rows={2} value={invForm.note} onChange={changeInv} placeholder="Ghi chú..." />
                    </div>
                  </>
                )}

                <button className="review-submit-btn" type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader size={16} className="spin" /> Đang lưu...</>
                  ) : isEditMode ? (
                    <><Check size={16} /> Cập nhật {TAB_LABEL[tab]}</>
                  ) : isInvoiceItems ? (
                    <><Check size={16} /> Lưu {itemSelections.filter(Boolean).length} giao dịch</>
                  ) : (
                    <><Check size={16} /> Lưu {TAB_LABEL[tab]}</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

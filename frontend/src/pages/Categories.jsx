import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Check,
  Eye, EyeOff, Tags, Layers,
} from "lucide-react";
import api from "../api/api";
import Sidebar from "../components/Sidebar";
import DataTable from "../components/DataTable";
import "./Categories.css";

const GROUP_TYPE_LABEL = {
  income:     { label: "Thu nhập",  bg: "#dcfce7", color: "#16a34a" },
  expense:    { label: "Chi tiêu",  bg: "#fee2e2", color: "#dc2626" },
  debt:       { label: "Vay nợ",    bg: "#fef9c3", color: "#ca8a04" },
  investment: { label: "Đầu tư",   bg: "#dbeafe", color: "#2563eb" },
};

const getErrorMessage = (err) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((i) => i.msg).join(", ");
  return "Có lỗi xảy ra";
};

function TypeBadge({ type }) {
  const meta = GROUP_TYPE_LABEL[type];
  if (!meta) return <span>{type}</span>;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px",
      fontSize: "12px", fontWeight: 600,
      background: meta.bg, color: meta.color,
    }}>
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Categories
// ─────────────────────────────────────────────────────────────────────────────

function CategoriesTab({ groups }) {
  const [categories, setCategories] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [filterGroupType, setFilterGroupType] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ category_name: "", group_id: "", description: "" });

  const loadCategories = async (hidden = showHidden) => {
    try {
      const res = await api.get(`/categories/?show_hidden=${hidden}`);
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD CATEGORIES ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => { loadCategories(showHidden); }, [showHidden]);

  const toggleShowHidden = () => setShowHidden((v) => !v);

  const handleToggleHide = async (cat) => {
    try {
      if (cat.is_hidden) {
        await api.delete(`/categories/${cat.category_id}/hide`);
      } else {
        await api.post(`/categories/${cat.category_id}/hide`);
      }
      await loadCategories(showHidden);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const filteredCategories = filterGroupType
    ? categories.filter((c) => c.group_type === filterGroupType)
    : categories;

  const openCreate = () => {
    setError("");
    setEditingId(null);
    setForm({ category_name: "", group_id: groups[0]?.group_id ?? "", description: "" });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setError("");
    setEditingId(cat.category_id);
    setForm({
      category_name: cat.category_name,
      group_id: String(cat.group_id),
      description: cat.description || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.category_name.trim()) { setError("Vui lòng nhập tên danh mục"); return; }
    if (!form.group_id) { setError("Vui lòng chọn nhóm danh mục"); return; }
    setSaving(true);
    try {
      const payload = {
        category_name: form.category_name.trim(),
        group_id: Number(form.group_id),
        description: form.description.trim() || null,
      };
      if (editingId) {
        await api.put(`/categories/${editingId}`, payload);
      } else {
        await api.post("/categories/", payload);
      }
      setShowModal(false);
      await loadCategories(showHidden);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Xóa danh mục "${cat.category_name}"?`)) return;
    try {
      await api.delete(`/categories/${cat.category_id}`);
      await loadCategories(showHidden);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const systemTotal = categories.filter((c) => c.is_system).length;
  const userTotal = categories.filter((c) => !c.is_system).length;
  const hiddenTotal = categories.filter((c) => c.is_hidden).length;

  const columns = [
    {
      key: "category_name",
      label: "Tên danh mục",
      sortable: true,
      render: (row) => (
        <span style={{ color: row.is_hidden ? "#94a3b8" : undefined, fontStyle: row.is_hidden ? "italic" : undefined }}>
          {row.category_name}
        </span>
      ),
    },
    {
      key: "group_name",
      label: "Nhóm",
      sortable: true,
    },
    {
      key: "group_type",
      label: "Loại",
      sortable: true,
      render: (row) => <TypeBadge type={row.group_type} />,
    },
    {
      key: "is_system",
      label: "Nguồn",
      render: (row) =>
        row.is_system ? (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}>
            Hệ thống
          </span>
        ) : (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#dbeafe", color: "#2563eb" }}>
            Của bạn
          </span>
        ),
    },
    {
      key: "is_hidden",
      label: "Trạng thái",
      render: (row) => {
        if (!row.is_system) return <span style={{ color: "#94a3b8", fontSize: "13px" }}>—</span>;
        return row.is_hidden ? (
          <span className="hidden-badge">Đã ẩn</span>
        ) : (
          <span className="visible-badge">Hiển thị</span>
        );
      },
    },
    {
      key: "description",
      label: "Mô tả",
      render: (row) => (
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: "#64748b" }}>
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Hành động",
      width: "130px",
      render: (row) => (
        <div style={{ display: "flex", gap: 5 }}>
          {row.is_system ? (
            <button
              type="button"
              className={`cat-action-btn ${row.is_hidden ? "unhide" : "hide"}`}
              onClick={() => handleToggleHide(row)}
              title={row.is_hidden ? "Bỏ ẩn" : "Ẩn danh mục"}
            >
              {row.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          ) : (
            <>
              <button type="button" className="cat-edit-btn" onClick={() => openEdit(row)} title="Sửa">
                <Pencil size={15} />
              </button>
              <button type="button" className="cat-delete-btn" onClick={() => handleDelete(row)} title="Xóa">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Stats */}
      <div className="cat-stats">
        <div className="cat-stat-card">
          <p>Danh mục hệ thống</p>
          <h2>{systemTotal}</h2>
          <span>đang hiển thị</span>
        </div>
        <div className="cat-stat-card">
          <p>Danh mục của bạn</p>
          <h2>{userTotal}</h2>
          <span>do bạn tạo</span>
        </div>
        <div className="cat-stat-card">
          <p>Đã ẩn</p>
          <h2 style={{ color: hiddenTotal > 0 ? "#f59e0b" : undefined }}>{hiddenTotal}</h2>
          <span>danh mục hệ thống</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cat-toolbar">
        <div className="cat-filter-row">
          <span>Lọc:</span>
          {["", "income", "expense", "debt", "investment"].map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-chip ${filterGroupType === t ? "active" : ""}`}
              onClick={() => setFilterGroupType(t)}
            >
              {t === "" ? "Tất cả" : GROUP_TYPE_LABEL[t]?.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className={`show-hidden-btn ${showHidden ? "active" : ""}`}
            onClick={toggleShowHidden}
          >
            {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            {showHidden ? "Đang hiện tất cả (bao gồm ẩn)" : "Hiện danh mục đã ẩn"}
          </button>
          <button className="add-cat-btn" type="button" onClick={openCreate}>
            <Plus size={18} /> Thêm danh mục
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredCategories}
        rowKey="category_id"
        searchFields={["category_name", "group_name", "description"]}
        searchPlaceholder="Tìm kiếm danh mục..."
        emptyMessage="Không có danh mục nào."
        defaultPageSize={15}
      />

      {/* Create/Edit modal */}
      {showModal && (
        <div className="cat-modal-backdrop">
          <form className="cat-modal" onSubmit={handleSubmit}>
            <div className="cat-modal-header">
              <h2>{editingId ? "Sửa danh mục" : "Thêm danh mục mới"}</h2>
              <button type="button" onClick={() => setShowModal(false)}><X size={22} /></button>
            </div>

            {error && <div className="cat-error">{error}</div>}

            <label>Tên danh mục</label>
            <input
              name="category_name"
              value={form.category_name}
              onChange={(e) => setForm((p) => ({ ...p, category_name: e.target.value }))}
              placeholder="Ví dụ: Ăn uống, Lương, Du lịch..."
              autoFocus required
            />

            <label>Nhóm danh mục</label>
            <select name="group_id" value={form.group_id} onChange={(e) => setForm((p) => ({ ...p, group_id: e.target.value }))}>
              <option value="">Chọn nhóm</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name} ({GROUP_TYPE_LABEL[g.group_type]?.label || g.group_type})
                </option>
              ))}
            </select>

            <label>Mô tả (tùy chọn)</label>
            <textarea
              name="description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Mô tả ngắn về danh mục..."
              rows={2}
            />

            <div className="cat-modal-actions">
              <button className="cat-save-btn" type="submit" disabled={saving}>
                <Check size={17} /> {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm danh mục"}
              </button>
              <button className="cat-cancel-btn" type="button" onClick={() => setShowModal(false)}>
                <X size={17} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Category Groups
// ─────────────────────────────────────────────────────────────────────────────

function GroupsTab({ groups, reloadGroups }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ group_name: "", group_type: "expense", description: "" });

  const openCreate = () => {
    setError("");
    setEditingId(null);
    setForm({ group_name: "", group_type: "expense", description: "" });
    setShowModal(true);
  };

  const openEdit = (g) => {
    setError("");
    setEditingId(g.group_id);
    setForm({ group_name: g.group_name, group_type: g.group_type, description: g.description || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.group_name.trim()) { setError("Vui lòng nhập tên nhóm"); return; }
    setSaving(true);
    try {
      const payload = {
        group_name: form.group_name.trim(),
        group_type: form.group_type,
        description: form.description.trim() || null,
      };
      if (editingId) {
        await api.put(`/categories/groups/${editingId}`, payload);
      } else {
        await api.post("/categories/groups", payload);
      }
      setShowModal(false);
      reloadGroups();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g) => {
    if (!window.confirm(`Xóa nhóm "${g.group_name}"?`)) return;
    try {
      await api.delete(`/categories/groups/${g.group_id}`);
      reloadGroups();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: "group_name",
      label: "Tên nhóm",
      sortable: true,
    },
    {
      key: "group_type",
      label: "Loại",
      sortable: true,
      render: (row) => <TypeBadge type={row.group_type} />,
    },
    {
      key: "is_system",
      label: "Nguồn",
      render: (row) =>
        row.is_system ? (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}>
            Hệ thống
          </span>
        ) : (
          <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#dbeafe", color: "#2563eb" }}>
            Của bạn
          </span>
        ),
    },
    {
      key: "description",
      label: "Mô tả",
      render: (row) => (
        <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: "#64748b" }}>
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Hành động",
      width: "100px",
      render: (row) =>
        row.is_system ? null : (
          <div style={{ display: "flex", gap: 5 }}>
            <button type="button" className="cat-edit-btn" onClick={() => openEdit(row)} title="Sửa">
              <Pencil size={15} />
            </button>
            <button type="button" className="cat-delete-btn" onClick={() => handleDelete(row)} title="Xóa">
              <Trash2 size={15} />
            </button>
          </div>
        ),
    },
  ];

  return (
    <>
      <div className="cat-toolbar" style={{ justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="add-cat-btn" type="button" onClick={openCreate}>
          <Plus size={18} /> Thêm nhóm
        </button>
      </div>

      {error && <div className="cat-error">{error}</div>}

      <DataTable
        columns={columns}
        data={groups}
        rowKey="group_id"
        searchFields={["group_name", "description"]}
        searchPlaceholder="Tìm nhóm danh mục..."
        emptyMessage="Không có nhóm nào."
        defaultPageSize={15}
      />

      {showModal && (
        <div className="cat-modal-backdrop">
          <form className="cat-modal" onSubmit={handleSubmit}>
            <div className="cat-modal-header">
              <h2>{editingId ? "Sửa nhóm danh mục" : "Thêm nhóm mới"}</h2>
              <button type="button" onClick={() => setShowModal(false)}><X size={22} /></button>
            </div>

            {error && <div className="cat-error">{error}</div>}

            <label>Tên nhóm</label>
            <input
              value={form.group_name}
              onChange={(e) => setForm((p) => ({ ...p, group_name: e.target.value }))}
              placeholder="Ví dụ: Sinh hoạt, Đầu tư cổ phiếu..."
              autoFocus required
            />

            <label>Loại</label>
            <select value={form.group_type} onChange={(e) => setForm((p) => ({ ...p, group_type: e.target.value }))}>
              <option value="income">Thu nhập</option>
              <option value="expense">Chi tiêu</option>
              <option value="debt">Vay nợ</option>
              <option value="investment">Đầu tư</option>
            </select>

            <label>Mô tả (tùy chọn)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Mô tả ngắn về nhóm..."
              rows={2}
            />

            <div className="cat-modal-actions">
              <button className="cat-save-btn" type="submit" disabled={saving}>
                <Check size={17} /> {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm nhóm"}
              </button>
              <button className="cat-cancel-btn" type="button" onClick={() => setShowModal(false)}>
                <X size={17} /> Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Categories() {
  const [activeTab, setActiveTab] = useState("categories");
  const [groups, setGroups] = useState([]);

  const loadGroups = async () => {
    try {
      const res = await api.get("/categories/groups");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD GROUPS ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  return (
    <div className="categories-layout">
      <Sidebar activePage="categories" />

      <main className="categories-main">
        <div className="categories-header">
          <div>
            <h1>Quản lý danh mục</h1>
            <p>Tạo và quản lý các danh mục thu chi của bạn</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="cat-tabs">
          <button
            type="button"
            className={`cat-tab ${activeTab === "categories" ? "active" : ""}`}
            onClick={() => setActiveTab("categories")}
          >
            <Tags size={17} /> Danh mục
          </button>
          <button
            type="button"
            className={`cat-tab ${activeTab === "groups" ? "active" : ""}`}
            onClick={() => setActiveTab("groups")}
          >
            <Layers size={17} /> Nhóm danh mục
          </button>
        </div>

        {activeTab === "categories" ? (
          <CategoriesTab groups={groups} />
        ) : (
          <GroupsTab groups={groups} reloadGroups={loadGroups} />
        )}
      </main>
    </div>
  );
}

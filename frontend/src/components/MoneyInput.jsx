import "./MoneyInput.css";

/**
 * Number input with thousand-comma formatting and ×1000 quick button.
 * Props:
 *   name       - field name (forwarded to onChange)
 *   value      - raw numeric string stored in form state (no commas)
 *   onChange   - receives synthetic event { target: { name, value } }
 *               where value is a raw digit-only string
 *   placeholder
 *   disabled
 */
export default function MoneyInput({ name, value, onChange, placeholder = "0", disabled = false }) {
  const displayValue = value !== "" && value !== undefined && value !== null
    ? Number(value).toLocaleString("vi-VN")
    : "";

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    onChange({ target: { name, value: raw } });
  };

  const handleMultiply = () => {
    const current = Number(value || 0);
    const next = String(current * 1000);
    onChange({ target: { name, value: next } });
  };

  return (
    <div className="money-input-wrap">
      <input
        type="text"
        className="money-input-field"
        name={name}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
      />
      <button
        type="button"
        className="x1000-btn"
        onClick={handleMultiply}
        disabled={disabled}
        title="Nhân 1.000"
      >
        ×1000
      </button>
    </div>
  );
}

// Simple horizontal bar used for analytics (no chart library needed)
export default function Bar({ label, value, max, suffix = '' }) {
  const percent = max > 0 ? Math.round((value * 100) / max) : 0;
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small">
        <span>{label}</span>
        <span className="text-muted">{value}{suffix}</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: percent + '%' }}></div></div>
    </div>
  );
}

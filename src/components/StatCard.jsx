// Use inside <div className="row g-3">
export default function StatCard({ label, value, icon, color = 'primary' }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card p-3 h-100">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <small className="text-muted">{label}</small>
            <h3 className="mb-0">{value}</h3>
          </div>
          <i className={'bi ' + icon + ' fs-2 text-' + color}></i>
        </div>
      </div>
    </div>
  );
}

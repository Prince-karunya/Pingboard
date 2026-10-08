export default function LoadingIndicator({ label = 'Loading...', centered = false }) {
  return (
    <div className={'loading-indicator' + (centered ? ' justify-content-center' : '')} role="status">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
      <span>{label}</span>
    </div>
  );
}

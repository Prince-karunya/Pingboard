import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import LoadingIndicator from '../components/LoadingIndicator';

export default function Login() {
  const {
    user, login, ready, pendingRequests,
    error: backendError, setError: clearBackendError,
  } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;
  if (!ready) return <LoadingIndicator label="Connecting to PingBoard..." centered />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    clearBackendError('');

    const username = role === 'student' ? rollNo.trim() : email.trim();
    if (!username || !password) {
      setError(role === 'student'
        ? 'Enter your roll number and password.'
        : 'Enter your email and password.');
      return;
    }

    const found = await login(username, password, role);
    if (!found) {
      setError('Could not sign in. Check your details and try again.');
      return;
    }

    navigate('/');
  }

  function clearLoginErrors() {
    setError('');
    clearBackendError('');
  }

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm" style={{ width: 440, maxWidth: '100%' }}>
        <h4 className="text-center mb-1"><i className="bi bi-bell-fill text-primary me-2"></i>PingBoard</h4>
        <p className="text-center text-muted small mb-3">Smart college notice board</p>
        {backendError && <div className="alert alert-warning py-2">{backendError}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <label className="small text-muted">Login As</label>

        <select
  className="form-select mb-3"
  value={role}
  onChange={(e) => {
    setRole(e.target.value);
    clearLoginErrors();
  }}
>
  <option value="student">Student</option>
  <option value="faculty">Faculty</option>
  <option value="admin">Admin</option>
</select>
        <label className="small text-muted">
  {role === 'student' ? 'Roll No' : 'Email'}
</label>

<input
  className="form-control mb-3"
  type={role === 'student' ? 'text' : 'email'}
  value={role === 'student' ? rollNo : email}
  onChange={(e) => {
    if (role === 'student') {
      setRollNo(e.target.value);
    } else {
      setEmail(e.target.value);
    }
    clearLoginErrors();
  }}
  placeholder={
    role === 'student'
      ? 'Enter your roll number'
      : 'Enter your college email'
  }
/>
        <label className="small text-muted">Password</label>
        <div className="input-group mb-3">
          <input className="form-control" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => {
            setPassword(e.target.value);
            clearLoginErrors();
          }} />
          <button type="button" className="btn btn-outline-secondary" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
          </button>
        </div>
        <button className="btn btn-primary w-100" disabled={pendingRequests > 0}>
          {pendingRequests > 0
            ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Signing in...</>
            : 'Login'}
        </button>
        {role === 'student' && <p className="small text-muted text-center mt-3 mb-0">
          Student Accounts are provided by Head Of Department.
        </p>}
      </form>
    </div>
  );
}

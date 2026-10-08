import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { cap } from '../utils/helpers';

export default function Profile() {
  const { user, changePassword } = useApp();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw.length < 6) {
      setMsg('New password must be at least 6 characters.');
      return;
    }
    const changed = await changePassword(oldPw, newPw);
    if (!changed) return;
    setOldPw('');
    setNewPw('');
    setMsg('Password changed successfully.');
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h4 className="mb-3">Profile</h4>
      <div className="card p-3 mb-3">
        <table className="table table-sm mb-0">
          <tbody>
            <tr><th style={{ width: 140 }}>Name</th><td>{user.name}</td></tr>
            <tr><th>Email</th><td>{user.email}</td></tr>
            <tr><th>Role</th><td>{cap(user.role)}</td></tr>
            {user.department && <tr><th>Department</th><td>{user.department}</td></tr>}
            {user.role === 'student' && <tr><th>Year / Section</th><td>Year {user.year}, Section {user.section}</td></tr>}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleChangePassword} className="card p-3">
        <h6>Change password</h6>
        {msg && <div className="alert alert-info py-2">{msg}</div>}
        <input className="form-control mb-2" type="password" placeholder="Current password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        <input className="form-control mb-2" type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <button className="btn btn-primary">Update password</button>
      </form>
    </div>
  );
}

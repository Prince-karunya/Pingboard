import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MCA_DEPARTMENT } from '../../utils/mcaCohorts';

export default function Users() {
  const { data, user, addUsers, updateUser, removeUser } = useApp();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', isHod: false,
  });
  const faculty = data.users.filter((account) => account.role === 'faculty');

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleAdd(event) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || form.password.length < 8) {
      setMessage('Enter the faculty name, valid email, and a password of at least 8 characters.');
      return;
    }
    const created = await addUsers([{
      ...form, name: form.name.trim(), email, role: 'faculty', department: MCA_DEPARTMENT,
    }]);
    if (created) {
      setForm({ name: '', email: '', password: '', isHod: false });
      setMessage('Faculty account created.');
    }
  }

  async function handleCSV(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const rows = lines.flatMap((line, index) => {
        const [name, email, password, isHod] = line.split(',').map((value) => value.trim());
        if (index === 0 && name?.toLowerCase() === 'name') return [];
        if (!name || !email || !password) return [];
        return [{ name, email, password, department: MCA_DEPARTMENT, role: 'faculty', isHod: isHod?.toLowerCase() === 'true' }];
      });
      if (!rows.length) {
        setMessage('No valid faculty rows found. CSV columns: name,email,password,isHod');
        return;
      }
      const created = await addUsers(rows);
      if (created) setMessage(`${created.length} faculty accounts created.`);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  const query = search.trim().toLowerCase();
  const list = faculty.filter((account) =>
    !query || account.name.toLowerCase().includes(query)
      || account.email.toLowerCase().includes(query)
      || account.department.toLowerCase().includes(query));

  return (
    <>
      <h4 className="mb-3">Faculty management</h4>
      <p className="text-muted">Create faculty accounts, assign HOD permissions, and manage faculty access.</p>
      {message && <div className="alert alert-info py-2">{message}</div>}
      <form onSubmit={handleAdd} className="card p-3 mb-3">
        <h6>Add faculty</h6>
        <div className="row g-2 align-items-center">
          <div className="col-md-3"><input required className="form-control" name="name" placeholder="Name" value={form.name} onChange={handleChange} /></div>
          <div className="col-md-3"><input required className="form-control" type="email" name="email" placeholder="Registered email" value={form.email} onChange={handleChange} /></div>
          <div className="col-md-2"><input required minLength="8" className="form-control" type="password" autoComplete="new-password" name="password" placeholder="Password (8+ chars)" value={form.password} onChange={handleChange} /></div>
          <div className="col-md-2"><input className="form-control" value={MCA_DEPARTMENT} readOnly /></div>
          <div className="col-auto form-check">
            <input className="form-check-input" type="checkbox" id="newFacultyHod" name="isHod" checked={form.isHod} onChange={handleChange} />
            <label className="form-check-label" htmlFor="newFacultyHod">HOD</label>
          </div>
          <div className="col-auto"><button className="btn btn-primary">Add faculty</button></div>
        </div>
        <hr />
        <label className="small text-muted">Bulk upload MCA faculty CSV: name,email,password,isHod</label>
        <input type="file" accept=".csv" className="form-control" onChange={handleCSV} />
      </form>

      <input className="form-control mb-3" placeholder="Search faculty by name, email, or department" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="table-responsive">
        <table className="table bg-white align-middle">
          <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td className="small">{account.email}</td>
                <td>{MCA_DEPARTMENT}</td>
                <td>{account.isHod ? <span className="badge bg-primary">HOD</span> : 'Faculty'}</td>
                <td>{account.active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                <td className="text-nowrap">
                  <button className="btn btn-sm btn-outline-secondary me-1" disabled={account.id === user.id} onClick={() => updateUser(account.id, { active: !account.active })}>
                    {account.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={async () => {
                    const password = window.prompt('Enter a new password for ' + account.name + ' (at least 8 characters):');
                    if (password === null) return;
                    if (password.length < 8) {
                      setMessage('Password must be at least 8 characters.');
                      return;
                    }
                    if (await updateUser(account.id, { password })) setMessage('Faculty password updated.');
                  }}>Reset password</button>
                  <button className="btn btn-sm btn-outline-danger me-1" disabled={!account.active} onClick={async () => {
                    if (window.confirm(`Remove faculty access for ${account.name}? Their account and records will be retained but disabled.`)
                      && await removeUser(account.id)) setMessage(`${account.name} no longer has faculty access.`);
                  }}>Remove</button>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => updateUser(account.id, { isHod: !account.isHod })}>
                    {account.isHod ? 'Remove HOD' : 'Make HOD'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="text-center text-muted">No faculty accounts found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

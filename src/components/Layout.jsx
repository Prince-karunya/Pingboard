import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { visibleNotices } from '../utils/helpers';
import NotificationBell from './NotificationBell';

const menus = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: 'bi-house' },
    { to: '/student/notices', label: 'Notices', icon: 'bi-megaphone' },
    { to: '/student/materials', label: 'Materials', icon: 'bi-folder' },
    { to: '/student/calendar', label: 'Calendar', icon: 'bi-calendar3' },
    { to: '/student/bookmarks', label: 'Bookmarks', icon: 'bi-bookmark' },
    { to: '/profile', label: 'Profile', icon: 'bi-person' },
  ],
  faculty: [
    { to: '/faculty/dashboard', label: 'Dashboard', icon: 'bi-house' },
    { to: '/faculty/notices/new', label: 'Create Notice', icon: 'bi-plus-circle' },
    { to: '/faculty/notices', label: 'My Notices', icon: 'bi-megaphone' },
    { to: '/faculty/materials/upload', label: 'Upload Material', icon: 'bi-upload' },
    { to: '/faculty/materials', label: 'My Materials', icon: 'bi-folder' },
    { to: '/faculty/analytics', label: 'Analytics', icon: 'bi-bar-chart' },
    { to: '/profile', label: 'Profile', icon: 'bi-person' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'bi-house' },
    { to: '/admin/users', label: 'Faculty', icon: 'bi-people' },
    { to: '/admin/courses', label: 'Courses', icon: 'bi-journal-text' },
    { to: '/admin/notices', label: 'Notices', icon: 'bi-megaphone' },
    { to: '/admin/reports', label: 'Reports', icon: 'bi-graph-up' },
    { to: '/profile', label: 'Profile', icon: 'bi-person' },
  ],
};

export default function Layout() {
  const { user, data, logout, error, setError } = useApp();
  const navigate = useNavigate();
  const links = user.role === 'faculty' && user.isHod
    ? [...menus.faculty.slice(0, 1), { to: '/faculty/students', label: 'Department Students', icon: 'bi-people' }, ...menus.faculty.slice(1)]
    : menus[user.role];

  // unread count for the bell (students only)
  let unread = 0;
  if (user.role === 'student') {
    const mine = visibleNotices(data, user);
    unread = mine.filter((n) => !data.reads.some((r) => r.noticeId === n.id && r.userId === user.id)).length;
  }

  async function handleLogout() {
    if (await logout()) navigate('/login');
  }

  return (
    <>
      <nav className="topbar d-flex justify-content-between align-items-center px-3 text-white">
        <span className="fw-bold fs-5"><i className="bi bi-bell-fill me-2"></i>PingBoard</span>
        <div className="d-flex align-items-center gap-3">
          {user.role === 'student' && (
            <>
            <NotificationBell />
            <Link to="/student/notices?tab=unread" className="text-white position-relative">
              <i className="bi bi-bell fs-5"></i>
              {unread > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unread}</span>
              )}
            </Link>
            </>
          )}
          <span className="d-none d-sm-inline">{user.name}</span>
          <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="d-flex">
        <aside className="sidebar p-3" aria-label="Main navigation">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end>
              <i className={'bi ' + l.icon + ' me-2'}></i>{l.label}
            </NavLink>
          ))}
        </aside>
        <main className="content p-3 p-md-4 flex-grow-1">
          {error && <div className="alert alert-danger alert-dismissible" role="alert">
            {error}
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setError('')}></button>
          </div>}
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav d-md-none" aria-label="Main navigation">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end title={l.label}>
            <i className={'bi ' + l.icon} aria-hidden="true"></i>{l.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

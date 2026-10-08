import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { issuerName } from '../utils/helpers';

export default function NotificationBell() {
  const { data, markNotificationRead } = useApp();
  const [open, setOpen] = useState(false);
  const unread = data.notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="dropdown">
      <button className="btn btn-link text-white position-relative p-0" aria-label="Notifications"
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i className="bi bi-bell fs-5"></i>
        {unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unread}</span>}
      </button>
      {open && <div className="dropdown-menu dropdown-menu-end show p-2 shadow" style={{ width: 340, maxWidth: '90vw' }}>
        <div className="d-flex justify-content-between align-items-center px-2 mb-1">
          <b>Notifications</b>
          <button className="btn btn-sm btn-link" onClick={() => setOpen(false)}>Close</button>
        </div>
        {data.notifications.length === 0 && <div className="small text-muted px-2 py-3">No notifications yet.</div>}
        {data.notifications.slice(0, 12).map((notification) => (
          <Link key={notification.id}
            to={notification.noticeId ? `/notices/${notification.noticeId}` : '/student/materials'}
            className={'dropdown-item text-wrap small py-2' + (notification.readAt ? '' : ' bg-light')}
            onClick={async () => {
              await markNotificationRead(notification.id);
              setOpen(false);
            }}>
            <b>{notification.title}</b>
            <div className="text-muted">{notification.body}</div>
            <div className="text-muted">Issued by {issuerName(data, notification.issuedBy
              ?? data.notices.find((notice) => notice.id === notification.noticeId)?.createdBy
              ?? data.materials.find((material) => material.id === notification.materialId)?.uploadedBy)}</div>
            <div className="text-muted">{new Date(notification.createdAt).toLocaleString()}</div>
          </Link>
        ))}
      </div>}
    </div>
  );
}

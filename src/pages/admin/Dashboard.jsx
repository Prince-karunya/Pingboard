import { useApp } from '../../context/AppContext';
import StatCard from '../../components/StatCard';

export default function Dashboard() {
  const { data } = useApp();
  const faculty = data.users.filter((u) => u.role === 'faculty');
  const published = data.notices.filter((n) => n.status === 'published');

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Admin Dashboard</h4>
      </div>

      <div className="row g-3 mb-4">
        <StatCard label="Faculty" value={faculty.length} icon="bi-person-workspace" color="success" />
        <StatCard label="Courses" value={data.courses.length} icon="bi-journal-text" color="info" />
        <StatCard label="Notices" value={published.length} icon="bi-megaphone" color="warning" />
        <StatCard label="Materials" value={data.materials.length} icon="bi-folder" />
      </div>
    </>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoadingIndicator from './components/LoadingIndicator';
import Login from './pages/Login';
import NoticeDetail from './pages/NoticeDetail';
import Profile from './pages/Profile';

import StudentDashboard from './pages/student/Dashboard';
import StudentNotices from './pages/student/Notices';
import StudentMaterials from './pages/student/Materials';
import StudentCalendar from './pages/student/Calendar';
import StudentBookmarks from './pages/student/Bookmarks';

import FacultyDashboard from './pages/faculty/Dashboard';
import CreateNotice from './pages/faculty/CreateNotice';
import MyNotices from './pages/faculty/MyNotices';
import NoticeAnalytics from './pages/faculty/NoticeAnalytics';
import UploadMaterial from './pages/faculty/UploadMaterial';
import ManageMaterials from './pages/faculty/ManageMaterials';
import FacultyAnalytics from './pages/faculty/Analytics';
import DepartmentStudents from './pages/faculty/Students';

import AdminDashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import Courses from './pages/admin/Courses';
import AdminNotices from './pages/admin/Notices';
import Reports from './pages/admin/Reports';

function Home() {
  const { user, ready } = useApp();
  if (!ready) return <LoadingIndicator label="Connecting to PingBoard..." centered />;
  if (!user) return <Navigate to="/login" replace />;
  const target = { student: '/student/dashboard', faculty: '/faculty/dashboard', admin: '/admin/dashboard' };
  return <Navigate to={target[user.role]} replace />;
}

function HodOnly({ children }) {
  const { isHod } = useApp();
  return isHod ? children : <Navigate to="/faculty/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/notices/:id" element={<NoticeDetail />} />
        <Route path="/profile" element={<Profile />} />

        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/notices" element={<StudentNotices />} />
          <Route path="/student/materials" element={<StudentMaterials />} />
          <Route path="/student/calendar" element={<StudentCalendar />} />
          <Route path="/student/bookmarks" element={<StudentBookmarks />} />
        </Route>

        <Route element={<ProtectedRoute roles={['faculty']} />}>
          <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
          <Route path="/faculty/notices/new" element={<CreateNotice />} />
          <Route path="/faculty/notices" element={<MyNotices />} />
          <Route path="/faculty/notices/:id/analytics" element={<NoticeAnalytics />} />
          <Route path="/faculty/materials/upload" element={<UploadMaterial />} />
          <Route path="/faculty/materials" element={<ManageMaterials />} />
          <Route path="/faculty/analytics" element={<FacultyAnalytics />} />
          <Route path="/faculty/students" element={<HodOnly><DepartmentStudents /></HodOnly>} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/courses" element={<Courses />} />
          <Route path="/admin/notices" element={<AdminNotices />} />
          <Route path="/admin/reports" element={<Reports />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

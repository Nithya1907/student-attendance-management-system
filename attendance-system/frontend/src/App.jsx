import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import FacultyDashboard from './pages/FacultyDashboard.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import Students from './pages/Students.jsx';
import FacultyManagement from './pages/FacultyManagement.jsx';
import Academics from './pages/Academics.jsx';
import Assignments from './pages/Assignments.jsx';
import UsersSettings from './pages/UsersSettings.jsx';
import MarkAttendance from './pages/MarkAttendance.jsx';
import Reports from './pages/Reports.jsx';
import StudentAttendance from './pages/StudentAttendance.jsx';
import Profile from './pages/Profile.jsx';
import { NotFound, Unauthorized } from './pages/Errors.jsx';

function DashboardSwitch() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'faculty') return <FacultyDashboard />;
  return <StudentDashboard />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardSwitch />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/students" element={<Students />} />
            <Route path="/faculty" element={<FacultyManagement />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/users" element={<UsersSettings />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'faculty']} />}>
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedRoute roles={['faculty']} />}>
            <Route path="/mark-attendance" element={<MarkAttendance />} />
          </Route>
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="/my-attendance" element={<StudentAttendance />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound standalone />} />
    </Routes>
  );
}

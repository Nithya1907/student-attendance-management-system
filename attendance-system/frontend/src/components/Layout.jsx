import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, Users, BookOpen, Link2, ClipboardCheck, BarChart3, UserCog, User, LogOut, Menu, X, CalendarCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = {
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/students', label: 'Students', icon: GraduationCap },
    { to: '/faculty', label: 'Faculty', icon: Users },
    { to: '/academics', label: 'Classes & Subjects', icon: BookOpen },
    { to: '/assignments', label: 'Enrollment & Assignment', icon: Link2 },
    { to: '/reports', label: 'Attendance Reports', icon: BarChart3 },
    { to: '/users', label: 'Users & Settings', icon: UserCog },
    { to: '/profile', label: 'Profile', icon: User },
  ],
  faculty: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/mark-attendance', label: 'Mark Attendance', icon: ClipboardCheck },
    { to: '/reports', label: 'Reports & History', icon: BarChart3 },
    { to: '/profile', label: 'Profile', icon: User },
  ],
  student: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-attendance', label: 'My Attendance', icon: CalendarCheck },
    { to: '/profile', label: 'Profile', icon: User },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role];
  const name = user.profile?.fullName || user.email;

  const sidebar = (
    <nav className="flex h-full flex-col bg-blue-900 text-blue-100" aria-label="Main navigation">
      <div className="flex items-center gap-2 px-5 py-5 text-white">
        <CalendarCheck size={26} />
        <span className="text-lg font-bold leading-tight">Attendance<br /><span className="text-xs font-normal text-blue-200">Management System</span></span>
      </div>
      <ul className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}>
              <Icon size={18} /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <button onClick={() => { logout(); navigate('/login'); }} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-blue-800">
        <LogOut size={18} /> Logout
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-64">{sidebar}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button className="rounded p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X size={22} /> : <Menu size={22} />}</button>
          <div className="hidden text-sm text-slate-500 lg:block">Welcome back, <span className="font-semibold text-slate-800">{name}</span></div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">{user.role}</span>
            <button onClick={() => navigate('/profile')} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white" aria-label="Open profile">
              {name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}

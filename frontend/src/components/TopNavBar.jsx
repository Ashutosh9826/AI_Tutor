import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const navItemClass = ({ isActive }) =>
  isActive
    ? 'text-blue-600 border-b-2 border-blue-600 pb-2'
    : 'text-slate-500 hover:text-slate-900 transition-colors';

export default function TopNavBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const initials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('');

  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="material-symbols-outlined text-on-surface-variant p-2 hover:bg-slate-50 rounded-full transition-colors"
            title="Home"
          >
            menu
          </button>
          <Link to="/dashboard" className="text-xl font-semibold text-slate-900">
            Academic Atelier
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-['Inter'] antialiased">
          <NavLink to="/dashboard" className={navItemClass}>
            Stream
          </NavLink>
          <NavLink to="/classwork" className={navItemClass}>
            Classwork
          </NavLink>
          <NavLink to="/people" className={navItemClass}>
            People
          </NavLink>
          <NavLink to="/grades" className={navItemClass}>
            Grades
          </NavLink>
        </nav>

        <div className="relative flex items-center gap-2">
          <button
            className="p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-colors active:scale-95 duration-200"
            type="button"
            onClick={() => {
              setShowProfileMenu(false);
              setShowAppMenu((prev) => !prev);
            }}
            title="Quick links"
          >
            <span className="material-symbols-outlined">apps</span>
          </button>
          <button
            className="ml-1 w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30 bg-surface-container-low flex items-center justify-center"
            type="button"
            onClick={() => {
              setShowAppMenu(false);
              setShowProfileMenu((prev) => !prev);
            }}
            title="Profile"
          >
            {user?.avatar_url ? (
              <img alt="User profile" className="w-full h-full object-cover" src={user.avatar_url} />
            ) : (
              <span className="text-[11px] font-bold text-primary">{initials}</span>
            )}
          </button>

          {showAppMenu && (
            <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-[70]">
              <NavLink to="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => setShowAppMenu(false)}>
                Stream
              </NavLink>
              <NavLink to="/classwork" className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => setShowAppMenu(false)}>
                Classwork
              </NavLink>
              <NavLink to="/people" className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => setShowAppMenu(false)}>
                People
              </NavLink>
              <NavLink to="/grades" className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => setShowAppMenu(false)}>
                Grades
              </NavLink>
              <NavLink to="/settings" className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => setShowAppMenu(false)}>
                Settings
              </NavLink>
            </div>
          )}

          {showProfileMenu && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-[70]">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-bold text-on-surface">{user?.name || 'User'}</p>
                <p className="text-xs text-outline mt-0.5">{user?.email}</p>
              </div>
              <NavLink
                to="/settings"
                className="mt-2 block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
                onClick={() => setShowProfileMenu(false)}
              >
                Manage your account
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                  navigate('/login');
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-tertiary"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

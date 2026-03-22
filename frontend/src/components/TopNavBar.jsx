import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const navItemClass = ({ isActive }) =>
  isActive
    ? 'text-blue-600 border-b-2 border-blue-600 pb-2'
    : 'text-slate-500 hover:text-slate-900 transition-colors';

export default function TopNavBar() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [showAppMenu, setShowAppMenu] = useState(false);

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
            onClick={() => setShowAppMenu((prev) => !prev)}
            title="Quick links"
          >
            <span className="material-symbols-outlined">apps</span>
          </button>
          <button
            className="p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-colors active:scale-95 duration-200"
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Logout"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
          <div className="ml-2 w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
            <img
              alt="User profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuChQ_0-0GBIaajC04IZXWYbxzpln6EwdP8oo5xVUlGAD84X0n3jhAoMjqKyafdQkJGNLPjRpSFLOYraxm5A-w13I1FRh005ethd-2Umruyj7X-OwOagVpeR6tPQlmg1-VADttGdvgcjukoSJABtZhSrIPeldXg-O_R0CMOiUqe_HgIsodtNJCnOgGhjqKnyEQgD9akpHbaShV7b7QVKwmEX5Zs1hGIZ5fdBAJOZayUjHt5A7nw6ykRUCNRCpi17iKltHtxvMdgs7yU"
            />
          </div>

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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

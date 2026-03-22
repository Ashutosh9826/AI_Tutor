import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

export default function Sidebar({ onJoinClass }) {
  const { user } = useAuthStore();
  return (
    <aside className="hidden lg:flex flex-col pt-4 pb-4 h-[calc(100vh-64px)] w-64 fixed left-0 bg-surface-container-low font-['Inter'] text-sm font-medium z-40">
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="w-10 h-10 atelier-card-gradient rounded-xl flex items-center justify-center text-white">
            <span className="material-symbols-outlined">school</span>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600 leading-tight">Classroom</div>
            <div className="text-xs text-on-surface-variant">Academic Atelier</div>
          </div>
        </div>
      </div>
      <nav className="flex-grow space-y-1 pr-4">
        <Link to="/dashboard" className="flex items-center gap-4 bg-blue-50 text-blue-700 rounded-r-full px-4 py-3 ml-0 transition-all">
          <span className="material-symbols-outlined">home</span>
          <span>Home</span>
        </Link>
        <Link to="/calendar" className="flex items-center gap-4 text-slate-600 px-4 py-3 hover:bg-slate-100 rounded-r-full transition-all">
          <span className="material-symbols-outlined">calendar_today</span>
          <span>Calendar</span>
        </Link>
        <Link to="/dashboard" className="flex items-center gap-4 text-slate-600 px-4 py-3 hover:bg-slate-100 rounded-r-full transition-all">
          <span className="material-symbols-outlined">school</span>
          <span>Enrolled</span>
        </Link>
        <Link to="/archived" className="flex items-center gap-4 text-slate-600 px-4 py-3 hover:bg-slate-100 rounded-r-full transition-all">
          <span className="material-symbols-outlined">archive</span>
          <span>Archived</span>
        </Link>
        <Link to="/settings" className="flex items-center gap-4 text-slate-600 px-4 py-3 hover:bg-slate-100 rounded-r-full transition-all">
          <span className="material-symbols-outlined">settings</span>
          <span>Settings</span>
        </Link>
      </nav>
      
      <div className="mt-auto px-4 space-y-4">
        {onJoinClass && (
          <button onClick={onJoinClass} className="w-full atelier-card-gradient text-white rounded-full py-3 px-6 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
            <span className="material-symbols-outlined">add</span>
            {user?.role === 'TEACHER' ? 'Create Class' : 'Join Class'}
          </button>
        )}
        <div className="pt-4 border-t border-slate-200">
          <Link to="/help" className="flex items-center gap-4 text-slate-500 px-4 py-2 hover:text-slate-900 text-xs">
            <span className="material-symbols-outlined text-sm">help</span>
            <span>Help</span>
          </Link>
          <Link to="/privacy" className="flex items-center gap-4 text-slate-500 px-4 py-2 hover:text-slate-900 text-xs">
            <span className="material-symbols-outlined text-sm">security</span>
            <span>Privacy</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

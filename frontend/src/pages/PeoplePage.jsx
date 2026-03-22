import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classService } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import TopNavBar from '../components/TopNavBar';
import Sidebar from '../components/Sidebar';

export default function PeoplePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchPeopleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchPeopleData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await classService.getClasses();
      setClasses(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load people information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <TopNavBar />
      <div className="flex pt-16">
        <Sidebar />
        <main className="w-full lg:pl-64 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <header className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-outline">People</p>
              <h1 className="text-4xl font-bold tracking-tight mt-2">Class Roster Overview</h1>
              <p className="text-sm text-outline mt-2">Per-class people data is now wired into navigation.</p>
            </header>

            {loading && <p className="text-outline">Loading people...</p>}
            {error && <p className="text-error">{error}</p>}

            {!loading && !error && classes.length === 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 text-center">
                <p className="text-outline italic">No classes found yet.</p>
              </div>
            )}

            {!loading && !error && classes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <article key={cls.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5">
                    <p className="text-lg font-bold text-on-surface">{cls.name}</p>
                    <p className="text-sm text-outline mt-1">{cls.section || 'General'}</p>
                    {user?.role === 'TEACHER' ? (
                      <p className="text-sm mt-3">
                        <span className="font-semibold">Students:</span> {cls._count?.enrollments || 0}
                      </p>
                    ) : (
                      <p className="text-sm mt-3">
                        <span className="font-semibold">Teacher:</span> {cls.teacher?.name || 'Unknown'}
                      </p>
                    )}
                    {user?.role === 'TEACHER' && (
                      <p className="text-xs font-mono mt-2 text-primary">Code: {cls.class_code}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

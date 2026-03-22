import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assignmentService, classService } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import TopNavBar from '../components/TopNavBar';
import Sidebar from '../components/Sidebar';

export default function ClassworkPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchClasswork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchClasswork = async () => {
    try {
      setLoading(true);
      setError('');
      const classes = await classService.getClasses();
      const withAssignments = await Promise.all(
        classes.map(async (cls) => {
          const assignments = await assignmentService.getByClass(cls.id);
          return { cls, assignments };
        })
      );

      const flattened = [];
      withAssignments.forEach(({ cls, assignments }) => {
        assignments.forEach((assignment) => {
          flattened.push({
            ...assignment,
            className: cls.name,
            classId: cls.id,
            section: cls.section || 'General',
          });
        });
      });

      flattened.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });

      setRows(flattened);
    } catch (err) {
      console.error(err);
      setError('Failed to load classwork');
    } finally {
      setLoading(false);
    }
  };

  const upcomingCount = useMemo(() => {
    return rows.filter((r) => r.due_date && new Date(r.due_date) > new Date()).length;
  }, [rows]);

  const formatDueDate = (value) => {
    if (!value) return 'No due date';
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <TopNavBar />
      <div className="flex pt-16">
        <Sidebar />
        <main className="w-full lg:pl-64 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <header className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-outline">Classwork</p>
              <h1 className="text-4xl font-bold tracking-tight mt-2">All Tasks</h1>
              <p className="text-sm text-outline mt-2">{upcomingCount} upcoming deadlines</p>
            </header>

            {loading && <p className="text-outline">Loading classwork...</p>}
            {error && <p className="text-error">{error}</p>}

            {!loading && !error && rows.length === 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 text-center">
                <p className="text-outline italic">No assignments yet across your classes.</p>
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <div className="space-y-4">
                {rows.map((row) => (
                  <Link key={row.id} to={`/assignment/${row.id}`} className="block">
                    <article className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{row.title}</p>
                          <p className="text-xs text-outline mt-1">
                            {row.className} ({row.section})
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-outline">Due</p>
                          <p className="text-sm font-medium text-on-surface">{formatDueDate(row.due_date)}</p>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

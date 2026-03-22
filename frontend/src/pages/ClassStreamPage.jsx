import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { assignmentService, classService, lessonService } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import TopNavBar from '../components/TopNavBar';
import Sidebar from '../components/Sidebar';

export default function ClassStreamPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const classId = searchParams.get('classId');
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create assignment modal
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Create lesson modal
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonCreateError, setLessonCreateError] = useState('');
  const [lessonCreateLoading, setLessonCreateLoading] = useState(false);

  // Generate AI lesson modal
  const [showGenerateAi, setShowGenerateAi] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiGrade, setAiGrade] = useState('High School');
  const [aiDuration, setAiDuration] = useState('30');
  const [aiReferenceContent, setAiReferenceContent] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showClassInfo, setShowClassInfo] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!classId) {
      navigate('/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignData, lessonData, classData] = await Promise.all([
        assignmentService.getByClass(classId),
        lessonService.getByClass(classId),
        classService.getById(classId),
      ]);
      setAssignments(assignData);
      setLessons(lessonData);
      setClassInfo(classData);
    } catch (err) {
      console.error('Failed to fetch class data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    if (isArchivedClass) {
      setCreateError('Cannot create assignments in an archived class. Restore the class first.');
      setCreateLoading(false);
      return;
    }
    try {
      await assignmentService.create({
        class_id: classId,
        title: assignTitle,
        description: assignDesc,
        due_date: assignDue || null
      });
      setShowCreateAssignment(false);
      setAssignTitle('');
      setAssignDesc('');
      setAssignDue('');
      await fetchData();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create assignment');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    setLessonCreateError('');
    setLessonCreateLoading(true);
    if (isArchivedClass) {
      setLessonCreateError('Cannot create lessons in an archived class. Restore the class first.');
      setLessonCreateLoading(false);
      return;
    }
    try {
      await lessonService.create({
        class_id: classId,
        title: lessonTitle
      });
      setShowCreateLesson(false);
      setLessonTitle('');
      await fetchData();
      // Optionally navigate directly to the editor:
      // navigate(`/lesson/edit?lessonId=${newLesson.id}`);
    } catch (err) {
      setLessonCreateError(err.response?.data?.error || 'Failed to create lesson');
    } finally {
      setLessonCreateLoading(false);
    }
  };

  const handleGenerateAILesson = async (e) => {
    e.preventDefault();
    setAiError('');
    setAiLoading(true);
    if (isArchivedClass) {
      setAiError('Cannot generate lessons in an archived class. Restore the class first.');
      setAiLoading(false);
      return;
    }
    try {
      // 1. Ask OpenRouter to draft the lesson JSON
      const generatedData = await lessonService.generateAi({
        topic: aiTopic,
        gradeLevel: aiGrade,
        targetDuration: aiDuration,
        referenceContent: aiReferenceContent
      });

      // 2. Create the empty lesson record in the DB to get an ID
      const newLesson = await lessonService.create({
        class_id: classId,
        title: generatedData.title || `Lesson on ${aiTopic}`
      });

      // 3. Update the lesson with the generated blocks
      await lessonService.update(newLesson.id, {
        status: 'DRAFT',
        blocks: generatedData.blocks || []
      });

      setShowGenerateAi(false);
      setAiTopic('');
      await fetchData();
      
      // Navigate to the editor so the teacher can review the AI generated content
      navigate(`/lesson/edit?lessonId=${newLesson.id}`);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'Failed to generate AI lesson');
    } finally {
      setAiLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isArchivedClass = Boolean(classInfo?.is_archived);

  if (loading) {
    return (
      <div className="bg-background text-on-background min-h-screen">
        <TopNavBar />
        <div className="flex">
          <Sidebar />
          <main className="pt-16 lg:pl-64 min-h-screen flex items-center justify-center w-full">
            <p className="text-on-surface-variant text-lg">Loading class data...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen">
      <TopNavBar />
      
      <div className="flex">
        <Sidebar />
      
      {/* Main Content Area */}
      <main className="pt-16 lg:pl-64 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Hero Banner */}
          <section className="relative h-64 rounded-xl overflow-hidden mb-8 shadow-sm group">
            <div className="absolute inset-0 bg-secondary">
              <img alt="Class Banner" className="w-full h-full object-cover mix-blend-overlay opacity-40" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGNr4QwSQkx9fnLMJDGQ1e2oiUrchCxbWdeFB_e6OsdIMlIQTEQO0Q__FHEepLna6OC9SFvDmB_Gu0dMJoy4o8obaajklKyNvXsKK1CDiFFUJBxZoigblHzvC2uEOQQHA0RwQoHbwQgqS8QjOiTPpJDLNN0I3aYx9kOZnY0NGXv7IR6f9TH2RYg5dLNgECIZd7LBmGGrrPcQtYNncF93l3GImp7OlA93KJiM7F1F2csG4nd4eBC0uJ_OlsBoUm-d9dbyj3QeZFBQY" />
            </div>
            <div className="absolute bottom-6 left-6 text-white">
              <h2 className="text-4xl font-bold tracking-tight">{classInfo?.name || 'Class Stream'}</h2>
              <p className="text-xl opacity-90">Assignments & Lessons</p>
              {isArchivedClass && (
                <p className="inline-flex mt-2 items-center gap-1 text-xs font-bold uppercase tracking-wider bg-black/30 rounded-full px-2 py-1">
                  <span className="material-symbols-outlined text-sm">archive</span>
                  Archived
                </p>
              )}
            </div>
            <button
              className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors"
              type="button"
              onClick={() => setShowClassInfo(true)}
              title="Class details"
            >
              <span className="material-symbols-outlined">info</span>
            </button>
          </section>

          {isArchivedClass && (
            <section className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                This class is archived. New assignments and lessons are disabled until it is restored from Archived Classes.
              </p>
            </section>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: Upcoming */}
            <aside className="lg:col-span-1">
              <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-slate-100/10">
                <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider mb-4">Upcoming</h3>
                <div className="space-y-4">
                  {assignments.filter(a => a.due_date && new Date(a.due_date) > new Date()).slice(0, 3).map(a => (
                    <div key={a.id} className="group cursor-pointer">
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-bold text-tertiary">Due {formatDate(a.due_date)}</span>
                        {user?.role === 'STUDENT' && a.completed && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Complete
                          </span>
                        )}
                        {user?.role === 'TEACHER' && (
                          <Link 
                            to={`/assignment/${a.id}/grade`}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 px-2 py-1 rounded border border-primary/20 transition-colors"
                          >
                            Grade Submissions
                          </Link>
                        )}
                      </div>
                      <Link to={`/assignment/${a.id}`} className="text-sm text-slate-700 font-medium group-hover:text-primary transition-colors block">{a.title}</Link>
                    </div>
                  ))}
                  {assignments.filter(a => a.due_date && new Date(a.due_date) > new Date()).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No upcoming deadlines</p>
                  )}
                </div>
              </div>
            </aside>
            
            {/* Center Column: Stream Feed */}
            <div className="lg:col-span-3 space-y-6">
              {/* Assignments Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">assignment</span>
                    Assignments
                  </h3>
                  {user?.role === 'TEACHER' && (
                    <button
                      onClick={() => { setCreateError(''); setShowCreateAssignment(true); }}
                      disabled={isArchivedClass}
                      className="flex items-center gap-1 text-sm font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      New Assignment
                    </button>
                  )}
                </div>
                {assignments.length > 0 ? assignments.map(assignment => (
                  <Link key={assignment.id} to={`/assignment/${assignment.id}`} className="block">
                    <article className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100/10 p-6 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{assignment.title}</p>
                          <p className="text-xs text-slate-500">
                             {assignment.due_date ? `Due ${formatDate(assignment.due_date)}` : 'No due date'}
                             {assignment.description && ` • ${assignment.description.substring(0, 60)}...`}
                          </p>
                        </div>
                        {user?.role === 'TEACHER' && (
                          <Link 
                            to={`/assignment/${assignment.id}/grade`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 px-2 py-1 rounded-full border border-primary/20 transition-colors"
                          >
                            Grade
                          </Link>
                        )}
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                      </div>
                    </article>
                  </Link>
                )) : (
                  <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100/10 p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">assignment</span>
                    <p className="text-slate-400 text-sm">No assignments yet</p>
                  </div>
                )}
              </div>

              {/* Lessons Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">auto_stories</span>
                    Lessons
                  </h3>
                  {user?.role === 'TEACHER' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAiError(''); setShowGenerateAi(true); }}
                        disabled={isArchivedClass}
                        className="flex items-center gap-1 text-sm font-semibold signature-gradient text-white shadow hover:shadow-lg px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-sm">magic_button</span>
                        Generate Lesson with AI
                      </button>
                      <button
                        onClick={() => { setLessonCreateError(''); setShowCreateLesson(true); }}
                        disabled={isArchivedClass}
                        className="flex items-center gap-1 text-sm font-semibold text-secondary hover:bg-secondary/5 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Manual Lesson
                      </button>
                    </div>
                  )}
                </div>
                {lessons.length > 0 ? lessons.map(lesson => (
                  <Link key={lesson.id} to={user?.role === 'TEACHER' ? `/lesson/edit?lessonId=${lesson.id}` : `/lesson/live?lessonId=${lesson.id}`} className="block">
                    <article className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100/10 p-6 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white">
                          <span className="material-symbols-outlined">auto_stories</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900 group-hover:text-secondary transition-colors">{lesson.title}</p>
                          <p className="text-xs text-slate-500">
                            {lesson.status === 'LIVE' && <span className="text-tertiary font-bold">● LIVE</span>}
                            {lesson.status === 'DRAFT' && <span className="text-slate-400">Draft</span>}
                            {lesson.status === 'PUBLISHED' && <span className="text-secondary">Published</span>}
                            {' • '}{formatDate(lesson.created_at)}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-secondary transition-colors">chevron_right</span>
                      </div>
                    </article>
                  </Link>
                )) : (
                  <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100/10 p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">auto_stories</span>
                    <p className="text-slate-400 text-sm">No lessons yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
      
      {/* FAB for Teachers */}
      {user?.role === 'TEACHER' && (
        <button
          onClick={() => { setCreateError(''); setShowCreateAssignment(true); }}
          disabled={isArchivedClass}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      )}

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateAssignment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Create Assignment</h2>
            <p className="text-sm text-on-surface-variant mb-6">Add a new assignment for your class.</p>
            {createError && <div className="text-error text-sm mb-4 bg-error-container/30 p-3 rounded-lg">{createError}</div>}
            <form onSubmit={handleCreateAssignment} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Title *</label>
                <input
                  type="text"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  required
                  placeholder="e.g., Chapter 3 Review"
                  className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Description</label>
                <textarea
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  placeholder="Assignment instructions..."
                  rows={3}
                  className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Due Date</label>
                <input
                  type="datetime-local"
                  value={assignDue}
                  onChange={(e) => setAssignDue(e.target.value)}
                  className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateAssignment(false)} className="flex-1 py-3 rounded-full border-2 border-outline/30 text-on-surface font-semibold hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" disabled={createLoading} className="flex-1 py-3 rounded-full signature-gradient text-white font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50">
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Lesson Modal */}
      {showCreateLesson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateLesson(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Create Lesson</h2>
            <p className="text-sm text-on-surface-variant mb-6">Create a new interactive lesson for your class.</p>
            {lessonCreateError && <div className="text-error text-sm mb-4 bg-error-container/30 p-3 rounded-lg">{lessonCreateError}</div>}
            <form onSubmit={handleCreateLesson} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Lesson Title *</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  required
                  placeholder="e.g., Introduction to Neural Networks"
                  className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateLesson(false)} className="flex-1 py-3 rounded-full border-2 border-outline/30 text-on-surface font-semibold hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" disabled={lessonCreateLoading} className="flex-1 py-3 rounded-full bg-secondary text-white font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50">
                  {lessonCreateLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate AI Lesson Modal */}
      {showGenerateAi && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !aiLoading && setShowGenerateAi(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full signature-gradient flex items-center justify-center text-white">
                <span className="material-symbols-outlined">magic_button</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface">Generate Lesson</h2>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">Let the AI draft a complete interactive notebook for you.</p>
            {aiError && <div className="text-error text-sm mb-4 bg-error-container/30 p-3 rounded-lg overflow-y-auto max-h-32 whitespace-pre-wrap">{aiError}</div>}
            
            {aiLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-on-surface animate-pulse">Drafting lesson with AI... This may take up to 30 seconds.</p>
              </div>
            ) : (
              <form onSubmit={handleGenerateAILesson} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Topic *</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    required
                    placeholder="e.g., The Photoelectric Effect"
                    className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Reference Content (Optional)</label>
                  <textarea
                    value={aiReferenceContent}
                    onChange={(e) => setAiReferenceContent(e.target.value)}
                    placeholder="Paste notes, text, or specific concepts for the AI to follow..."
                    className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg min-h-[100px] resize-none"
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Target Audience</label>
                    <select
                      value={aiGrade}
                      onChange={(e) => setAiGrade(e.target.value)}
                      className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                    >
                      <option value="Middle School">Middle School</option>
                      <option value="High School">High School</option>
                      <option value="College Undergraduate">College</option>
                      <option value="Professional / Advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Duration (mins)</label>
                    <input
                      type="number"
                      value={aiDuration}
                      onChange={(e) => setAiDuration(e.target.value)}
                      min="5" max="120"
                      className="w-full bg-surface-container-high border-b-2 border-outline/50 focus:border-primary focus:ring-0 px-3 py-3 transition-colors outline-none text-on-surface rounded-t-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowGenerateAi(false)} className="flex-1 py-3 rounded-full border-2 border-outline/30 text-on-surface font-semibold hover:bg-surface-container-high transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-full signature-gradient text-white font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95">
                    Generate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showClassInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowClassInfo(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Class Information</h2>
            <p className="text-sm text-on-surface-variant mb-6">Quick summary of this class stream.</p>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Class ID:</span> <span className="font-mono">{classId}</span></p>
              <p><span className="font-semibold">Assignments:</span> {assignments.length}</p>
              <p><span className="font-semibold">Lessons:</span> {lessons.length}</p>
              <p><span className="font-semibold">Role:</span> {user?.role}</p>
              <p><span className="font-semibold">Status:</span> {isArchivedClass ? 'Archived' : 'Active'}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowClassInfo(false)}
                className="px-5 py-2 rounded-full signature-gradient text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

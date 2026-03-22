import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lessonService } from '../services/api';
import useAuthStore from '../store/useAuthStore';

// Simple ID generator for local new blocks
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function LessonEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const searchParams = new URLSearchParams(location.search);
  const lessonId = searchParams.get('lessonId');

  const [lesson, setLesson] = useState(null);
  const [title, setTitle] = useState('Untitled Lesson');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI Assistant menu toggle
  const [showAiMenu, setShowAiMenu] = useState(false);
  
  // Code execution state
  const [codeOutputs, setCodeOutputs] = useState({});

  const handleRunCode = (localId, code) => {
    try {
      let output = '';
      const originalLog = console.log;
      console.log = (...args) => {
        output += args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
      };
      // eslint-disable-next-line no-eval
      eval(code);
      console.log = originalLog;
      setCodeOutputs(prev => ({ ...prev, [localId]: output || 'Done (no output)' }));
    } catch (err) {
      setCodeOutputs(prev => ({ ...prev, [localId]: `Error: ${err.message}` }));
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!lessonId) {
      navigate('/dashboard');
      return;
    }
    fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, user, navigate]);

  const fetchLesson = async () => {
    try {
      setLoading(true);
      const data = await lessonService.getById(lessonId);
      setLesson(data);
      setTitle(data.title);
      
      if (data.blocks && data.blocks.length > 0) {
        setBlocks(data.blocks.map(b => {
          let parsedContent = b.content;
          if ((b.type === 'QUIZ' || b.type === 'EXERCISE') && typeof b.content === 'string') {
            try { parsedContent = JSON.parse(b.content); } catch (e) { console.error(e); }
          }
          return { ...b, localId: b.id, content: parsedContent };
        }));
      } else {
        // Init with one empty text block
        setBlocks([{ localId: generateId(), type: 'TEXT', content: '' }]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status = lesson?.status) => {
    setSaving(true);
    setError('');
    try {
      const sanitizedBlocks = blocks.map((b) => ({
        type: b.type,
        content: (b.type === 'QUIZ' || b.type === 'EXERCISE' || b.type === 'WRITTEN_QUIZ') && typeof b.content !== 'string' ? b.content : b.content,
      }));
      
      const updatedLesson = await lessonService.update(lessonId, {
        title,
        status,
        blocks: sanitizedBlocks
      });
      
      setLesson(updatedLesson);
      // alert('Saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lesson');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (localId, newContent) => {
    setBlocks(blocks.map(b => b.localId === localId ? { ...b, content: newContent } : b));
  };

  const addBlock = (type) => {
    const newBlock = { 
      localId: generateId(), 
      type, 
      content: (type === 'QUIZ' || type === 'EXERCISE') ? { question: '', options: [{text: '', isCorrect: true, feedback: ''}, {text: '', isCorrect: false, feedback: ''}], timeLimit: 30 } : 
               (type === 'WRITTEN_QUIZ') ? { question: '', idealAnswer: '' } : '' 
    };
    setBlocks([...blocks, newBlock]);
    setShowAiMenu(false);
  };

  const deleteBlock = (localId) => {
    setBlocks(blocks.filter(b => b.localId !== localId));
  };

  const moveBlock = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === blocks.length - 1) return;
    
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  // UI rendering helpers for blocks
  const renderBlock = (block, index) => {
    if (block.type === 'TEXT') {
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-outline tracking-widest uppercase">
            <span className="material-symbols-outlined text-sm">subject</span> Explanation
          </div>
          <textarea 
            className="w-full text-lg leading-relaxed text-on-surface bg-transparent resize-y outline-none border-b border-transparent focus:border-primary/30 transition-colors"
            placeholder="Type explanation here..."
            rows={4}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
          />
        </section>
      );
    }
    
    if (block.type === 'CODE') {
      return (
        <section key={block.localId} className="group relative bg-[#1c1f21] text-secondary-fixed rounded-xl p-8 font-mono text-sm transition-all hover:shadow-xl notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} dark />
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-outline-variant text-xs font-bold tracking-widest uppercase">
              <span className="material-symbols-outlined text-sm">code</span> Code Snippet
            </div>
            <button onClick={() => handleRunCode(block.localId, block.content)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors" type="button"><span className="material-symbols-outlined text-sm">play_arrow</span> RUN</button>
          </div>
          <textarea
            className="w-full text-primary-fixed bg-transparent resize-y outline-none font-mono"
            placeholder="# Write python code here..."
            rows={6}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
            spellCheck={false}
          />
          {codeOutputs[block.localId] && (
            <div className="mt-4 p-4 bg-black/40 rounded-lg border border-white/5 font-mono text-xs text-secondary-fixed-dim">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] font-bold text-outline-variant uppercase">Output:</div>
                <button onClick={() => setCodeOutputs(prev => ({ ...prev, [block.localId]: null }))} className="text-[10px] uppercase text-error hover:text-error/80">Clear</button>
              </div>
              <pre className="whitespace-pre-wrap">{codeOutputs[block.localId]}</pre>
            </div>
          )}
        </section>
      );
    }
    
    if (block.type === 'DISCUSSION') {
      return (
        <section key={block.localId} className="group relative bg-primary-fixed rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-on-primary-fixed-variant tracking-widest uppercase">
            <span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt
          </div>
          <textarea
            className="w-full text-xl font-medium text-on-primary-fixed bg-transparent resize-y outline-none"
            placeholder="What should students discuss?"
            rows={3}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
          />
        </section>
      );
    }
    
    if (block.type === 'QUIZ' || block.type === 'EXERCISE') {
      const qData = typeof block.content === 'object' ? block.content : { question: '', options: [], timeLimit: 30 };
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className={`flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase ${block.type === 'EXERCISE' ? 'text-primary' : 'text-secondary'}`}>
            <span className="material-symbols-outlined text-sm">{block.type === 'EXERCISE' ? 'menu_book' : 'quiz'}</span> {block.type === 'EXERCISE' ? 'Check for Understanding' : 'Quick Quiz'}
          </div>
          {block.type === 'QUIZ' && (
            <div className="mb-6 flex items-center gap-4">
              <label className="text-sm font-semibold text-outline-variant">Time Limit (seconds):</label>
              <input 
                type="number" 
                min="10"
                className="w-24 bg-surface-container-low border border-outline-variant rounded-md px-3 py-1 text-on-surface outline-none focus:border-primary" 
                value={qData.timeLimit === undefined ? 30 : qData.timeLimit}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    updateBlock(block.localId, { ...qData, timeLimit: 0 });
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      updateBlock(block.localId, { ...qData, timeLimit: parsed });
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 10) {
                    updateBlock(block.localId, { ...qData, timeLimit: 10 });
                  }
                }}
              />
            </div>
          )}
          <input 
            type="text" 
            className="w-full text-xl font-semibold mb-6 bg-transparent outline-none border-b border-outline-variant focus:border-primary pb-2" 
            placeholder="Question goes here..."
            value={qData.question || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, question: e.target.value })}
          />
          <div className="space-y-3">
            {(qData.options || []).map((opt, optIndex) => (
              <div key={optIndex} className={`flex items-center p-4 rounded-lg bg-surface-container-low border transition-all ${opt.isCorrect ? 'border-primary bg-primary/5' : 'border-transparent'}`}>
                <button 
                  onClick={() => {
                    const newOpts = [...qData.options];
                    newOpts.forEach(o => o.isCorrect = false);
                    newOpts[optIndex].isCorrect = true;
                    updateBlock(block.localId, { ...qData, options: newOpts });
                  }}
                  className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${opt.isCorrect ? 'border-primary' : 'border-outline hover:border-primary'}`}
                >
                  {opt.isCorrect && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                </button>
                <input 
                  type="text" 
                  className={`w-full bg-transparent outline-none font-medium ${opt.isCorrect ? 'text-primary' : 'text-on-surface'}`}
                  placeholder={`Option ${optIndex + 1}`}
                  value={opt.text}
                  onChange={(e) => {
                    const newOpts = [...qData.options];
                    newOpts[optIndex].text = e.target.value;
                    updateBlock(block.localId, { ...qData, options: newOpts });
                  }}
                />
                {block.type === 'EXERCISE' && (
                  <input 
                    type="text" 
                    className="w-full bg-transparent outline-none font-medium ml-4 text-xs text-outline-variant italic border-l pl-4"
                    placeholder={`Feedback ${optIndex + 1}`}
                    value={opt.feedback || ''}
                    onChange={(e) => {
                      const newOpts = [...qData.options];
                      newOpts[optIndex].feedback = e.target.value;
                      updateBlock(block.localId, { ...qData, options: newOpts });
                    }}
                  />
                )}
                <button onClick={() => {
                   const newOpts = qData.options.filter((_, i) => i !== optIndex);
                   updateBlock(block.localId, { ...qData, options: newOpts });
                }} className="text-outline hover:text-error ml-2" type="button">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
            <button 
              onClick={() => {
                updateBlock(block.localId, { ...qData, options: [...(qData.options || []), { text: '', isCorrect: false, feedback: '' }] });
              }}
              className="mt-4 text-sm font-semibold text-primary hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span> Add Option
            </button>
          </div>
        </section>
      );
    }
    if (block.type === 'WRITTEN_QUIZ') {
      const qData = typeof block.content === 'object' ? block.content : { question: '', idealAnswer: '' };
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase text-amber-600">
            <span className="material-symbols-outlined text-sm">edit_document</span> Written Exercise
          </div>
          <input 
            type="text" 
            className="w-full text-xl font-semibold mb-6 bg-transparent outline-none border-b border-outline-variant focus:border-primary pb-2" 
            placeholder="Question goes here..."
            value={qData.question || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, question: e.target.value })}
          />
          <textarea
            className="w-full text-base leading-relaxed text-on-surface bg-surface-container-low rounded-lg p-4 resize-y outline-none border border-outline-variant focus:border-primary transition-colors"
            placeholder="Write the ideal answer here. AI will use this to evaluate students' answers..."
            rows={4}
            value={qData.idealAnswer || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, idealAnswer: e.target.value })}
          />
        </section>
      );
    }
    
    return null;
  };

  const BlockControls = ({ index, localId, dark = false }) => (
    <div className={`absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity bg-surface p-1 rounded-full shadow-sm border border-outline-variant/30 ${dark ? 'bg-[#2c2c2c] border-white/10' : ''}`}>
      <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className={`p-1.5 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-30 ${dark ? 'text-white' : 'text-on-surface'}`}><span className="material-symbols-outlined text-[1rem]">arrow_upward</span></button>
      <button onClick={() => deleteBlock(localId)} className="p-1.5 rounded-full hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors"><span className="material-symbols-outlined text-[1rem]">delete</span></button>
      <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className={`p-1.5 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-30 ${dark ? 'text-white' : 'text-on-surface'}`}><span className="material-symbols-outlined text-[1rem]">arrow_downward</span></button>
    </div>
  );

  if (loading) {
    return <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">Loading editor...</div>;
  }

  return (
    <div className="bg-surface text-on-surface overflow-hidden min-h-screen flex flex-col">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-[#f8f9fa]/80 dark:bg-[#191c1d]/80 backdrop-blur-xl shadow-sm border-b border-outline-variant/20 flex justify-between items-center px-8 h-16 w-full">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-xl font-bold text-[#191c1d] dark:text-white tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">school</span>
            Academic Atelier
          </Link>
          <div className="hidden md:flex gap-6 border-l border-outline-variant/30 pl-6 ml-2">
            <Link to={`/class/stream?classId=${lesson?.class_id}`} className="font-['Inter'] font-medium text-sm tracking-tight text-[#727785] hover:text-[#191c1d] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Class
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block mr-2 text-sm text-outline font-medium">
            {saving ? 'Saving...' : 'All changes saved locally'}
          </div>
          <button 
            onClick={() => handleSave(lesson.status)} 
            disabled={saving}
            className="flex items-center gap-2 bg-surface text-primary border border-primary px-4 py-1.5 rounded-full font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            Save
          </button>
          <button 
            onClick={() => handleSave('PUBLISHED')}
            disabled={saving || lesson.status === 'PUBLISHED'}
            className="bg-secondary text-white px-5 py-1.5 rounded-full font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {lesson.status === 'PUBLISHED' ? 'Published' : 'Publish'}
          </button>
          <Link 
            to={`/lesson/live?lessonId=${lessonId}`}
            className="flex items-center gap-1 bg-emerald-500 text-white px-5 py-1.5 rounded-full font-semibold shadow-md active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">present_to_all</span> Present
          </Link>
        </div>
      </nav>
      
      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Main Content Area (Editor Canvas) */}
        <main className="flex-1 overflow-y-auto bg-surface-container-low px-4 md:px-12 py-12 scroll-smooth">
          <div className="max-w-3xl mx-auto min-h-full pb-32">
            {error && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}
            
            {/* Lesson Header */}
            <div className="mb-12">
              <span className="text-label-md uppercase tracking-[0.2em] text-primary font-bold mb-4 block">Interactive Notebook • {lesson?.class?.name || 'Class'}</span>
              <input 
                className="w-full text-[3rem] font-bold text-on-surface leading-tight tracking-tight mb-4 outline-none bg-transparent placeholder-outline-variant"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson Title"
              />
            </div>
            
            {/* Interactive Blocks Container */}
            <div className="space-y-4">
              {blocks.map((block, index) => renderBlock(block, index))}
            </div>
            
            {/* Inline Add Block Actions */}
            <div className="mt-8 pt-8 border-t border-dashed border-outline-variant/40 flex justify-center gap-2">
              <button onClick={() => addBlock('TEXT')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">subject</span> Text
              </button>
              <button onClick={() => addBlock('CODE')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">code</span> Code
              </button>
              <button onClick={() => addBlock('EXERCISE')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">menu_book</span> Exercise
              </button>
              <button onClick={() => addBlock('QUIZ')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">quiz</span> Quiz
              </button>
              <button onClick={() => addBlock('DISCUSSION')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">forum</span> Prompt
              </button>
              <button onClick={() => addBlock('WRITTEN_QUIZ')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">edit_document</span> Written
              </button>
            </div>
          </div>
        </main>
      </div>
      
      {/* AI Assistant Floating Menu */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end z-[60]">
        {showAiMenu && (
          <div className="bg-surface shadow-2xl rounded-2xl p-4 w-64 border border-outline-variant/20 mb-4 animate-in slide-in-from-bottom-2">
            <p className="text-xs font-bold text-primary mb-2">ADD BLOCK</p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => addBlock('TEXT')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">subject</span> Explanation</button>
              <button onClick={() => addBlock('CODE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">code</span> Python Script</button>
              <button onClick={() => addBlock('EXERCISE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">menu_book</span> Exercise MCQ</button>
              <button onClick={() => addBlock('QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">quiz</span> Quick Quiz</button>
              <button onClick={() => addBlock('WRITTEN_QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">edit_document</span> Written Quiz</button>
              <button onClick={() => addBlock('DISCUSSION')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt</button>
            </div>
          </div>
        )}
        <button 
          onClick={() => setShowAiMenu(!showAiMenu)}
          className="bg-gradient-to-br from-primary to-primary-container text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">{showAiMenu ? 'close' : 'add'}</span>
        </button>
      </div>
    </div>
  );
}

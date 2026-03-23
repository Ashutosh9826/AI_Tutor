import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lessonService } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import InteractiveSimulationBlock from '../components/InteractiveSimulationBlock';
import CodeNotebookBlock from '../components/CodeNotebookBlock';

// Simple ID generator for local new blocks
const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultSimulationContent = () => ({
  title: 'Interactive Simulation',
  description: 'Describe what this simulation teaches.',
  hint: '',
  solutionText: '',
  html: '<div id="app"></div>',
  css: '',
  js: '// Simulation code - use context.app, context.input, context.helpers\nconst { app } = context;\napp.innerHTML = "<h3>Hello Simulation!</h3><p>Edit the code to build your visualization.</p>";',
  libs: [],
  height: 420,
  inputJson: '{}',
});

const BLOCK_TYPES_WITH_OBJECT_CONTENT = new Set([
  'QUIZ',
  'EXERCISE',
  'WRITTEN_QUIZ',
  'INTERACTIVE_SIMULATION',
]);

const defaultQuizContent = () => ({
  question: '',
  options: [
    { text: '', isCorrect: true, feedback: '' },
    { text: '', isCorrect: false, feedback: '' },
  ],
  timeLimit: 30,
});

const defaultWrittenQuizContent = () => ({
  question: '',
  idealAnswer: '',
});

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeSimulationContent = (raw) => {
  const base = defaultSimulationContent();
  const parsed = parseJsonObject(raw) || {};

  if (parsed.canvasSandbox && typeof parsed.canvasSandbox === 'object' && parsed.canvasSandbox.enabled) {
    const legacySandbox = parsed.canvasSandbox;
    return {
      ...base,
      title: typeof parsed.title === 'string' ? parsed.title : base.title,
      description: typeof parsed.description === 'string' ? parsed.description : base.description,
      hint: typeof parsed.hint === 'string' ? parsed.hint : base.hint,
      solutionText: typeof parsed.solutionText === 'string' ? parsed.solutionText : base.solutionText,
      html: typeof legacySandbox.html === 'string' ? legacySandbox.html : base.html,
      css: typeof legacySandbox.css === 'string' ? legacySandbox.css : base.css,
      js: typeof legacySandbox.js === 'string' ? legacySandbox.js : base.js,
      libs: Array.isArray(legacySandbox.libs) ? legacySandbox.libs : base.libs,
      height: Number(legacySandbox.height) > 0 ? Number(legacySandbox.height) : base.height,
      inputJson:
        typeof legacySandbox.inputJson === 'string'
          ? legacySandbox.inputJson
          : JSON.stringify(legacySandbox.inputJson ?? {}),
    };
  }

  return {
    ...base,
    title: typeof parsed.title === 'string' ? parsed.title : base.title,
    description: typeof parsed.description === 'string' ? parsed.description : base.description,
    hint: typeof parsed.hint === 'string' ? parsed.hint : base.hint,
    solutionText: typeof parsed.solutionText === 'string' ? parsed.solutionText : base.solutionText,
    html: typeof parsed.html === 'string' ? parsed.html : base.html,
    css: typeof parsed.css === 'string' ? parsed.css : base.css,
    js: typeof parsed.js === 'string' ? parsed.js : base.js,
    libs: Array.isArray(parsed.libs) ? parsed.libs.filter((v) => typeof v === 'string') : base.libs,
    height: Number(parsed.height) > 0 ? Number(parsed.height) : base.height,
    inputJson:
      typeof parsed.inputJson === 'string'
        ? parsed.inputJson
        : JSON.stringify(parsed.inputJson ?? {}),
  };
};

const getDefaultContentForType = (type) => {
  if (type === 'QUIZ' || type === 'EXERCISE') return defaultQuizContent();
  if (type === 'WRITTEN_QUIZ') return defaultWrittenQuizContent();
  if (type === 'INTERACTIVE_SIMULATION') return defaultSimulationContent();
  return '';
};

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
  
  // Code execution is now handled inside CodeNotebookBlock (sandboxed iframe)

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
        setBlocks(
          data.blocks.map((b) => {
            let parsedContent = b.content;

            if (BLOCK_TYPES_WITH_OBJECT_CONTENT.has(b.type)) {
              const parsed = parseJsonObject(b.content);
              if (b.type === 'INTERACTIVE_SIMULATION') {
                parsedContent = normalizeSimulationContent(parsed || b.content);
              } else {
                parsedContent = parsed || getDefaultContentForType(b.type);
              }
            } else if (b.type === 'CODE') {
              const parsedCode = parseJsonObject(b.content);
              if (parsedCode && Array.isArray(parsedCode.cells)) {
                parsedContent = parsedCode;
              } else {
                parsedContent = typeof b.content === 'string' ? b.content : '';
              }
            }

            return { ...b, localId: b.id, content: parsedContent };
          })
        );
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
        content: b.content,
      }));
      
      const updatedLesson = await lessonService.update(lessonId, {
        title,
        status,
        blocks: sanitizedBlocks
      });
      
      setLesson(updatedLesson);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lesson');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (localId, newContent) => {
    setBlocks((prev) =>
      prev.map((b) => (b.localId === localId ? { ...b, content: newContent } : b))
    );
  };

  const addBlock = (type) => {
    const newBlock = {
      localId: generateId(),
      type,
      content: getDefaultContentForType(type),
    };
    setBlocks((prev) => [...prev, newBlock]);
    setShowAiMenu(false);
  };

  const deleteBlock = (localId) => {
    setBlocks((prev) => prev.filter((b) => b.localId !== localId));
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
        <section key={block.localId} className="group relative mb-8">
          <BlockControls index={index} localId={block.localId} dark />
          <CodeNotebookBlock
            content={block.content}
            onChange={(v) => updateBlock(block.localId, v)}
            editable
            blockId={block.localId}
          />
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

    if (block.type === 'INTERACTIVE_SIMULATION') {
      const simData = normalizeSimulationContent(block.content);
      const updateSimulation = (changes) => updateBlock(block.localId, { ...simData, ...changes });
      const libsToText = (libs) => (Array.isArray(libs) ? libs.join('\n') : '');
      const parseLibsText = (text) =>
        text
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => /^https?:\/\/\S+$/i.test(s));

      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase text-primary">
            <span className="material-symbols-outlined text-sm">experiment</span> Interactive Simulation
          </div>

          {/* Title & Height */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Title</label>
              <input type="text" className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={simData.title || ''} onChange={(e) => updateSimulation({ title: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Height (px)</label>
              <input type="number" min={280} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={Number(simData.height) > 0 ? Number(simData.height) : 420} onChange={(e) => updateSimulation({ height: Number(e.target.value) || 420 })} />
            </div>
          </div>

          {/* Description, Hint, Solution */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Description</label>
              <textarea rows={2} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y" value={simData.description || ''} onChange={(e) => updateSimulation({ description: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Hint</label>
              <input type="text" className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={simData.hint || ''} onChange={(e) => updateSimulation({ hint: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Solution Text</label>
              <textarea rows={2} className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y" value={simData.solutionText || ''} onChange={(e) => updateSimulation({ solutionText: e.target.value })} />
            </div>
          </div>

          {/* Canvas Code Editors */}
          <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-4 space-y-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Canvas Code</p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">HTML Markup</label>
              <textarea rows={5} className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y" value={typeof simData.html === 'string' ? simData.html : ''} onChange={(e) => updateSimulation({ html: e.target.value })} spellCheck={false} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">CSS Styles</label>
              <textarea rows={5} className="w-full bg-[#1c1f21] text-slate-100 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y" value={typeof simData.css === 'string' ? simData.css : ''} onChange={(e) => updateSimulation({ css: e.target.value })} spellCheck={false} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">JavaScript</label>
              <textarea rows={12} className="w-full bg-[#1c1f21] text-slate-100 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y" value={typeof simData.js === 'string' ? simData.js : ''} onChange={(e) => updateSimulation({ js: e.target.value })} spellCheck={false} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">External Libraries (one URL per line)</label>
              <textarea rows={2} className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y" placeholder="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js" value={libsToText(simData.libs)} onChange={(e) => updateSimulation({ libs: parseLibsText(e.target.value) })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Input JSON</label>
              <textarea
                rows={3}
                className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                placeholder='{"value":10,"speed":2}'
                value={typeof simData.inputJson === 'string' ? simData.inputJson : JSON.stringify(simData.inputJson ?? {}, null, 2)}
                onChange={(e) => updateSimulation({ inputJson: e.target.value })}
              />
            </div>
            <p className="text-[11px] text-outline">
              Use <code>context.app</code>, <code>context.input</code>, and <code>context.helpers</code> in your JavaScript.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-outline-variant/20 p-4 bg-surface-container-low">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-3">Preview</p>
            <InteractiveSimulationBlock block={{ ...block, content: simData }} compact />
          </div>
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
              <button onClick={() => addBlock('INTERACTIVE_SIMULATION')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">experiment</span> Simulation
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
              <button onClick={() => addBlock('CODE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">code</span> Code Cell</button>
              <button onClick={() => addBlock('EXERCISE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">menu_book</span> Exercise MCQ</button>
              <button onClick={() => addBlock('QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">quiz</span> Quick Quiz</button>
              <button onClick={() => addBlock('WRITTEN_QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">edit_document</span> Written Quiz</button>
              <button onClick={() => addBlock('DISCUSSION')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt</button>
              <button onClick={() => addBlock('INTERACTIVE_SIMULATION')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">experiment</span> Interactive Simulation</button>
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

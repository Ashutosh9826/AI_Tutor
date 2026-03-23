import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import { chatService, lessonService } from '../services/api';
import ChatAssistant from '../components/ChatAssistant';
import InteractiveQuiz from '../components/InteractiveQuiz';
import WrittenQuiz from '../components/WrittenQuiz';
import InteractiveSimulationBlock from '../components/InteractiveSimulationBlock';
import CodeNotebookBlock from '../components/CodeNotebookBlock';
import TeacherControlPanel from '../components/TeacherControlPanel';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

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
  const parsed = parseJsonObject(raw) || {};
  const legacySandbox = parsed.canvasSandbox && typeof parsed.canvasSandbox === 'object' ? parsed.canvasSandbox : null;

  const html = legacySandbox ? legacySandbox.html : parsed.html;
  const css = legacySandbox ? legacySandbox.css : parsed.css;
  const js = legacySandbox ? legacySandbox.js : parsed.js;
  const libs = legacySandbox ? legacySandbox.libs : parsed.libs;
  const height = legacySandbox ? legacySandbox.height : parsed.height;
  const inputJson = legacySandbox ? legacySandbox.inputJson : parsed.inputJson;

  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Interactive Simulation',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    hint: typeof parsed.hint === 'string' ? parsed.hint : '',
    solutionText: typeof parsed.solutionText === 'string' ? parsed.solutionText : '',
    html: typeof html === 'string' ? html : '<div id="app"></div>',
    css: typeof css === 'string' ? css : '',
    js: typeof js === 'string' ? js : '',
    libs: Array.isArray(libs) ? libs.filter((v) => typeof v === 'string') : [],
    height: Number(height) > 0 ? Number(height) : 420,
    inputJson: typeof inputJson === 'string' ? inputJson : JSON.stringify(inputJson ?? {}),
  };
};

const normalizeCodeContent = (raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== 'string') {
    return '';
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.cells)) {
        return parsed;
      }
    } catch {
      // Keep legacy string code blocks as-is.
    }
  }

  return raw;
};

const normalizeLessonBlock = (block) => {
  if (block.type === 'INTERACTIVE_SIMULATION') {
    return { ...block, content: normalizeSimulationContent(block.content) };
  }

  if (block.type === 'QUIZ' || block.type === 'EXERCISE' || block.type === 'WRITTEN_QUIZ') {
    return {
      ...block,
      content: parseJsonObject(block.content) || {},
    };
  }

  if (block.type === 'CODE') {
    return {
      ...block,
      content: normalizeCodeContent(block.content),
    };
  }

  return block;
};

export default function LiveLessonView() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const lessonId = searchParams.get('lessonId');

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // AI Chat state
  const [messages, setMessages] = useState([
    { id: 1, sender: 'System', role: 'SYSTEM', text: 'Welcome to the live session! I am your AI assistant. How can I help you today?' }
  ]);
  const [isChatLocked, setIsChatLocked] = useState(false); // 2. Add isChatLocked state
  
  // Quiz State via Sockets
  // activeQuizzes: { [blockId]: true/false }
  const [activeQuizzes, setActiveQuizzes] = useState({});
  // quizResults: { [blockId]: { [optionIdx]: count } }
  const [quizResults, setQuizResults] = useState({});
  // Code execution is now self-contained within CodeNotebookBlock (sandboxed iframe)
  const [exerciseStates, setExerciseStates] = useState({}); // { [blockId]: { selectedIndex, submitted: boolean } }
  const [leaderboard, setLeaderboard] = useState({}); // { [userId]: { name, score, count } }
  const [quizPhase, setQuizPhase] = useState('CONTENT'); // 'CONTENT', 'COMPETITION', 'RANKING'
  const [showLeaderboardSidebar, setShowLeaderboardSidebar] = useState(false);

  const [studentCount, setStudentCount] = useState(1);
  const [understandingPercent, setUnderstandingPercent] = useState(100);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!lessonId) {
      navigate('/dashboard');
      return;
    }

    // 1. Fetch Lesson Data
    const fetchLesson = async () => {
      try {
        const data = await lessonService.getById(lessonId);
        if (data.blocks) {
          data.blocks = data.blocks.map(normalizeLessonBlock);
        }
        setLesson(data);
      } catch (err) {
        console.error('Failed to load lesson:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();

    // 2. Setup Socket
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
      socketRef.current.emit('join_lesson', lessonId);
    });

    socketRef.current.on('quiz_started', (data) => {
      if (data.lessonId === lessonId) {
        setActiveQuizzes(prev => ({ ...prev, [data.blockId]: true }));
      }
    });

    socketRef.current.on('quiz_stopped', (data) => {
      if (data.lessonId === lessonId) {
        setActiveQuizzes(prev => ({ ...prev, [data.blockId]: false }));
      }
    });

    socketRef.current.on('answer_received', (data) => {
      if (data.lessonId === lessonId) {
        // Update vote counts
        setQuizResults(prev => {
          const currentBlockResults = prev[data.blockId] || {};
          const currentCount = currentBlockResults[data.optionIndex] || 0;
          return {
            ...prev,
            [data.blockId]: {
              ...currentBlockResults,
              [data.optionIndex]: currentCount + 1
            }
          };
        });

        // Update competitive leaderboard
        if (data.score > 0 && data.userId) {
          setLeaderboard(prev => {
            const current = prev[data.userId] || { name: data.userName, score: 0, count: 0 };
            return {
              ...prev,
              [data.userId]: {
                ...current,
                score: current.score + data.score,
                count: current.count + 1
              }
            };
          });
        }
      }
    });

    // 2. Add socket listeners for chat lock/unlock
    socketRef.current.on('chat_locked', () => {
      setIsChatLocked(true);
    });

    socketRef.current.on('chat_unlocked', () => {
      setIsChatLocked(false);
    });

    socketRef.current.on('attendance_updated', (data) => {
      setStudentCount(data.count);
    });

    socketRef.current.on('start_final_quiz', () => {
      setQuizPhase('WAITING');
      // Auto-transition to competition after some hype?
      setTimeout(() => setQuizPhase('CONTENT'), 3000); 
    });

    socketRef.current.on('show_leaderboard', () => {
      setQuizPhase('RANKING');
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [lessonId, user, navigate]);

  useEffect(() => {
    const socket = socketRef.current;
    const classId = lesson?.class_id;
    if (!socket || !classId || !user?.id) return undefined;

    const joinPayload = {
      classId,
      userId: user.id,
      role: user.role,
    };

    const handleConnect = () => {
      socket.emit('join_class_presence', joinPayload);
    };

    socket.on('connect', handleConnect);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.emit('leave_class_presence', {
        classId,
        userId: user.id,
      });
    };
  }, [lesson?.class_id, user?.id, user?.role]);

  // Recalculate understanding percent
  useEffect(() => {
    let totalAnswers = 0;
    let correctAnswers = 0;

    if (lesson && lesson.blocks) {
      lesson.blocks.forEach(block => {
        if (block.type === 'QUIZ' && quizResults[block.id]) {
          const qData = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
          const correctIdx = qData.options?.findIndex(o => o.isCorrect);
          
          Object.entries(quizResults[block.id]).forEach(([optIdx, count]) => {
            totalAnswers += count;
            if (parseInt(optIdx) === correctIdx) {
              correctAnswers += count;
            }
          });
        }
      });
    }

    if (totalAnswers > 0) {
      setUnderstandingPercent(Math.round((correctAnswers / totalAnswers) * 100));
    } else {
      setUnderstandingPercent(100);
    }
  }, [quizResults, lesson]);

  // Chat Actions
  const handleSendMessage = async (text) => {
    if (!text.trim() || !user || isChatLocked) return; // Prevent sending if chat is locked

    const msgData = {
      id: Date.now(),
      lessonId,
      sender: user.name,
      role: 'USER',
      text: text,
    };

    const updatedMessages = [...messages, msgData];
    setMessages(updatedMessages);
    
    try {
      const aiResponse = await chatService.sendMessage(lessonId, updatedMessages);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        sender: 'Atelier Assistant',
        role: 'ASSISTANT',
        text: aiResponse.text
      }]);
    } catch (err) {
      console.error('AI Chat Error:', err);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        sender: 'System',
        role: 'SYSTEM',
        text: 'Sorry, the AI Assistant is currently unreachable.'
      }]);
    }
  };

  // Quiz Actions
  const handleStartQuiz = (blockId) => {
    const block = lesson?.blocks.find(b => b.id === blockId);
    const qData = typeof block?.content === 'string' ? JSON.parse(block.content) : block?.content;
    const timeLimit = qData?.timeLimit || 30;

    socketRef.current.emit('start_quiz', { lessonId, blockId, timeLimit });
    setActiveQuizzes(prev => ({ ...prev, [blockId]: true }));
  };

  const handleStopQuiz = (blockId) => {
    socketRef.current.emit('stop_quiz', { lessonId, blockId });
    setActiveQuizzes(prev => ({ ...prev, [blockId]: false }));
  };

  const handleSubmitAnswer = (blockId, optionIndex) => {
    socketRef.current.emit('submit_answer', { 
      lessonId, 
      blockId, 
      optionIndex, 
      userId: user.id, 
      userName: user.name 
    });
  };

  const handleLiveCodeChange = (blockId, nextContent) => {
    setLesson((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        blocks: (prev.blocks || []).map((block) =>
          block.id === blockId ? { ...block, content: nextContent } : block
        ),
      };
    });
  };

  // Code execution is handled inside CodeNotebookBlock via sandboxed iframe

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">Joining Live Session...</div>;
  }

  if (!lesson) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">Lesson not found.</div>;
  }

  return (
    <div className="bg-background text-on-surface overflow-hidden h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9fa]/80 dark:bg-[#191c1d]/80 backdrop-blur-xl shadow-sm border-b border-outline-variant/20">
        <div className="flex justify-between items-center px-8 h-16 w-full">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-xl font-bold text-[#191c1d] dark:text-white tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              Academic Atelier
            </Link>
            <div className="hidden md:flex gap-6 border-l border-outline-variant/30 pl-6 ml-2">
              {user?.role === 'TEACHER' ? (
                <Link to={`/lesson/edit?lessonId=${lesson?.id}`} className="font-['Inter'] font-medium text-sm tracking-tight text-[#727785] hover:text-error transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">stop_circle</span>
                  Stop Presenting
                </Link>
              ) : (
                <Link to={`/class/stream?classId=${lesson?.class_id}`} className="font-['Inter'] font-medium text-sm tracking-tight text-[#727785] hover:text-[#191c1d] transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Exit Live Session
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-container flex items-center justify-center text-primary font-bold">
               {user?.name?.charAt(0) || 'U'}
             </div>
          </div>
        </div>
      </header>
      
      {/* Main Layout Container */}
      <main className="flex-1 flex pt-16 h-full overflow-hidden">
        {/* Left Side: Scrollable Notebook Content */}
        <section className={`w-full flex flex-col h-full bg-surface ${user?.role === 'STUDENT' ? 'lg:w-3/4' : 'mx-auto max-w-5xl'}`}>
          {/* Session Header Chip */}
          <div className="px-8 py-4 flex items-center justify-between border-b border-surface-container bg-surface-container-lowest">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-error-container text-on-error-container rounded-full">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                <span className="text-xs font-bold tracking-widest uppercase">Live</span>
              </div>
              <h1 className="text-2xl font-bold text-on-surface tracking-tight">{lesson.title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[0.65rem] uppercase tracking-widest font-bold text-outline">You are</p>
                <p className="text-sm font-medium text-primary">{user?.role}</p>
              </div>
            </div>
          </div>
          
          {/* Notebook Canvas */}
          <div className="flex-1 overflow-y-auto px-8 md:px-12 lg:px-20 py-12 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
            <div className="max-w-3xl mx-auto space-y-12 pb-32">
              
              {(!lesson.blocks || lesson.blocks.length === 0) && (
                <div className="text-center text-outline-variant py-20 italic">
                  This lesson has no content blocks yet.
                </div>
              )}

              {(lesson.blocks || []).map((block) => {
                if (block.type === 'TEXT') {
                  return (
                    <article key={block.id} className="space-y-4">
                       <div className="flex items-center gap-2 mb-2 text-xs font-bold text-outline-variant tracking-widest uppercase">
                        <span className="material-symbols-outlined text-sm">subject</span> Explanation
                      </div>
                      <div className="text-lg text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                        {block.content}
                      </div>
                    </article>
                  );
                }
                if (block.type === 'CODE') {
                  return (
                    <article key={block.id}>
                      <CodeNotebookBlock
                        content={block.content}
                        onChange={(next) => handleLiveCodeChange(block.id, next)}
                        editable
                        blockId={block.id}
                      />
                    </article>
                  );
                }
                if (block.type === 'DISCUSSION') {
                  return (
                    <article key={block.id} className="bg-primary-fixed rounded-xl p-8 shadow-sm border border-primary/20">
                      <div className="flex items-center gap-2 mb-4 text-xs font-bold text-on-primary-fixed-variant tracking-widest uppercase">
                        <span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt
                      </div>
                      <div className="text-xl font-medium text-on-primary-fixed italic">
                        "{block.content}"
                      </div>
                    </article>
                  );
                }
                if (block.type === 'EXERCISE') {
                  const exerciseData = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
                  const state = exerciseStates[block.id] || { selectedIndex: null, submitted: false };
                  
                  return (
                    <article key={block.id} className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-8 shadow-sm space-y-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary tracking-widest uppercase">
                        <span className="material-symbols-outlined text-sm">menu_book</span> Check for Understanding
                      </div>
                      <p className="text-lg font-medium text-on-surface">
                        {exerciseData?.question}
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {(exerciseData?.options || []).map((opt, idx) => {
                          const isSelected = state.selectedIndex === idx;
                          const showFeedback = state.submitted;
                          const isCorrect = opt.isCorrect;
                          
                          return (
                            <button 
                              key={idx}
                              onClick={() => !state.submitted && setExerciseStates(prev => ({ ...prev, [block.id]: { ...state, selectedIndex: idx } }))}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                showFeedback 
                                  ? isCorrect 
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700' 
                                    : (isSelected ? 'bg-rose-500/10 border-rose-500 text-rose-700' : 'bg-surface border-outline-variant opacity-60')
                                  : isSelected 
                                    ? 'bg-primary/5 border-primary ring-2 ring-primary/20' 
                                    : 'bg-surface border-outline-variant hover:border-primary/50'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{opt.text}</span>
                                {showFeedback && isCorrect && <span className="material-symbols-outlined text-emerald-500">check_circle</span>}
                                {showFeedback && isSelected && !isCorrect && <span className="material-symbols-outlined text-rose-500">cancel</span>}
                              </div>
                              {showFeedback && isSelected && (
                                <div className="mt-2 text-xs opacity-80 italic animate-in slide-in-from-top-1">
                                  {opt.feedback || (isCorrect ? "Correct!" : "Try again.")}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {!state.submitted && (
                        <div className="flex justify-end">
                          <button 
                            disabled={state.selectedIndex === null}
                            onClick={() => setExerciseStates(prev => ({ ...prev, [block.id]: { ...state, submitted: true } }))}
                            className="bg-primary text-white px-6 py-2 rounded-full text-sm font-bold disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-md"
                          >
                            CHECK ANSWER
                          </button>
                        </div>
                      )}
                    </article>
                  );
                }
                if (block.type === 'QUIZ') {
                  return (
                    <InteractiveQuiz 
                      key={block.id}
                      block={block}
                      userRole={user?.role}
                      isActive={activeQuizzes[block.id] || false}
                      onStart={handleStartQuiz}
                      onStop={handleStopQuiz}
                      onSubmit={handleSubmitAnswer}
                      results={quizResults[block.id] || {}}
                    />
                  );
                }
                if (block.type === 'WRITTEN_QUIZ') {
                  return (
                    <WrittenQuiz 
                      key={block.id}
                      block={block}
                      userRole={user?.role}
                    />
                  );
                }
                if (block.type === 'INTERACTIVE_SIMULATION') {
                  return (
                    <InteractiveSimulationBlock
                      key={block.id}
                      block={block}
                    />
                  );
                }
                return null;
              })}
              
            </div>
          </div>
        </section>
        
        {/* Right Side: AI Assistant Chat Sidebar / Leaderboard */}
        <aside className="hidden lg:flex w-1/4 flex-col border-l border-surface-container-high bg-surface-container-low h-full">
          <div className="flex bg-surface-container p-2 gap-2 border-b border-surface-container-high shrink-0 z-10 w-full">
            <button 
              onClick={() => setShowLeaderboardSidebar(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${!showLeaderboardSidebar ? 'bg-surface shadow text-primary font-black' : 'text-outline hover:bg-surface-container-highest'}`}
            >
              <span className="material-symbols-outlined text-[1rem]">forum</span> Chat
            </button>
            <button 
              onClick={() => setShowLeaderboardSidebar(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${showLeaderboardSidebar ? 'bg-surface shadow text-amber-500 font-black' : 'text-outline hover:bg-surface-container-highest'}`}
            >
              <span className="material-symbols-outlined text-[1rem]">leaderboard</span> Podium
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative w-full h-full">
            {showLeaderboardSidebar ? (
              <div className="absolute inset-0 overflow-y-auto flex flex-col p-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-amber-500/10 rounded-xl">
                    <span className="material-symbols-outlined text-amber-500">trophy</span>
                  </div>
                  <div>
                     <h2 className="text-sm font-bold text-on-surface">Live Leaderboard</h2>
                     <p className="text-[10px] text-outline uppercase tracking-widest font-bold">Real-time Ranking</p>
                  </div>
                </div>
                
                <div className="space-y-4 pb-20">
                  {Object.values(leaderboard)
                    .sort((a, b) => b.score - a.score)
                    .map((entry, i) => (
                      <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${i === 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-surface border-transparent'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-amber-500 text-white' : 
                          i === 1 ? 'bg-slate-400 text-white' : 
                          i === 2 ? 'bg-amber-700 text-white' : 'bg-surface-container-high text-outline'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-on-surface">{entry.name}</div>
                          <div className="text-[10px] text-outline">{entry.count} Questions</div>
                        </div>
                        <div className="text-sm font-mono font-bold text-primary">
                          {entry.score.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  
                  {Object.keys(leaderboard).length === 0 && (
                    <div className="text-center py-20 text-outline-variant italic text-xs">
                      Waiting for first submissions...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col animate-in slide-in-from-left-4 duration-300 h-full w-full">
                <ChatAssistant 
                  messages={messages} 
                  onSendMessage={handleSendMessage} 
                  user={user} 
                  isLocked={isChatLocked}
                />
              </div>
            )}
          </div>
        </aside>
      </main>
      {quizPhase === 'WAITING' && (
        <div className="fixed inset-0 z-[100] bg-primary flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="text-center text-white">
             <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 mx-auto animate-pulse">
               <span className="material-symbols-outlined text-6xl">rocket_launch</span>
             </div>
             <h1 className="text-6xl font-black tracking-tighter mb-4">Get Ready!</h1>
             <p className="text-xl opacity-80 font-bold uppercase tracking-widest leading-relaxed">
               The final competition is about to begin.<br/>
               Check your speed, check your facts!
             </p>
           </div>
        </div>
      )}

      {/* Phase 6: Full-screen Overlays */}
      {quizPhase === 'RANKING' && (
        <div className="fixed inset-0 z-[100] bg-surface-container-lowest flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
           <button 
             onClick={() => setQuizPhase('CONTENT')}
             className="absolute top-8 right-8 text-outline hover:text-primary transition-colors"
           >
             <span className="material-symbols-outlined text-4xl">close</span>
           </button>
           
           <div className="text-center mb-12">
             <div className="inline-block p-4 bg-amber-500/10 rounded-3xl mb-4">
               <span className="material-symbols-outlined text-amber-500 text-6xl">emoji_events</span>
             </div>
             <h1 className="text-5xl font-black text-on-surface tracking-tighter">Class Champions</h1>
             <p className="text-outline-variant font-bold uppercase tracking-[0.2em] mt-2">Live Session Leaderboard</p>
           </div>

           <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
             {/* 2nd Place */}
             <div className="order-2 md:order-1 h-64 bg-surface-container-high rounded-t-3xl p-6 flex flex-col items-center justify-end relative shadow-sm">
                <div className="absolute top-[-24px] w-12 h-12 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xl border-4 border-surface-container-high">2</div>
                <div className="text-center">
                  <p className="font-bold text-on-surface">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[1]?.name || '---'}</p>
                  <p className="text-primary font-mono font-black text-xl">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[1]?.score.toLocaleString() || 0}</p>
                </div>
             </div>
             {/* 1st Place */}
             <div className="order-1 md:order-2 h-80 bg-primary/10 border-2 border-primary/20 rounded-t-3xl p-6 flex flex-col items-center justify-end relative shadow-xl">
                <div className="absolute top-[-32px] w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-3xl border-4 border-surface-container-lowest animate-bounce">1</div>
                <div className="text-center mb-4">
                  <p className="font-black text-2xl text-on-surface">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[0]?.name || '---'}</p>
                  <p className="text-primary font-mono font-black text-4xl">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[0]?.score.toLocaleString() || 0}</p>
                </div>
             </div>
             {/* 3rd Place */}
             <div className="order-3 h-48 bg-surface-container-high rounded-t-3xl p-6 flex flex-col items-center justify-end relative shadow-sm">
                <div className="absolute top-[-20px] w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold text-lg border-4 border-surface-container-high">3</div>
                <div className="text-center">
                  <p className="font-bold text-on-surface">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[2]?.name || '---'}</p>
                  <p className="text-primary font-mono font-black text-lg">{Object.values(leaderboard).sort((a,b)=>b.score-a.score)[2]?.score.toLocaleString() || 0}</p>
                </div>
             </div>
           </div>

           <div className="w-full max-w-4xl mt-12 bg-surface-container-low rounded-2xl p-6 overflow-y-auto max-h-[30vh]">
             <table className="w-full">
               <thead className="text-left text-[10px] font-bold text-outline uppercase tracking-widest">
                 <tr>
                   <th className="pb-4">Rank</th>
                   <th className="pb-4">Student</th>
                   <th className="pb-4 text-right">Score</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-outline-variant/10 text-sm">
                 {Object.values(leaderboard).sort((a,b)=>b.score-a.score).slice(3).map((entry, i) => (
                   <tr key={i}>
                     <td className="py-3 font-bold text-outline">#{i + 4}</td>
                     <td className="py-3 font-bold text-on-surface">{entry.name}</td>
                     <td className="py-3 text-right font-mono font-bold text-primary">{entry.score.toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}


      {/* 3. Render TeacherControlPanel for teachers */}
      {user?.role === 'TEACHER' && (
        <TeacherControlPanel 
          lessonId={lessonId}
          socket={socketRef.current}
          isChatLocked={isChatLocked}
          onToggleChat={setIsChatLocked}
          onStartCompetition={() => setQuizPhase('WAITING')}
          onShowPodium={() => setQuizPhase('RANKING')}
          studentCount={studentCount}
          understandingPercent={understandingPercent}
        />
      )}

      {/* BottomNavBar (Mobile only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 py-4 bg-white/90 dark:bg-[#191c1d]/90 backdrop-blur-lg border-t border-[#f3f4f5] dark:border-[#2c2c2c] md:hidden rounded-t-3xl">
        <Link to={`/class/stream?classId=${lesson?.class_id}`} className="text-[#1a73e8] bg-[#1a73e8]/10 text-primary rounded-full p-3 transition-transform duration-200 flex flex-col items-center">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold mt-1">Exit</span>
        </Link>
      </nav>
    </div>
  );
}

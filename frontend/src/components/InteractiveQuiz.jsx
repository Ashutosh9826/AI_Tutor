import React, { useState } from 'react';

export default function InteractiveQuiz({ block, userRole, isActive, onStart, onStop, onSubmit, results }) {
  const quizData = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
  const initialTimeLimit = quizData?.timeLimit || 30;
  
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(initialTimeLimit);

  React.useEffect(() => {
    let timer;
    if (isActive && !hasSubmitted) {
      setTimeLeft(initialTimeLimit);
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hasSubmitted]);

  const handleSelect = (index) => {
    if (!isActive || hasSubmitted || userRole === 'TEACHER' || timeLeft === 0) return;
    setSelectedOption(index);
  };

  const handleSubmit = (allowExpired = false) => {
    if (selectedOption !== null && !hasSubmitted && (timeLeft > 0 || allowExpired)) {
      onSubmit(block.id, selectedOption);
      setHasSubmitted(true);
    }
  };

  React.useEffect(() => {
    if (timeLeft === 0 && !hasSubmitted && isActive && userRole === 'STUDENT' && selectedOption !== null) {
      handleSubmit(true);
    }
  }, [timeLeft, hasSubmitted, isActive, userRole, selectedOption]);

  const totalVotes = results ? Object.values(results).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="relative group my-8">
      {isActive && <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-2xl blur opacity-25"></div>}
      <div className={`relative bg-surface-container-lowest p-8 rounded-xl shadow-lg space-y-6 border ${isActive ? 'border-primary/50' : 'border-outline-variant/30'}`}>
        
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">quiz</span>
              Live Pulse Quiz
            </h3>
            <p className="text-sm text-outline">
              {userRole === 'TEACHER' 
                ? 'Control this quiz for the class.' 
                : isActive 
                  ? 'Respond now!' 
                  : hasSubmitted 
                    ? 'Wait for next question...' 
                    : 'Get ready...'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             {isActive && (
               <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold ${timeLeft <= 5 ? 'bg-error text-white animate-bounce' : 'bg-primary/10 text-primary'}`}>
                 <span className="material-symbols-outlined text-sm">timer</span>
                 {timeLeft}s
               </div>
             )}

             {userRole === 'TEACHER' && (
               <div className="flex items-center gap-2">
                 {!isActive ? (
                   <button onClick={() => onStart(block.id)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1">
                     <span className="material-symbols-outlined text-sm">play_arrow</span> Start Quiz
                   </button>
                 ) : (
                   <button onClick={() => onStop(block.id)} className="bg-error text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1">
                     <span className="material-symbols-outlined text-sm">stop</span> Finish Quiz
                   </button>
                 )}
               </div>
             )}
          </div>
        </div>

        <p className={`text-lg font-medium text-on-surface ${!isActive && userRole === 'STUDENT' && !hasSubmitted ? 'blur-sm select-none' : ''}`}>
          {quizData?.question || 'Untitled Question'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(quizData?.options || []).map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selectedOption === idx;
            
            // For teacher, or if student has submitted, show results optionally
            const votes = results ? (results[idx] || 0) : 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

            return (
              <button 
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={!isActive || hasSubmitted || userRole === 'TEACHER'}
                className={`relative overflow-hidden flex items-center p-4 rounded-lg bg-surface border transition-all text-left group
                  ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-outline-variant hover:border-primary/50'}
                  ${(!isActive || hasSubmitted || userRole === 'TEACHER') ? 'cursor-default' : 'cursor-pointer hover:bg-primary/5'}
                `}
                type="button"
              >
                {/* Result Bar background */}
                {(userRole === 'TEACHER' || hasSubmitted) && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  ></div>
                )}
                
                <span className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full mr-4 font-bold text-sm transition-colors
                  ${isSelected ? 'bg-primary text-white' : 'bg-surface-container-high group-hover:bg-primary/20'}
                `}>
                  {letter}
                </span>
                <span className={`relative z-10 text-sm font-medium ${!isActive && userRole === 'STUDENT' && !hasSubmitted ? 'blur-sm select-none' : ''}`}>
                  {opt.text}
                </span>
                
                {(userRole === 'TEACHER' || hasSubmitted) && (
                  <div className="relative z-10 ml-auto flex items-center gap-3">
                    {opt.isCorrect && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">
                        Correct
                      </span>
                    )}
                    <span className="text-xs font-bold text-primary/70">
                      {percentage}% ({votes})
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {isActive && userRole === 'STUDENT' && !hasSubmitted && (
          <div className="flex justify-end pt-2">
             <button 
                onClick={handleSubmit} 
                disabled={selectedOption === null}
                className="bg-primary text-white px-6 py-2 rounded-full font-bold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
              >
                Submit Answer <span className="material-symbols-outlined text-sm">send</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

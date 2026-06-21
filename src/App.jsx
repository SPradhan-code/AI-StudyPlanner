import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  Sparkles, 
  BookOpen, 
  ChevronRight, 
  AlertCircle, 
  Coffee, 
  Award,
  RefreshCw,
  Home
} from 'lucide-react';
import ThreeCanvas from './components/ThreeCanvas';
import { generateStudyPlan, getAICoachFeedback, getLiveAICoachFeedback, getTopicsForSubject } from './utils/aiPlanner';
import confetti from 'canvas-confetti';
import { auth, saveUserData, getUserData } from './utils/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

function App() {
  // --- Auth State ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authError, setAuthError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- Persistent State or Defaults ---
  const [isConfigured, setIsConfigured] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: Profile, 2: Subjects, 3: Schedule
  
  // Student Profile
  const [studentName, setStudentName] = useState('');
  const [studyStyle, setStudyStyle] = useState('visual'); // visual, practice, reading

  // Subjects & Topics
  const [subjects, setSubjects] = useState([]);
  
  // New Subject Input Temp State
  const [tempSubName, setTempSubName] = useState('');
  const [tempSubDiff, setTempSubDiff] = useState('medium');
  const [tempSubChapters, setTempSubChapters] = useState(5);

  // Schedule details
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(4);
  const [weeklyOffDays, setWeeklyOffDays] = useState([0]); // default Sunday off

  // Interactive Panel States
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calendar, coach
  const [studyPlan, setStudyPlan] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState(null);

  // --- Auth Listener & Data Sync with LocalStorage Fallback ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(true);
        try {
          let data = null;
          try {
            data = await getUserData(currentUser.uid);
          } catch (dbErr) {
            console.warn("Could not load from Firestore database, falling back to local storage:", dbErr);
          }

          // If no database data found or DB errored out, check backup local storage
          if (!data) {
            const backup = localStorage.getItem(`ai_study_planner_user_${currentUser.uid}`);
            if (backup) {
              data = JSON.parse(backup);
            }
          }

          if (data) {
            setStudentName(data.studentName || '');
            setStudyStyle(data.studyStyle || 'visual');
            setSubjects(data.subjects || []);
            setExamDate(data.examDate || '');
            setDailyHours(data.dailyHours || 4);
            setWeeklyOffDays(data.weeklyOffDays || [0]);
            setIsConfigured(data.isConfigured || false);
            if (data.subjects && data.subjects.length > 0) {
              setActiveSubjectId(data.subjects[0].id);
            }
          } else {
            // New user defaults
            setIsConfigured(false);
            setWizardStep(1);
            setStudentName('');
            setStudyStyle('visual');
            setSubjects([
              {
                id: 'sub-1',
                name: 'Mathematics',
                difficulty: 'hard',
                topics: getTopicsForSubject('Mathematics'),
                completedTopics: []
              },
              {
                id: 'sub-2',
                name: 'Physics',
                difficulty: 'medium',
                topics: getTopicsForSubject('Physics'),
                completedTopics: []
              }
            ]);
            // Set default date to 12 days from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 12);
            setExamDate(defaultDate.toISOString().split('T')[0]);
            setDailyHours(4);
            setWeeklyOffDays([0]);
          }
        } catch (err) {
          console.error("Failed to load user data:", err);
        } finally {
          setAuthLoading(false);
        }
      } else {
        // Reset state on logout
        setIsConfigured(false);
        setWizardStep(1);
        setStudentName('');
        setStudyStyle('visual');
        setSubjects([]);
        setExamDate('');
        setDailyHours(4);
        setWeeklyOffDays([0]);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Debounced Auto-save Effect with LocalStorage Backup
  useEffect(() => {
    if (user) {
      const timer = setTimeout(async () => {
        const payload = {
          studentName,
          studyStyle,
          subjects,
          examDate,
          dailyHours,
          weeklyOffDays,
          isConfigured
        };

        // Always save to localStorage as a robust local backup
        localStorage.setItem(`ai_study_planner_user_${user.uid}`, JSON.stringify(payload));

        // Save to Firestore if fully configured
        if (isConfigured) {
          try {
            await saveUserData(user.uid, payload);
          } catch (err) {
            console.error("Error auto-saving progress to Firestore:", err);
          }
        }
      }, 1000); // 1-second debounce
      return () => clearTimeout(timer);
    }
  }, [subjects, examDate, dailyHours, weeklyOffDays, studyStyle, studentName, isConfigured, user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill in all fields.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthError('');
    setActionLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err) {
      console.error("Auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Set default exam date to 12 days from now
  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 12);
    setExamDate(defaultDate.toISOString().split('T')[0]);
  }, []);

  // Recalculate study plans whenever subjects, exam dates, or parameters change
  useEffect(() => {
    if (isConfigured && subjects.length > 0 && examDate) {
      const plan = generateStudyPlan({
        studentName,
        studyStyle,
        subjects,
        examDate,
        dailyHours,
        weeklyOffDays
      });
      setStudyPlan(plan);

      // 1. Instantly calculate and render static rule-based feedback (zero delay)
      const fallbackCoach = getAICoachFeedback({
        subjects,
        daysRemaining: plan.daysRemaining,
        studyStyle
      });
      setCoachFeedback(fallbackCoach);

      // 2. Fetch rich, dynamic AI advice from Gemini API in the background
      let active = true;
      const loadLiveFeedback = async () => {
        try {
          const liveCoach = await getLiveAICoachFeedback({
            subjects,
            daysRemaining: plan.daysRemaining,
            studyStyle,
            studentName
          });
          if (active) {
            setCoachFeedback(liveCoach);
          }
        } catch (err) {
          console.error("Error loading live Gemini feedback:", err);
        }
      };
      loadLiveFeedback();

      return () => {
        active = false;
      };
    }
  }, [isConfigured, subjects, examDate, dailyHours, weeklyOffDays, studyStyle, studentName]);

  // --- Handlers ---
  const handleAddSubject = (e) => {
    e.preventDefault();
    if (!tempSubName.trim()) return;

    const newSubject = {
      id: `sub-${Date.now()}`,
      name: tempSubName.trim(),
      difficulty: tempSubDiff,
      topics: getTopicsForSubject(tempSubName.trim(), parseInt(tempSubChapters)),
      completedTopics: []
    };

    setSubjects([...subjects, newSubject]);
    setActiveSubjectId(newSubject.id);
    setTempSubName('');
  };

  const handleRemoveSubject = (id) => {
    const updated = subjects.filter(s => s.id !== id);
    setSubjects(updated);
    if (activeSubjectId === id && updated.length > 0) {
      setActiveSubjectId(updated[0].id);
    }
  };

  const toggleTopicCompletion = (subjectId, topicName) => {
    let justCompletedAll = false;
    const updated = subjects.map(sub => {
      if (sub.id === subjectId) {
        const isCompleted = sub.completedTopics.includes(topicName);
        let nextCompleted = [];
        if (isCompleted) {
          nextCompleted = sub.completedTopics.filter(t => t !== topicName);
        } else {
          nextCompleted = [...sub.completedTopics, topicName];
          // Check if this was the last chapter to complete for this subject
          if (nextCompleted.length === sub.topics.length) {
            justCompletedAll = true;
          }
        }
        return { ...sub, completedTopics: nextCompleted };
      }
      return sub;
    });

    setSubjects(updated);

    if (justCompletedAll) {
      // Trigger confetti celebration!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const toggleOffDay = (dayIndex) => {
    if (weeklyOffDays.includes(dayIndex)) {
      setWeeklyOffDays(weeklyOffDays.filter(d => d !== dayIndex));
    } else {
      setWeeklyOffDays([...weeklyOffDays, dayIndex]);
    }
  };

  const handleFinishWizard = async () => {
    if (!studentName.trim()) {
      alert("Please enter your name to customize the AI coach.");
      return;
    }
    if (subjects.length === 0) {
      alert("Please add at least one subject to plan.");
      return;
    }
    if (!examDate) {
      alert("Please pick a valid exam date.");
      return;
    }
    setIsConfigured(true);
    setActiveTab('dashboard');

    if (user) {
      try {
        await saveUserData(user.uid, {
          studentName,
          studyStyle,
          subjects,
          examDate,
          dailyHours,
          weeklyOffDays,
          isConfigured: true
        });
      } catch (err) {
        console.error("Failed to save config:", err);
      }
    }
  };

  const handleResetPlan = () => {
    setIsConfigured(false);
    setWizardStep(1);
  };

  // Helper for difficulty visual badges
  const getDiffBadge = (diff) => {
    const styles = {
      hard: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
      medium: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
      easy: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }
    };
    const current = styles[diff] || styles.medium;
    return (
      <span style={{ 
        padding: '3px 8px', 
        borderRadius: '6px', 
        fontSize: '11px', 
        fontWeight: 'bold', 
        textTransform: 'uppercase',
        backgroundColor: current.bg,
        color: current.text,
        border: current.border
      }}>
        {diff}
      </span>
    );
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
      {/* Visual background decorations */}
      <div className="bg-glow-container">
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      {/* ================= LANDING / SETUP SCREEN ================= */}
      {authLoading ? (
        <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
        </div>
      ) : !user ? (
        /* Sign In / Sign Up Card */
        <div className="auth-container">
          <div style={{ textAlign: 'center', maxWidth: '500px', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '6px 14px', borderRadius: '30px', marginBottom: '16px' }}>
              <Brain size={18} color="var(--secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--secondary)' }}>AI Study Planner</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              Welcome to Your Cosmic Study Space
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Sign in to sync your personalized 3D curriculum and progress across all your devices.
            </p>
          </div>

          <div className="glass-panel auth-card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <h2 style={{ fontSize: '18px' }}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAuth}>
                {authError && (
                  <div className="auth-alert-error">
                    <AlertCircle size={16} />
                    <span>{authError}</span>
                  </div>
                )}
                
                <div className="auth-input-group">
                  <label className="auth-input-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="you@example.com" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="auth-input-group" style={{ marginBottom: '24px' }}>
                  <label className="auth-input-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={actionLoading}>
                  {actionLoading ? <div className="spinner"></div> : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
                </button>
              </form>

              <div className="auth-footer">
                {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button 
                  type="button" 
                  className="auth-switch-btn" 
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthError('');
                  }}
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !isConfigured ? (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
          
          {/* Landing Header */}
          {wizardStep === 1 && (
            <div style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '40px', animation: 'fadeIn 1s ease' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '6px 14px', borderRadius: '30px', marginBottom: '20px' }}>
                <Sparkles size={16} color="var(--secondary)" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Next-Gen Study Orchestrator</span>
              </div>
              <h1 style={{ fontSize: '48px', lineHeight: '1.1', fontWeight: 800, marginBottom: '16px', fontFamily: 'var(--font-display)' }}>
                Master Your Exams with <span className="text-gradient-purple">AI Study Planner</span>
              </h1>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '30px' }}>
                A 3D space-mapped study planner powered by adaptive cognitive algorithms. Upload your subjects, track completion in real-time, and let our AI study coach guide your schedule.
              </p>
            </div>
          )}

          {/* Setup Wizard Box */}
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Brain size={22} color="var(--secondary)" />
                <h2 style={{ fontSize: '18px' }}>AI Planner Configurator</h2>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Step {wizardStep} of 3</span>
            </div>

            <div className="card-body">
              
              {/* STEP 1: Student Profile */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>What is your name?</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter student name..." 
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>What is your preferred study style?</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <button 
                        type="button"
                        onClick={() => setStudyStyle('visual')}
                        className={studyStyle === 'visual' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '12px 6px', fontSize: '13px', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: '4px', height: '80px' }}
                      >
                        <Sparkles size={16} />
                        <span>Visual / Maps</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setStudyStyle('practice')}
                        className={studyStyle === 'practice' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '12px 6px', fontSize: '13px', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: '4px', height: '80px' }}
                      >
                        <TrendingUp size={16} />
                        <span>Practice Qs</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setStudyStyle('reading')}
                        className={studyStyle === 'reading' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '12px 6px', fontSize: '13px', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: '4px', height: '80px' }}
                      >
                        <BookOpen size={16} />
                        <span>Read / Summarize</span>
                      </button>
                    </div>
                  </div>
                  
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ marginTop: '10px', justifyContent: 'center' }}
                    onClick={() => {
                      if (!studentName.trim()) {
                        alert("Please fill in your name first!");
                      } else {
                        setWizardStep(2);
                      }
                    }}
                  >
                    Continue <ChevronRight size={18} />
                  </button>
                </div>
              )}

              {/* STEP 2: Subject Matrix Setup */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Add Subject form snippet */}
                  <form onSubmit={handleAddSubject} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ flex: '2 1 180px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Physics, Chemistry, Maths..." 
                          value={tempSubName}
                          onChange={(e) => setTempSubName(e.target.value)}
                        />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <select className="form-select" value={tempSubDiff} onChange={(e) => setTempSubDiff(e.target.value)}>
                          <option value="easy">Easy Prep</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard Prep</option>
                        </select>
                      </div>
                      <button type="submit" className="btn-primary" style={{ padding: '10px 14px' }}>
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      💡 Subjects like Physics, Maths, Biology auto-fill with standard topics!
                    </div>
                  </form>

                  {/* Render added subjects list */}
                  <div>
                    <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                      Configured Subjects ({subjects.length})
                    </h3>
                    {subjects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                        No subjects added yet. Add one above to construct your plan!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                        {subjects.map((sub) => (
                          <div 
                            key={sub.id} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              backgroundColor: 'rgba(255,255,255,0.03)', 
                              padding: '10px 14px', 
                              borderRadius: '10px',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <BookOpen size={16} color="var(--primary)" />
                              <span style={{ fontSize: '14px', fontWeight: 500 }}>{sub.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({sub.topics.length} chapters)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {getDiffBadge(sub.difficulty)}
                              <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} 
                                onClick={() => handleRemoveSubject(sub.id)}
                              >
                                <Trash2 size={16} hover={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Navigation buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setWizardStep(1)}>
                      Back
                    </button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ flex: 2, justifyContent: 'center' }}
                      onClick={() => {
                        if (subjects.length === 0) {
                          alert("Please add at least one subject to generate a study plan.");
                        } else {
                          setWizardStep(3);
                        }
                      }}
                    >
                      Next Step <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Exam Parameters */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Target Exam Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Daily Study Goal (Hours)</label>
                      <select className="form-select" value={dailyHours} onChange={(e) => setDailyHours(parseInt(e.target.value))}>
                        <option value={2}>2 Hours / Day</option>
                        <option value={4}>4 Hours / Day</option>
                        <option value={6}>6 Hours / Day (Intense)</option>
                        <option value={8}>8 Hours / Day (Extreme)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Select Weekly Off-Days (Mental Recharge)</label>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        const isSelected = weeklyOffDays.includes(idx);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleOffDay(idx)}
                            style={{
                              flex: 1,
                              padding: '8px 2px',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid var(--secondary)' : '1px solid rgba(255,255,255,0.08)',
                              backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255,255,255,0.02)',
                              color: isSelected ? 'var(--secondary)' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: isSelected ? 'bold' : 'normal',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setWizardStep(2)}>
                      Back
                    </button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ flex: 2, justifyContent: 'center' }}
                      onClick={handleFinishWizard}
                    >
                      <Sparkles size={16} /> Generate AI Plan
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (

        // ================= MAIN INTERACTIVE DASHBOARD =================
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          
          {/* Main Top Header Navigation */}
          <header style={{ 
            borderBottom: '1px solid var(--border-color)', 
            backdropFilter: 'blur(16px)', 
            position: 'sticky', 
            top: 0, 
            zIndex: 50,
            background: 'rgba(6, 6, 12, 0.8)'
          }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Brain size={28} color="var(--secondary)" className="float-anim" />
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800 }}>AI Study Planner</h1>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI 3D Study Workspace</span>
                </div>
              </div>

              {/* Action tabs */}
              <nav style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  style={{
                    backgroundColor: activeTab === 'dashboard' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: activeTab === 'dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Home size={15} color={activeTab === 'dashboard' ? 'var(--secondary)' : 'var(--text-secondary)'} />
                  <span>3D Space</span>
                </button>
                <button 
                  onClick={() => setActiveTab('calendar')} 
                  style={{
                    backgroundColor: activeTab === 'calendar' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: activeTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Calendar size={15} color={activeTab === 'calendar' ? 'var(--secondary)' : 'var(--text-secondary)'} />
                  <span>Study Calendar</span>
                </button>
                <button 
                  onClick={() => setActiveTab('coach')} 
                  style={{
                    backgroundColor: activeTab === 'coach' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: activeTab === 'coach' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Sparkles size={15} color={activeTab === 'coach' ? 'var(--accent)' : 'var(--text-secondary)'} />
                  <span>AI Coach</span>
                </button>
              </nav>

              {/* Status Header Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Clock size={16} color="var(--secondary)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Exams: <span style={{ color: 'var(--secondary)' }}>{studyPlan?.daysRemaining || 0}d left</span>
                  </span>
                </div>
                <button 
                  onClick={handleResetPlan}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                >
                  <RefreshCw size={12} />
                  <span>Reconfigure</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--danger)' }}
                >
                  <User size={12} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main workspace area */}
          <main style={{ flex: 1, padding: '30px 0' }}>
            <div className="container">
              
              {/* Tab 1: 3D Workspace */}
              {activeTab === 'dashboard' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', minHeight: 'calc(100vh - 180px)' }}>
                  
                  {/* Left Column: ThreeJS Space */}
                  <div className="glass-panel" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden' }}>
                    <div style={{ 
                      position: 'absolute', 
                      top: '16px', 
                      left: '16px', 
                      zIndex: 5, 
                      backgroundColor: 'rgba(6, 6, 12, 0.7)', 
                      padding: '8px 14px', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3D Orbit View</div>
                      <h2 style={{ fontSize: '14px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Interactive Study Universe</span>
                      </h2>
                    </div>

                    <ThreeCanvas 
                      subjects={subjects} 
                      daysRemaining={studyPlan?.daysRemaining || 10}
                      onSubjectClick={(id) => setActiveSubjectId(id)}
                      activeSubjectId={activeSubjectId}
                    />
                  </div>

                  {/* Right Column: Dynamic Checklist & Detail Panels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* General AI Quick Status */}
                    {coachFeedback && (
                      <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '120px',
                          height: '100%',
                          background: coachFeedback.status === 'success' 
                            ? 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0) 80%)'
                            : coachFeedback.status === 'warning'
                            ? 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(0,0,0,0) 80%)'
                            : 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0) 80%)',
                          pointerEvents: 'none'
                        }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Coach Report</span>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontWeight: 'bold',
                            backgroundColor: coachFeedback.status === 'success' 
                              ? 'rgba(16, 185, 129, 0.12)' 
                              : coachFeedback.status === 'warning'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                            color: coachFeedback.status === 'success'
                              ? 'var(--success)'
                              : coachFeedback.status === 'warning'
                              ? 'var(--warning)'
                              : 'var(--danger)'
                          }}>
                            {coachFeedback.statusText}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={16} color="var(--secondary)" />
                          <span>Hi, {studentName}!</span>
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {coachFeedback.coachReport}
                        </p>
                      </div>
                    )}

                    {/* Interactive Chapter Tracker */}
                    <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div className="card-header" style={{ background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={18} color="var(--primary)" />
                            <h3 style={{ fontSize: '15px' }}>Subject Checklist</h3>
                          </div>
                          
                          {/* Subject selection dropdown inside card header */}
                          <select 
                            className="form-select" 
                            style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                            value={activeSubjectId || ''} 
                            onChange={(e) => setActiveSubjectId(e.target.value)}
                          >
                            {subjects.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(() => {
                          const currentSub = subjects.find(s => s.id === activeSubjectId);
                          if (!currentSub) return <div style={{ color: 'var(--text-muted)' }}>Select a subject from the 3D space.</div>;
                          
                          const total = currentSub.topics.length;
                          const completed = currentSub.completedTopics.length;
                          const progressPercent = total > 0 ? (completed / total) * 100 : 0;
                          
                          return (
                            <>
                              {/* Subject Meta Details */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <h4 style={{ fontSize: '16px', color: '#fff', marginBottom: '2px' }}>{currentSub.name}</h4>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {getDiffBadge(currentSub.difficulty)}
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {completed} of {total} chapters covered
                                    </span>
                                  </div>
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--secondary)' }}>
                                  {progressPercent.toFixed(0)}%
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  width: `${progressPercent}%`, 
                                  background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                                  transition: 'width 0.4s ease',
                                  boxShadow: 'var(--shadow-neon-cyan)'
                                }}></div>
                              </div>

                              {/* Chapters List */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, maxHeight: '260px', paddingRight: '4px' }}>
                                {currentSub.topics.map((topic, idx) => {
                                  const isChecked = currentSub.completedTopics.includes(topic);
                                  return (
                                    <div 
                                      key={topic}
                                      onClick={() => toggleTopicCompletion(currentSub.id, topic)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.01)',
                                        border: isChecked ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        border: isChecked ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isChecked ? 'var(--success)' : 'transparent',
                                        transition: 'all 0.2s ease'
                                      }}>
                                        {isChecked && <CheckCircle2 size={12} color="#fff" />}
                                      </div>
                                      <span style={{ 
                                        fontSize: '13px', 
                                        color: isChecked ? 'var(--text-secondary)' : '#fff',
                                        textDecoration: isChecked ? 'line-through' : 'none',
                                        transition: 'all 0.2s ease'
                                      }}>
                                        {topic}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Tab 2: Calendar Timeline */}
              {activeTab === 'calendar' && (
                <div className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={20} color="var(--secondary)" />
                      <h2 style={{ fontSize: '18px' }}>Optimized AI Study Timeline</h2>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Total prep cycle: {studyPlan?.daysRemaining} Days
                    </span>
                  </div>

                  <div className="card-body">
                    {studyPlan?.error ? (
                      <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '20px' }}>
                        {studyPlan.error}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        
                        {/* Phase info bar */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                            <span>Active Study: <strong>{studyPlan?.studyDaysCount} Days</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--secondary)' }}></span>
                            <span>Revision & Mocks: <strong>{studyPlan?.revisionDaysCount} Days</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }}></span>
                            <span>Weekly Days Off: <strong>{weeklyOffDays.length > 0 ? 'Allocated' : 'None'}</strong></span>
                          </div>
                        </div>

                        {/* Calendar Day Rows */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', maxHeight: '480px', overflowY: 'auto', paddingRight: '6px', paddingTop: '4px' }}>
                          {studyPlan?.schedule.map((day, idx) => {
                            let cardBorder = 'rgba(255,255,255,0.06)';
                            let headerBg = 'rgba(255,255,255,0.01)';
                            
                            if (day.isOffDay) {
                              cardBorder = 'rgba(255, 255, 255, 0.05)';
                              headerBg = 'rgba(255, 255, 255, 0.02)';
                            } else if (day.phase === 'Revision & Mock Exams') {
                              cardBorder = 'rgba(0, 242, 254, 0.2)';
                              headerBg = 'rgba(0, 242, 254, 0.03)';
                            }

                            return (
                              <div 
                                key={idx} 
                                style={{ 
                                  border: `1px solid ${cardBorder}`, 
                                  borderRadius: '12px', 
                                  overflow: 'hidden',
                                  backgroundColor: 'rgba(10, 10, 20, 0.3)',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {/* Day Row Header */}
                                <div style={{ 
                                  padding: '10px 14px', 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  backgroundColor: headerBg,
                                  borderBottom: '1px solid rgba(255,255,255,0.04)'
                                }}>
                                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{day.date}</span>
                                  <span style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    backgroundColor: day.isOffDay 
                                      ? 'rgba(255,255,255,0.06)' 
                                      : day.phase === 'Revision & Mock Exams'
                                      ? 'rgba(0, 242, 254, 0.12)'
                                      : 'rgba(99, 102, 241, 0.12)',
                                    color: day.isOffDay 
                                      ? 'var(--text-muted)' 
                                      : day.phase === 'Revision & Mock Exams'
                                      ? 'var(--secondary)'
                                      : 'var(--primary)',
                                    fontWeight: 'bold'
                                  }}>
                                    {day.isOffDay ? 'Rest' : day.phase === 'Revision & Mock Exams' ? 'Revision' : 'Study'}
                                  </span>
                                </div>

                                {/* Day Row Activities */}
                                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {day.activities.map((act, aIdx) => (
                                    <div key={aIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {act.type === 'rest' ? (
                                          <Coffee size={14} color="var(--text-muted)" />
                                        ) : act.type === 'revision' ? (
                                          <Award size={14} color="var(--secondary)" />
                                        ) : (
                                          <BookOpen size={14} color="var(--primary)" />
                                        )}
                                        <h4 style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>{act.title}</h4>
                                      </div>
                                      
                                      {act.subjectName && (
                                        <div style={{ fontSize: '11px', color: 'var(--secondary)', display: 'inline-flex' }}>
                                          Target: {act.subjectName}
                                        </div>
                                      )}

                                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                        {act.description}
                                      </p>
                                      
                                      {!day.isOffDay && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                          <Clock size={10} />
                                          <span>Duration: {act.durationHours} Hours</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Detailed AI Coach */}
              {activeTab === 'coach' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', animation: 'fadeIn 0.3s ease' }}>
                  
                  {/* Left Column: Summary and Core advice */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles size={20} color="var(--accent)" />
                      <h2 style={{ fontSize: '18px' }}>AI Study Coach Assessment</h2>
                    </div>
                    
                    <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ 
                          width: '70px', 
                          height: '70px', 
                          borderRadius: '50%', 
                          border: '2px solid var(--secondary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: 'var(--secondary)',
                          boxShadow: 'var(--shadow-neon-cyan)',
                          flexShrink: 0
                        }}>
                          {coachFeedback?.completionRate.toFixed(0)}%
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Preparation Score</div>
                          <h3 style={{ fontSize: '16px', color: '#fff', margin: '2px 0' }}>Status: {coachFeedback?.statusText}</h3>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Completed {coachFeedback?.completedTopics} out of {coachFeedback?.totalTopics} course chapters.
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={15} color="var(--primary)" />
                          <span>Personalized Cognitive Report</span>
                        </h4>
                        <div style={{ 
                          backgroundColor: 'rgba(10, 10, 20, 0.4)', 
                          padding: '16px', 
                          borderRadius: '12px', 
                          border: '1px solid rgba(255,255,255,0.04)',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          color: 'var(--text-secondary)'
                        }}>
                          "{coachFeedback?.coachReport}"
                          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--primary)', fontStyle: 'italic' }}>
                            *Pacing based on a {studyStyle} study profile with {dailyHours} hours of planned study time.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Action Items Checklist */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header">
                      <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={20} color="var(--secondary)" />
                        <span>AI Priority Action Checklist</span>
                      </h2>
                    </div>

                    <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Execute these prioritized steps to optimize your review cycle and improve your overall score.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {coachFeedback?.priorityAdvice.map((advice, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              gap: '12px', 
                              backgroundColor: 'rgba(255,255,255,0.02)', 
                              padding: '14px', 
                              borderRadius: '10px', 
                              border: '1px solid rgba(255,255,255,0.04)' 
                            }}
                          >
                            <span style={{ 
                              width: '20px', 
                              height: '20px', 
                              borderRadius: '50%', 
                              backgroundColor: 'rgba(0, 242, 254, 0.1)', 
                              color: 'var(--secondary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '11px', 
                              fontWeight: 'bold',
                              border: '1px solid rgba(0, 242, 254, 0.2)',
                              flexShrink: 0
                            }}>
                              {idx + 1}
                            </span>
                            <p style={{ fontSize: '12px', color: '#fff', lineHeight: '1.5' }}>
                              {advice}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div style={{ 
                        marginTop: 'auto', 
                        padding: '12px', 
                        borderRadius: '10px', 
                        backgroundColor: 'rgba(99,102,241,0.04)', 
                        border: '1px solid rgba(99,102,241,0.1)',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                      }}>
                        <Brain size={20} color="var(--primary)" />
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <strong>Continuous Calibration:</strong> Marking topics completed in the checklist automatically recalculates your timeline.
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;

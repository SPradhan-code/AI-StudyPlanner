// AI Study Planner & Evaluation Logic

// Prepopulated subject chapters for AI ease-of-use
export const DEFAULT_SUBJECT_TOPICS = {
  physics: [
    "Mechanics & Kinematics",
    "Thermodynamics & Heat",
    "Electromagnetism & Circuits",
    "Optics & Wave Theory",
    "Modern Physics & Quantum Mechanics"
  ],
  chemistry: [
    "Atomic Structure & Chemical Bonding",
    "Chemical Kinetics & Chemical Equilibrium",
    "Organic Chemistry & Functional Groups",
    "Thermodynamics & Electrochemistry",
    "Coordination Compounds & Periodic Table"
  ],
  mathematics: [
    "Calculus (Limits, Derivatives, Integrals)",
    "Linear Algebra & Matrices",
    "Probability & Mathematical Statistics",
    "Trigonometry & Coordinate Geometry",
    "Differential Equations & Sequences"
  ],
  biology: [
    "Cell Biology & Molecular Genetics",
    "Human Anatomy & Organ Systems",
    "Plant Physiology & Photosynthesis",
    "Evolution, Genetics & Diversity",
    "Biotechnology & Ecology"
  ],
  computer_science: [
    "Variables, Functions & Control Flow",
    "Data Structures (Arrays, Lists, Trees)",
    "Object-Oriented Programming Concepts",
    "Relational Databases & SQL Queries",
    "Web Architectures, HTML/CSS/JS & APIs"
  ],
  history: [
    "Ancient Civilizations & Empires",
    "The Middle Ages & Feudalism",
    "The Renaissance, Reformation & Enlightenment",
    "World War I, II & Post-War Reconstruction",
    "Civil Rights Movements & Modern Geopolitics"
  ],
  literature: [
    "Poetry Analysis, Metre & Structure",
    "Shakespearean Drama & Themes",
    "The Rise of the Novel & Literary Periods",
    "Literary Devices, Tone & Rhetoric",
    "Creative Writing & Essay Structures"
  ],
  economics: [
    "Microeconomics (Supply, Demand, Elasticity)",
    "Macroeconomics (Inflation, GDP, Fiscal Policy)",
    "Market Structures (Monopoly, Competition)",
    "International Trade & Exchange Rates",
    "Behavioral Economics & Financial Markets"
  ]
};

/**
 * Resolves topics for a subject name. If matching a template, returns it.
 * Otherwise, generates N generic chapters.
 */
export function getTopicsForSubject(subjectName, chapterCount = 5) {
  const cleanName = subjectName.trim().toLowerCase().replace(/\s+/g, "_");
  if (DEFAULT_SUBJECT_TOPICS[cleanName]) {
    return [...DEFAULT_SUBJECT_TOPICS[cleanName]];
  }
  
  // Try partial match
  const matchedKey = Object.keys(DEFAULT_SUBJECT_TOPICS).find(key => 
    cleanName.includes(key) || key.includes(cleanName)
  );
  if (matchedKey) {
    return [...DEFAULT_SUBJECT_TOPICS[matchedKey]];
  }

  // Fallback: generate generic chapters
  const chapters = [];
  for (let i = 1; i <= chapterCount; i++) {
    chapters.push(`Chapter ${i}: Core Fundamentals of ${subjectName}`);
  }
  return chapters;
}

/**
 * Main AI planning function
 */
export function generateStudyPlan({ studentName, studyStyle, subjects, examDate, dailyHours, weeklyOffDays = [] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetExamDate = new Date(examDate);
  targetExamDate.setHours(0, 0, 0, 0);
  
  // Calculate total days left
  const msDiff = targetExamDate.getTime() - today.getTime();
  const totalDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  
  if (totalDays <= 0) {
    return {
      error: "The exam date must be in the future! Please select a valid upcoming date.",
      daysRemaining: 0
    };
  }

  // Generate calendar days
  const calendarDays = [];
  let currentDate = new Date(today);
  
  // Weights based on subject difficulty
  const difficultyWeights = {
    hard: 1.8,
    medium: 1.2,
    easy: 0.7
  };

  // We dedicate last 15% of time (minimum 2 days, maximum 5 days) to full revision/mock tests
  const revisionDaysCount = Math.max(2, Math.min(5, Math.floor(totalDays * 0.15)));
  const studyDaysCount = totalDays - revisionDaysCount;
  
  // Generate active study list with remaining chapters
  let allChaptersToPlan = [];
  subjects.forEach(subject => {
    const weight = difficultyWeights[subject.difficulty] || 1.0;
    const uncompleted = subject.topics.filter(t => !subject.completedTopics.includes(t));
    
    uncompleted.forEach(topic => {
      allChaptersToPlan.push({
        subjectId: subject.id,
        subjectName: subject.name,
        difficulty: subject.difficulty,
        topicName: topic,
        weight: weight
      });
    });
  });

  // Calculate day-by-day distribution
  // We want to map dates to schedules
  let topicIndex = 0;
  
  for (let i = 0; i < totalDays; i++) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() + i);
    
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    // Check if it's an off day
    const isOffDay = weeklyOffDays.includes(dayOfWeek);
    
    if (i >= studyDaysCount) {
      // Revision Phase
      calendarDays.push({
        date: dateString,
        isOffDay: false,
        phase: "Revision & Mock Exams",
        activities: [
          {
            type: "revision",
            title: "Comprehensive Mock Exam & Revision",
            description: "Practice exam-simulated papers under timed conditions. Review key weak areas across all subjects.",
            durationHours: dailyHours
          }
        ]
      });
    } else if (isOffDay) {
      calendarDays.push({
        date: dateString,
        isOffDay: true,
        phase: "Rest & Recharge",
        activities: [
          {
            type: "rest",
            title: "Weekly Mental Reset",
            description: "Keep books closed today! Engage in sports, hobbies, or light outdoor walking to prevent cognitive fatigue.",
            durationHours: 0
          }
        ]
      });
    } else {
      // Study Phase - Allocate topics
      const activities = [];
      const hoursPerTask = 2; // Allocate in blocks of 2 hours
      const tasksForToday = Math.max(1, Math.round(dailyHours / hoursPerTask));
      
      for (let t = 0; t < tasksForToday; t++) {
        if (topicIndex < allChaptersToPlan.length) {
          const currentTopic = allChaptersToPlan[topicIndex];
          
          let actionVerb = "Study";
          let focusHint = "";
          
          // Tailor recommendations based on study style
          if (studyStyle === "visual") {
            actionVerb = "Mind-Map & Visualize";
            focusHint = "Draw flowcharts and visually map the relations between main concepts. Use colors for sub-branches.";
          } else if (studyStyle === "practice") {
            actionVerb = "Solve & Practice";
            focusHint = "Work through active recall questions, previous year questions (PYQs), and flashcards.";
          } else {
            actionVerb = "Read & Summarize";
            focusHint = "Read the textbooks thoroughly. Summarize each section in your own words using bullet points.";
          }
          
          activities.push({
            type: "study",
            subjectId: currentTopic.subjectId,
            subjectName: currentTopic.subjectName,
            topicName: currentTopic.topicName,
            title: `${actionVerb}: ${currentTopic.topicName}`,
            description: `${focusHint} Target weak spots and create a 5-minute summary sheet.`,
            durationHours: Math.min(hoursPerTask, dailyHours - (activities.reduce((sum, act) => sum + act.durationHours, 0)))
          });
          
          topicIndex++;
        }
      }
      
      // If no topics left, fill with revision
      if (activities.length === 0) {
        activities.push({
          type: "revision",
          title: "Progress Review & Active Recall",
          description: "All scheduled topics are completed! Conduct quick flashcard quizzes and revise formula sheets.",
          durationHours: dailyHours
        });
      }
      
      calendarDays.push({
        date: dateString,
        isOffDay: false,
        phase: "Active Learning",
        activities: activities
      });
    }
  }

  return {
    daysRemaining: totalDays,
    studyDaysCount,
    revisionDaysCount,
    schedule: calendarDays,
    unplannedTopicsCount: Math.max(0, allChaptersToPlan.length - topicIndex)
  };
}

/**
 * Calculates preparation statistics and returns a detailed AI Coach evaluation.
 */
export function getAICoachFeedback({ subjects, daysRemaining, studyStyle }) {
  let totalTopics = 0;
  let completedTopics = 0;
  let hardCompleted = 0;
  let hardTotal = 0;
  
  subjects.forEach(sub => {
    totalTopics += sub.topics.length;
    completedTopics += sub.completedTopics.length;
    
    if (sub.difficulty === 'hard') {
      hardTotal += sub.topics.length;
      hardCompleted += sub.completedTopics.length;
    }
  });

  const completionRate = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
  const hardCompletionRate = hardTotal > 0 ? (hardCompleted / hardTotal) * 100 : 0;
  
  let status = "success"; // green, warning (orange), danger (red)
  let statusText = "On Track";
  let coachReport = "";
  let priorityAdvice = [];

  // Determine readiness status
  if (completionRate === 100) {
    status = "success";
    statusText = "Fully Prepared";
    coachReport = `Incredible work! You have finished 100% of your curriculum. You are in a prime position to excel in this exam. Keep reviewing your notes and ensure you sleep well leading up to the test!`;
    priorityAdvice = [
      "Relax and reduce study stress to maintain mental clarity.",
      "Attempt 1 full-length mock paper to practice timing.",
      "Get 8 hours of sleep before the exam."
    ];
  } else if (daysRemaining < 3) {
    if (completionRate < 60) {
      status = "danger";
      statusText = "Critical Risk";
      coachReport = `Warning: The exam is in less than 3 days, and your completion rate is at ${completionRate.toFixed(0)}%. We need to switch to survival study mode immediately. Skip deep conceptual readings and focus strictly on high-yield questions.`;
      priorityAdvice = [
        "Focus exclusively on past exam questions and summaries.",
        "Skip topics you haven't started; solidifying what you know is safer now.",
        "Utilize active recall sheets rather than passive reading."
      ];
    } else {
      status = "warning";
      statusText = "Final Revision Phase";
      coachReport = `The exam is right around the corner! You have covered ${completionRate.toFixed(0)}% of your topics. Do not attempt to learn any heavy new concepts now. Revise your summary flashcards and equations.`;
      priorityAdvice = [
        "Go over your self-made summaries and mind maps.",
        "Ensure formulas and key diagrams are memorized.",
        "Optimize your exam-day strategy (e.g. which sections to solve first)."
      ];
    }
  } else {
    // Normal schedule pacing
    const dailyRequirement = (totalTopics - completedTopics) / daysRemaining;
    
    if (dailyRequirement > 3) {
      status = "danger";
      statusText = "Lagging Behind";
      coachReport = `Alert: You need to cover ${dailyRequirement.toFixed(1)} topics per day to finish in time. This is a very heavy load. Your overall prep is at ${completionRate.toFixed(0)}%. I recommend extending your daily study hours by 1-2 hours or dropping some low-weight topics to ensure you cover core concepts.`;
      priorityAdvice = [
        "Increase daily study hours to accommodate the heavy workload.",
        "Prioritize the hard subjects (currently at ${hardCompletionRate.toFixed(0)}% completed) as they yield higher marks.",
        "Group similar topics together to accelerate learning."
      ];
    } else if (dailyRequirement > 1.5) {
      status = "warning";
      statusText = "Pace Warning";
      coachReport = `You are doing well, but you need to cover ${dailyRequirement.toFixed(1)} topics per day to complete everything. You've completed ${completionRate.toFixed(0)}% of the coursework. If you stay focused, you will hit your goals comfortably.`;
      priorityAdvice = [
        "Maintain a steady daily routine without skipping study blocks.",
        "Complete a mini-review at the end of each study session.",
        "Identify high-difficulty chapters that are still incomplete and start them next."
      ];
    } else {
      status = "success";
      statusText = "On Track";
      coachReport = `Excellent pacing! You only need to cover ${dailyRequirement.toFixed(1)} topics per day to complete the planner, and you are already ${completionRate.toFixed(0)}% prepared. You have plenty of time for revision. Let's maintain this momentum!`;
      priorityAdvice = [
        "Maintain your current study rhythm.",
        "Spend extra time testing yourself with active practice questions.",
        "Begin compiling a master revision sheet for the final week."
      ];
    }
  }

  // Tailor advice based on Study Style
  if (studyStyle === "visual") {
    priorityAdvice.push("Visual Technique: Draw a central mind-map linking all finished topics to enforce memory links.");
  } else if (studyStyle === "practice") {
    priorityAdvice.push("Practice Technique: Complete an active quiz on the chapters you finished today.");
  } else {
    priorityAdvice.push("Reading Technique: Review your margin notes and write a 3-sentence summary for key concepts.");
  }

  return {
    completionRate,
    status,
    statusText,
    coachReport,
    priorityAdvice,
    totalTopics,
    completedTopics
  };
}

import React, { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { CSS } from '@dnd-kit/utilities';
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { Home, Search, User, Menu, Crown, Folder, Bell, UserCircle, Settings, BookOpen, Network, TrendingUp, Calendar, Award, ExternalLink, Github, Linkedin, Code, Database, FileText, Users, Target, Zap, GripVertical, X } from 'lucide-react';

function SortableCard({ id, children, onHide, isDevMode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative break-inside-avoid mb-6 w-full group">
      {/* Панель управления кнопками */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">

        {/* Кнопка Drag (появляется только в Dev Mode) */}
        {isDevMode && (
          <div
            {...attributes}
            {...listeners}
            className="p-2 rounded-xl bg-blue-600 text-white shadow-lg cursor-grab active:cursor-grabbing border border-blue-400"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Кнопка Удалить (есть всегда) */}
        <button
          onClick={() => onHide(id)}
          className="p-2 rounded-xl bg-white shadow-lg border border-gray-200 text-red-500 hover:bg-red-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`transition-all duration-300 ${isDevMode ? 'outline-dashed outline-2 outline-blue-400 outline-offset-4 rounded-3xl' : ''}`}>
        {children}
      </div>
    </div>
  );
}

const floatAnimation = {
  animate: {
    y: [0, 40, 0],    // Движение вверх-вниз
    x: [0, 30, 0],    // Движение влево-вправо
    scale: [1, 1.1, 1], // Легкое пульсирование
    transition: {
      duration: 15,    // Очень медленно (15 секунд)
      repeat: Infinity,
      ease: "linear"
    }
  }
};

const pageVariants = {
  initial: {
    opacity: 0
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2
    }
  },
  exit: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: 1
    }
  }
};

const cardVariants = {
  initial: {
    opacity: 0,
    y: 60
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  },
  exit: {
    opacity: 0,
    y: -60,
    transition: {
      duration: 0.3
    }
  }
};

export default function AITHubDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeModule, setActiveModule] = useState('dashboard');

  const [isDevMode, setIsDevMode] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Комбинация Alt + Shift + Z
      if (e.altKey && e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        setIsDevMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Конфигурация карточек
  const [cardsConfig, setCardsConfig] = useState([
    { id: 'courses', title: 'My Courses', visible: true },
    { id: 'pow', title: 'Proof of Work', visible: true },
    { id: 'pulse', title: 'Project Pulse', visible: true },
    { id: 'leaderboard', title: 'Leaderboard & XP', visible: true },
    { id: 'profile', title: 'Member Profile', visible: true },
    { id: 'projectBase', title: 'Project Base', visible: true },
    { id: 'skills', title: 'Skill Matrix', visible: true },
    { id: 'wallOfProof', title: 'Wall of Proof', visible: true },
    { id: 'deadlines', title: 'Upcoming Deadlines', visible: true },
    { id: 'heatmap', title: 'Activity Heatmap', visible: true },
  ]);

  const proofOfWork = [
    { date: 'Dec 2025', task: 'Started NLP Research', status: 'completed' },
    { date: 'Jan 2026', task: '50th GitHub Commit', status: 'completed' },
    { date: 'Feb 2026', task: 'Submit to ISEF', status: 'pending' }
  ];

  const leaderboardData = [
    { name: 'Akylbek Eslambek', xp: 2200, avatar: '' },
    { name: 'Steve Smith', xp: 300, avatar: '' },
    { name: 'Jom Daser', xp: 200, avatar: '' },
    { name: 'Mary Joe', xp: 120, avatar: '' },
    { name: 'Allen Winor', xp: 50, avatar: '' }
  ];

  const badges = [
    { icon: '🏆', label: 'Hackathon Winner', color: '[#750014]' },
    { icon: '💻', label: '50+ LeetCode', color: '[#750014]' },
    { icon: '🎯', label: '7-Week Cycle', color: '[#750014]' }
  ];

  const researchPapers = [
    { title: 'Neural Networks in Computer Vision', author: 'Team Alpha', tags: ['Computer Vision', 'Deep Learning'], citations: 12 },
    { title: 'Ethics in AI Development', author: 'Anna Name', tags: ['Ethics', 'AI'], citations: 8 },
    { title: 'NLP for Kazakh Language', author: 'Marc Name', tags: ['NLP', 'Research'], citations: 15 }
  ];

  const skillNodes = [
    { skill: 'Python', level: 90, category: 'Programming' },
    { skill: 'PyTorch', level: 75, category: 'ML Framework' },
    { skill: 'Linear Algebra', level: 85, category: 'Math' },
    { skill: 'Git', level: 95, category: 'Tools' },
    { skill: 'OpenCV', level: 70, category: 'Computer Vision' }
  ];

  const alumni = [
    { name: 'John Doe', university: 'MIT', year: '2024', role: 'ML Engineer' },
    { name: 'Sarah Smith', university: 'Stanford', year: '2023', role: 'Research Scientist' }
  ];

  const deadlines = [
    { event: 'ISEF Registration', date: '2026-02-15', daysLeft: 29 },
    { event: 'MIT Early Action', date: '2026-11-01', daysLeft: 288 },
    { event: 'AI Hackathon', date: '2026-03-20', daysLeft: 62 }
  ];

  // Обработчик перетаскивания
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCardsConfig((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Переключение видимости карточки
  const toggleCard = (id) => {
    setCardsConfig((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  };

  // Рендер содержимого карточек
  const renderCardContent = (cardId) => {
    switch (cardId) {
      case 'courses':
        return (
          <div className="relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
              <h2 className="text-2xl font-light mb-6">My courses</h2>

              <div className="backdrop-blur-[35px] bg-white/20 border border-white/50 rounded-2xl p-6 shadow-[0_4px_16px_0_rgba(31,38,135,0.15)]">
                <h3 className="text-xl font-normal mb-6">Harvard CS50 AI</h3>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">60% Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <button className="flex-1 px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-lg transition-all duration-300 text-sm">
                    Continue Course
                  </button>
                  <button className="flex-1 px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-lg transition-all duration-300 text-sm">
                    View Syllabus
                  </button>
                </div>

                <div className="space-y-1 text-sm text-gray-700">
                  <p>Instructor: David J. Malan</p>
                  <p>Duration: 12 Weeks</p>
                  <p>Level: Intermediate</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'pow':
        return (
          <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6" />
              <h2 className="text-2xl font-light">Proof of Work</h2>
            </div>
            <div className="relative border-l-2 border-[#750014]/30 ml-2 space-y-6">
              {proofOfWork.map((item, i) => (
                <div key={i} className="relative pl-6">
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${item.status === 'completed' ? 'bg-[#750014]' : 'bg-gray-300 border-2 border-white'}`} />
                  <p className="text-xs font-bold text-[#750014] uppercase tracking-tighter">{item.date}</p>
                  <p className="text-sm font-normal text-gray-800">{item.task}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'pulse':
        return (
          <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-light">Project Pulse</h2>
              <Github className="w-6 h-6" />
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-normal text-green-600">● 3 Open PRs</span>
                <span className="text-gray-500">Last commit: 2h ago</span>
              </div>
              <div className="flex items-end gap-1 h-12 w-full bg-gray-100/50 rounded-lg p-2">
                {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
                  <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-[#750014] rounded-t-sm" />
                ))}
              </div>
            </div>
          </div>
        );

      case 'leaderboard':
        return (
          <div className="relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-light">Leaderboard & XP</h2>
                <Crown className="w-6 h-6" />
              </div>

              <div className="space-y-4">
                {leaderboardData.map((user, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-4 border-b border-gray-200/50 last:border-0 rounded-xl hover:bg-white/30 hover:shadow-[0_4px_16px_0_rgba(31,38,135,0.15)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-xl">
                        {user.avatar}
                      </div>
                      <span className="font-normal">{user.name}</span>
                    </div>
                    <span className="font-medium text-lg">{user.xp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-light">Member Profile</h2>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400"></div>
                  <div>
                    <p className="font-normal">Anna</p>
                    <p className="text-gray-600 font-light text-sm">Core Member</p>
                  </div>
                </div>
                <button className="hover:scale-125 hover:rotate-12 transition-all duration-300">
                  <Settings className="w-6 h-6" />
                </button>
              </div>

              <div>
                <p className="text-xs font-normal text-gray-600 mb-2">Achievements</p>
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge, idx) => (
                    <div key={idx} className={`flex items-center gap-1 px-3 py-1.5 rounded-full bg-${badge.color} text-white text-xs font-normal shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer`}>
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'projectBase':
        return (
          <div className="relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-light">Project Base</h2>
                <Folder className="w-6 h-6" />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="font-normal mb-2">Sample Project Title</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <p className="font-normal mb-2">Sample Project Title</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="relative">
            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" />
                <h3 className="text-lg font-light">Skill Matrix</h3>
              </div>
              <div className="space-y-3">
                {skillNodes.map((skill, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-normal">{skill.skill}</span>
                      <span className="text-xs text-black-600">{skill.level}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: `${skill.level}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'wallOfProof':
        return (
          <div className="relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5" />
                <h3 className="text-lg font-light">Wall of Proof</h3>
              </div>
              <div className="space-y-3">
                <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4" />
                    <span className="text-sm font-normal">GitHub</span>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    <span className="text-sm font-normal">LeetCode</span>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm font-normal">LinkedIn</span>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        );

      case 'deadlines':
        return (
          <div className="relative">
            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5" />
                <h3 className="text-lg font-light">Upcoming Deadlines</h3>
              </div>
              <div className="space-y-3">
                {deadlines.map((deadline, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-normal">{deadline.event}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-700">{deadline.daysLeft}d</span>
                    </div>
                    <p className="text-xs text-gray-600">{deadline.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'heatmap':
        return (
          <div className="relative">
            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5" />
                <h3 className="text-lg font-light">Activity Heatmap</h3>
              </div>
              <div className="grid grid-cols-12 gap-2">
                {Array.from({ length: 84 }).map((_, idx) => {
                  const intensity = Math.random();
                  const bgColor = intensity > 0.7 ? 'bg-green-600' : intensity > 0.4 ? 'bg-green-400' : intensity > 0.2 ? 'bg-green-200' : 'bg-gray-200';
                  return (
                    <div key={idx} className={`aspect-square rounded ${bgColor} hover:scale-125 transition-all duration-200 cursor-pointer`}></div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-3">42 contributions in the last 3 months</p>
            </div>
          </div>
        );

      default:
        return <div>Card not found</div>;
    }
  };
  const visibleCards = cardsConfig.filter(card => card.visible);
  const hiddenCards = cardsConfig.filter(card => !card.visible);
  return (
    <OverlayScrollbarsComponent
      defer
      options={{
        scrollbars: {
          theme: 'os-theme-ait',
          autoHide: 'move',
          autoHideDelay: 600,
          autoHideSuspend: false,
          clickScroll: true,
        }
      }}
      className="h-screen w-full"
    >
      <div className="relative w-full bg-gradient-to-br from-gray-100 via-[#750014]/5 p-8 font-light" style={{ fontFamily: "'SF Pro Rounded', 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", zoom: "80%" }}>
        {/* Фоновый слой — вынесен за пределы AnimatePresence */}
        <div className="fixed inset-0 overflow-hidden bg-[#f8f9fa]" style={{ zIndex: -1 }}>
          {/* Пятно 1 */}
          <motion.div
            animate={{
              left: ["10%", "50%", "10%", "10%"],
              top: ["10%", "10%", "50%", "10%"],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute top-[5%] left-[15%] w-[30vw] h-[30vw] bg-[#1B263B]/75 rounded-full blur-[100px] will-change: transform"
          />

          {/* Пятно 2 */}
          <motion.div
            animate={{
              right: ["5%", "10%", "5%"],
              top: ["15%", "12%", "15%"],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute w-[35vw] h-[35vw] bg-[#4A5568]/75 rounded-full blur-[90px] will-change: transform"
          />

          <motion.div
            animate={{
              left: ["30%", "10%", "30%"],
              top: ["40%", "45%", "40%"],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            /* Изменен цвет на более холодный и темный синий, чтобы создать глубину в центре */
            className="absolute top-[30%] left-[25%] w-[45vw] h-[45vw] bg-[#8957E5]/75 rounded-full blur-[130px] will-change: transform"
          />

          {/* Пятно 4 (Нижний угол) */}
          <motion.div
            animate={{
              left: ["-5%", "5%", "-5%"],
              bottom: ["5%", "15%", "5%"],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute bottom-[5%] right-[5%] w-[30vw] h-[30vw] bg-[#C5A059]/75 rounded-full blur-[110px] will-change: transform"
          />
          <motion.div
            animate={{
              right: ["5%", "15%", "5%"],
              bottom: ["10%", "5%", "10%"],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute bottom-[5%] left-[5%] w-[30vw] h-[30vw] bg-[#00B5AD]/75 rounded-full blur-[110px] will-change: transform"
          />
        </div>
        <div className="relative z-10 p-8 min-h-screen">
          {isDevMode && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-2 rounded-full shadow-2xl animate-bounce flex items-center gap-2">
              <Settings className="w-4 h-4 animate-spin" />
              <span className="font-bold text-sm tracking-widest uppercase">Developer Mode: Edit Layout</span>
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold tracking-wider">
              AIT<span className="font-light">HUB</span>
            </h1>
          </div>

          {/* Navigation Bar */}
          <div className="max-w-7xl mx-auto mb-8 relative">

            <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-full px-6 py-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button onClick={() => setActiveTab('dashboard')} className="hover:scale-110 hover:rotate-12 transition-all duration-300">
                    <Home className="w-6 h-6" />
                  </button>
                  <button className="hover:scale-110 hover:rotate-12 transition-all duration-300">
                    <Search className="w-6 h-6" />
                  </button>
                  <button onClick={() => setActiveTab('research')} className="hover:scale-110 transition-all duration-300">
                    <BookOpen className="w-5 h-5" />
                  </button>
                  <button onClick={() => setActiveTab('network')} className="hover:scale-110 transition-all duration-300">
                    <Network className="w-5 h-5" />
                  </button>
                  <button onClick={() => setActiveTab('resources')} className="hover:scale-110 transition-all duration-300">
                    <Database className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <button className="hover:scale-110 hover:rotate-12 transition-all duration-300">
                    <User className="w-6 h-6" />
                  </button>
                  <button className="px-6 py-2 border-2 border-gray-900 rounded-full font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.25)] transition-all duration-300">
                    Apply Now
                  </button>
                  <button className="hover:scale-110 hover:rotate-12 transition-all duration-300">
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Main Content - Dashboard */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-7xl mx-auto"
              >
                {/* Панель управления виджетами */}
                {hiddenCards.length > 0 && (
                  <motion.div
                    variants={cardVariants}
                    className="mb-8 backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-lg"
                  >
                    <h3 className="text-lg font-light mb-4">Доступные виджеты</h3>
                    <div className="flex flex-wrap gap-2">
                      {hiddenCards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => toggleCard(card.id)}
                          className="px-4 py-2 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
                        >
                          + {card.title}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={visibleCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-6" style={{
                      columnFill: 'balance'
                    }}>
                      {visibleCards.map((card) => (
                        <SortableCard key={card.id} id={card.id} onHide={toggleCard} isDevMode={isDevMode}>
                          {renderCardContent(card.id)}
                        </SortableCard>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </motion.div>
            )}

            {/* Research Papers Tab */}
            {activeTab === 'research' && (
              <motion.div
                key="research"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-7xl mx-auto"
              >
                <div className="relative">

                  <motion.div
                    variants={cardVariants}
                    className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <FileText className="w-7 h-7" />
                      <h2 className="text-3xl font-light">Research & Paper Repository</h2>
                    </div>

                    <div className="space-y-4">
                      {researchPapers.map((paper, idx) => (
                        <div
                          className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-normal mb-1">{paper.title}</h3>
                              <p className="text-sm text-gray-600">By {paper.author}</p>
                            </div>
                            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#750014]/10 text-[#750014] text-sm">
                              <Target className="w-4 h-4" />
                              <span>{paper.citations} citations</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {paper.tags.map((tag, tidx) => (
                              <span key={tidx} className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-xs font-normal">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Network & Alumni Tab */}
            {activeTab === 'network' && (
              <motion.div
                key="network"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-7xl mx-auto"
              >
                <div className="relative">

                  <motion.div
                    variants={cardVariants}
                    className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-7 h-7" />
                      <h2 className="text-3xl font-light">Alumni & Mentorship</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {alumni.map((person, idx) => (
                        <div
                          className="p-6 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-normal mb-1">{person.name}</h3>
                              <p className="text-sm text-gray-600">{person.university} '{person.year}</p>
                              <p className="text-sm text-gray-700 font-normal mt-1">{person.role}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-300 to-purple-400"></div>
                          </div>
                          <button className="w-full px-4 py-2 border-2 border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm">
                            Book 15-min Meeting
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              <motion.div
                key="resources"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-7xl mx-auto"
              >
                <div className="relative">

                  <motion.div
                    variants={cardVariants}
                    className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <Database className="w-7 h-7" />
                      <h2 className="text-3xl font-light">Resource Library</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div
                        className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                      >
                        <Zap className="w-6 h-6 mb-3" />
                        <h4 className="font-normal mb-2">Cloud Credits</h4>
                        <p className="text-sm text-gray-600">Google Colab Pro, AWS Credits</p>
                      </div>
                      <div
                        variants={cardVariants}
                        className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                      >
                        <FileText className="w-6 h-6 mb-3" />
                        <h4 className="font-normal mb-2">Templates</h4>
                        <p className="text-sm text-gray-600">LaTeX, Notion Dashboards</p>
                      </div>
                      <div
                        className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                      >
                        <Database className="w-6 h-6 mb-3" />
                        <h4 className="font-normal mb-2">Datasets</h4>
                        <p className="text-sm text-gray-600">Verified Research Data</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </OverlayScrollbarsComponent>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Trophy, 
  Settings, 
  Plus, 
  Save, 
  Lock, 
  Unlock, 
  FileSpreadsheet, 
  ChevronRight, 
  BarChart3,
  LogOut,
  UserCircle2,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  Download,
  Upload,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';

const DraggableAny = Draggable as any;
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Competition, 
  Class, 
  Event, 
  Judge, 
  Score, 
  PointConversion, 
  FullCompetitionData 
} from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  [key: string]: any;
}

const Card = ({ children, className, id, ...props }: CardProps) => (
  <div id={id} className={cn("bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  disabled,
  id,
  size = 'md'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg',
    secondary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100 shadow-lg',
    outline: 'border border-indigo-100 hover:bg-indigo-50 bg-white text-indigo-600',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-100 shadow-lg',
    ghost: 'hover:bg-black/5'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 whitespace-nowrap",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder,
  className,
  id,
  onKeyDown
}: { 
  label?: string; 
  type?: string; 
  value: string | number; 
  onChange: (val: any) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && <label className="text-xs font-semibold uppercase tracking-wider text-black/50 ml-1">{label}</label>}
    <input
      id={id}
      type={type}
      value={value === undefined || value === null || (typeof value === 'number' && isNaN(value)) ? "" : value}
      onChange={(e) => {
        const val = e.target.value;
        if (type === 'number') {
          const parsed = parseFloat(val);
          onChange(isNaN(parsed) ? 0 : parsed);
        } else {
          onChange(val);
        }
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className="px-4 py-2.5 bg-black/5 border-none rounded-xl focus:ring-2 focus:ring-black/10 outline-none transition-all placeholder:text-black/30"
    />
  </div>
);

const Textarea = ({ 
  label, 
  value, 
  onChange, 
  placeholder,
  className,
  id,
  rows = 4
}: { 
  label?: string; 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  rows?: number;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && <label className="text-xs font-semibold uppercase tracking-wider text-black/50 ml-1">{label}</label>}
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="px-4 py-2.5 bg-black/5 border-none rounded-xl focus:ring-2 focus:ring-black/10 outline-none transition-all placeholder:text-black/30 resize-none"
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [userRole, setUserRole] = useState<'admin' | 'judge' | 'btc' | null>(null);
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [data, setData] = useState<FullCompetitionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'classes' | 'judges' | 'scoring' | 'summary' | 'rankings' | 'settings'>('dashboard');
  const [rankingEventId, setRankingEventId] = useState<string | 'overall' | null>('overall');
  const [rankingGrade, setRankingGrade] = useState<string>('all');
  const [rankingLimit, setRankingLimit] = useState<number | 'all'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [newCompName, setNewCompName] = useState('');
  const [newCompDate, setNewCompDate] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState<'normal' | 'discipline' | 'hygiene'>('normal');
  const [newEventWeight, setNewEventWeight] = useState(1);
  const [newEventRounds, setNewEventRounds] = useState(1);
  const [newEventRoundNames, setNewEventRoundNames] = useState<string[]>([]);
  const [newEventRankingScope, setNewEventRankingScope] = useState<'grade' | 'school'>('grade');

  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');
  const [newClassCount, setNewClassCount] = useState(1);
  const [newClassBonusPoints, setNewClassBonusPoints] = useState(0);
  const [newClassPenaltyPoints, setNewClassPenaltyPoints] = useState(0);

  const [showAddJudge, setShowAddJudge] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [newJudgeCode, setNewJudgeCode] = useState('');
  const [newJudgeAssignedEvents, setNewJudgeAssignedEvents] = useState<string[]>([]);
  const [newJudgeIsBonusPenalty, setNewJudgeIsBonusPenalty] = useState(false);
  const [judgeLoginCode, setJudgeLoginCode] = useState('');
  const [loggedInJudge, setLoggedInJudge] = useState<Judge | null>(null);
  const [loginError, setLoginError] = useState('');

  const [conversions, setConversions] = useState<PointConversion[]>([]);
  const [pendingScores, setPendingScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState<{ tab?: typeof activeTab; eventId?: string; judgeId?: string } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompId) {
      fetchFullData(selectedCompId);
    }
  }, [selectedCompId]);

  useEffect(() => {
    if (selectedEventId && data) {
      const judgeId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
      if (judgeId) {
        const initialScores: Record<string, number> = {};
        data.scores.forEach(s => {
          if (s.event_id === selectedEventId && s.judge_id === judgeId) {
            const key = `${s.class_id}-${s.round}-${s.category || 'none'}`;
            initialScores[key] = s.score;
          }
        });
        setPendingScores(initialScores);
        setIsDirty(false);
      }
    }
  }, [selectedEventId, selectedJudgeId, userRole, loggedInJudge?.id, data]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const fetchCompetitions = async () => {
    const res = await fetch('/api/competitions');
    const json = await res.json();
    setCompetitions(json);
    if (json.length === 1 && !selectedCompId) {
      const comp = json[0];
      if (userRole === 'admin' || !comp.is_locked) {
        setSelectedCompId(comp.id);
      }
    }
  };

  const handleCreateCompetition = async () => {
    if (!newCompName || !newCompDate) {
      alert("Vui lòng nhập đầy đủ tên và ngày tổ chức");
      return;
    }
    try {
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompName, date: newCompDate })
      });
      if (res.ok) {
        const result = await res.json();
        setNewCompName('');
        setNewCompDate('');
        await fetchCompetitions();
        setSelectedCompId(result.id);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Có lỗi xảy ra khi tạo hội thi");
      }
    } catch (error) {
      console.error(error);
      alert("Không thể kết nối đến máy chủ");
    }
  };

  const handleToggleLockCompetition = async (compId: string, currentLocked: boolean) => {
    try {
      const res = await fetch(`/api/competitions/${compId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: !currentLocked })
      });
      if (res.ok) {
        await fetchCompetitions();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCompetition = async (compId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hội thi này? Tất cả dữ liệu liên quan sẽ bị mất vĩnh viễn.")) {
      return;
    }
    try {
      const res = await fetch(`/api/competitions/${compId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchCompetitions();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddEvent = async () => {
    if (!newEventName) return;
    const payload = { name: newEventName, competition_id: selectedCompId, type: newEventType, round_count: newEventRounds, weight: newEventWeight, round_names: newEventRoundNames.slice(0, newEventRounds), ranking_scope: newEventRankingScope };
    if (editingEvent) {
      const res = await fetch(`/api/events/${editingEvent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setNewEventName(''); setEditingEvent(null); setShowAddEvent(false); fetchFullData(selectedCompId!); }
    } else {
      const order = data ? data.events.length : 0;
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, order }) });
      if (res.ok) { setNewEventName(''); setShowAddEvent(false); fetchFullData(selectedCompId!); }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Xóa nội dung này?")) return;
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) fetchFullData(selectedCompId!);
  };

  const handleAddClass = async () => {
    if (!newClassName || !newClassGrade) return;
    if (editingClass) {
      const res = await fetch(`/api/classes/${editingClass.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newClassName.trim(), grade: newClassGrade, bonus_points: newClassBonusPoints, penalty_points: newClassPenaltyPoints }) });
      if (res.ok) { setShowAddClass(false); setEditingClass(null); fetchFullData(selectedCompId!); }
    } else {
      const classNames = newClassName.split('\n').map(n => n.trim()).filter(n => n !== '');
      setIsSaving(true);
      try {
        const baseOrder = data ? data.classes.length : 0;
        await Promise.all(classNames.map((name, idx) => fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, grade: newClassGrade, competition_id: selectedCompId, order: baseOrder + idx }) })));
        setShowAddClass(false); fetchFullData(selectedCompId!);
      } finally { setIsSaving(false); }
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Xóa lớp này?")) return;
    const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
    if (res.ok) fetchFullData(selectedCompId!);
  };

  const handleAddJudge = async () => {
    if (!newJudgeName || !newJudgeCode) return;
    const payload = { name: newJudgeName, code: newJudgeCode, competition_id: selectedCompId, assigned_event_ids: newJudgeAssignedEvents, is_bonus_penalty_judge: newJudgeIsBonusPenalty };
    if (editingJudge) {
      const res = await fetch(`/api/judges/${editingJudge.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setEditingJudge(null); setShowAddJudge(false); fetchFullData(selectedCompId!); }
    } else {
      const order = data ? data.judges.length : 0;
      const res = await fetch('/api/judges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, order }) });
      if (res.ok) { setShowAddJudge(false); fetchFullData(selectedCompId!); }
    }
  };

  const handleDeleteJudge = async (id: string) => {
    if (!confirm('Xóa giám khảo?')) return;
    const res = await fetch(`/api/judges/${id}`, { method: 'DELETE' });
    if (res.ok) fetchFullData(selectedCompId!);
  };

  const handleJudgeLogin = async () => {
    if (!judgeLoginCode || !selectedCompId) return;
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/judges/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: judgeLoginCode.trim(), competition_id: selectedCompId }) });
      if (res.ok) { setLoggedInJudge(await res.json()); setUserRole('judge'); setActiveTab('scoring'); }
      else setLoginError("Mã sai hoặc hội thi đã khóa");
    } finally { setIsLoggingIn(false); }
  };

  const handleLockAllEvents = async (lock: boolean) => {
    if (!confirm(`${lock ? 'Khóa' : 'Mở'} tất cả?`)) return;
    const res = await fetch('/api/events/lock-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competition_id: selectedCompId, is_locked: lock }) });
    if (res.ok) fetchFullData(selectedCompId!);
  };

  const handleSaveConversions = async () => {
    const res = await fetch('/api/conversions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversions }) });
    if (res.ok) { alert("Đã lưu!"); fetchFullData(selectedCompId!); }
  };

  const handleReorder = async (collection: string, items: any[]) => {
    const reorderData = items.map((item, index) => ({ id: item.id, order: index }));
    await fetch('/api/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection, items: reorderData }) });
    fetchFullData(selectedCompId!);
  };

  const onDragEnd = (result: DropResult, type: 'events' | 'classes' | 'judges', grade?: string) => {
    if (!result.destination || !data) return;
    if (result.destination.index === result.source.index) return;
    if (type === 'events') {
      const items = Array.from(data.events);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setData({ ...data, events: items });
      handleReorder('events', items);
    } else if (type === 'judges') {
      const items = Array.from(data.judges);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setData({ ...data, judges: items });
      handleReorder('judges', items);
    } else if (type === 'classes' && grade) {
      const items = Array.from(classesByGrade[grade]);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      const newClasses = data.classes.map(c => {
        if (c.grade === grade) {
          const newIndex = (items as any[]).findIndex(it => it.id === c.id);
          if (newIndex !== -1) return { ...c, order: newIndex };
        }
        return c;
      });
      newClasses.sort((a, b) => a.grade !== b.grade ? a.grade.localeCompare(b.grade) : (a.order || 0) - (b.order || 0));
      setData({ ...data, classes: newClasses });
      handleReorder('classes', items);
    }
  };

  const exportScoringTemplate = async () => alert("Chức năng đang tải dữ liệu...");
  const handleImportExcel = async (e: any) => alert("Vui lòng sử dụng file mẫu.");

  const fetchFullData = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/competitions/${id}/full`);
    const json = await res.json();
    setData(json);
    setConversions(json.conversions);
    setLoading(false);
  };

  const handleSaveScore = async (classId: string, eventId: string, judgeId: string, round: number, score: number, category?: string) => {
    setPendingScores(prev => ({ ...prev, [`${classId}-${round}-${category || 'none'}`]: score }));
    setIsDirty(true);
  };

  const handleBulkSaveScore = async () => {
    const judgeId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
    if (!judgeId || !selectedEventId) return;
    setIsSaving(true);
    const scoresToSave = Object.entries(pendingScores).map(([key, score]) => {
      const [classId, round, category] = key.split('-');
      return { class_id: classId, event_id: selectedEventId, judge_id: judgeId, round: Number(round), score, category: category === 'none' ? null : category };
    });
    try {
      const res = await fetch('/api/scores/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores: scoresToSave }) });
      if (res.ok) { alert("Thành công!"); setIsDirty(false); fetchFullData(selectedCompId!); }
    } finally { setIsSaving(false); }
  };

  const handleLockEvent = async (eventId: string, isLocked: boolean) => {
    await fetch(`/api/events/${eventId}/lock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_locked: isLocked }) });
    fetchFullData(selectedCompId!);
  };

  const exportToExcel = async () => {
    if (!data) return;
    const workbook = new ExcelJS.Workbook();
    const wsSummary = workbook.addWorksheet("TỔNG HỢP");
    wsSummary.addRow([`KẾT QUẢ - ${data.competition.name.toUpperCase()}`]);
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${data.competition.name}_KetQua.xlsx`);
  };

  const exportEventRankings = async (eventId: string) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("XepHang");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `XepHang.xlsx`);
  };

  const eventResults = useMemo(() => {
    if (!data) return [];
    return data.events.map(event => ({ event, results: data.classes.map(cls => ({ classId: cls.id, className: cls.name, grade: cls.grade, totalScore: 0, judgeScores: {}, hasScores: false, rank: 0, convertedPoints: 0 })) }));
  }, [data]);

  const overallSummary = useMemo(() => {
    if (!data) return [];
    return data.classes.map(c => ({ classId: c.id, className: c.name, grade: c.grade, totalPoints: 0, overallRank: 1, bonus_points: 0, penalty_points: 0 }));
  }, [data]);

  const handleTabChange = (tab: typeof activeTab) => {
    if (isDirty) setShowNavigationWarning({ tab });
    else { setActiveTab(tab); setIsMobileMenuOpen(false); }
  };

  const confirmNavigation = () => {
    if (showNavigationWarning) {
      const { tab, eventId, judgeId } = showNavigationWarning;
      setIsDirty(false);
      if (tab) setActiveTab(tab);
      if (eventId) setSelectedEventId(eventId);
      if (judgeId) setSelectedJudgeId(judgeId);
      setShowNavigationWarning(null);
      setIsMobileMenuOpen(false);
    }
  };

  if (!userRole) {
    if (showAdminLogin) {
      return (
        <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
          <Card className="w-full max-w-md p-8 space-y-8 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock className="text-white" size={32} /></div>
              <h1 className="text-3xl font-bold">Quản trị</h1>
            </div>
            <div className="space-y-4">
              <Input label="Mật khẩu" value={adminLoginPassword} onChange={setAdminLoginPassword} type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleAdminLogin()} />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1 py-4 h-14" onClick={() => setShowAdminLogin(false)}>Quay lại</Button>
                <Button className="flex-1 py-4 h-14" onClick={handleAdminLogin}>Đăng nhập</Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <Trophy className="mx-auto text-indigo-600" size={60} />
          <h1 className="text-4xl font-bold">Hệ thống Điểm</h1>
          <div className="grid gap-4">
            <button onClick={() => setShowAdminLogin(true)} className="group bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all flex items-center gap-6 text-left">
              <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center shrink-0"><Settings size={28} /></div>
              <div><h3 className="font-bold text-lg">Quản trị</h3><p className="text-sm text-black/40">Cấu hình hội thi</p></div>
            </button>
            <button onClick={() => setUserRole('judge')} className="group bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all flex items-center gap-6 text-left">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><Trophy size={28} /></div>
              <div><h3 className="font-bold text-lg">Giám khảo</h3><p className="text-sm text-black/40">Nhập điểm thi</p></div>
            </button>
            <button onClick={() => setUserRole('btc')} className="group bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all flex items-center gap-6 text-left">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"><LayoutDashboard size={28} /></div>
              <div><h3 className="font-bold text-lg">Ban tổ chức</h3><p className="text-sm text-black/40">Xem kết quả</p></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'judge' && !loggedInJudge) {
    return (
      <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 space-y-6 shadow-xl">
          <h2 className="text-2xl font-bold text-center">Đăng nhập Giám khảo</h2>
          <div className="space-y-4">
            <select value={selectedCompId || ''} onChange={(e) => setSelectedCompId(e.target.value)} className="w-full px-4 py-3 bg-black/5 rounded-xl outline-none font-medium">
              <option value="">-- Chọn hội thi --</option>
              {competitions.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
            </select>
            <Input label="Mã giám khảo" value={judgeLoginCode} onChange={setJudgeLoginCode} type="password" onKeyDown={(e:any) => e.key === 'Enter' && handleJudgeLogin()} />
            <Button className="w-full py-4 h-14" onClick={handleJudgeLogin} disabled={!selectedCompId || !judgeLoginCode || isLoggingIn}>Đăng nhập</Button>
            <Button variant="ghost" className="w-full" onClick={() => setUserRole(null)}>Quay lại</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!selectedCompId) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Chọn Hội thi</h1><Button variant="ghost" onClick={() => setUserRole(null)}><LogOut size={18} /> Thoát</Button></div>
          <div className="grid sm:grid-cols-2 gap-4">
            {competitions.map(comp => (
              <Card key={comp.id} className={cn("p-6 group relative border-2 border-transparent hover:border-indigo-100", comp.is_locked && userRole !== 'admin' && "opacity-60 grayscale")}>
                <h3 className="font-bold text-xl mb-4">{comp.name}</h3>
                <Button variant="outline" className="w-full" onClick={() => setSelectedCompId(comp.id)}>Tiếp tục <ChevronRight size={16} /></Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50/20 flex flex-col lg:flex-row font-sans overflow-hidden">
      {/* Mobile Header (SỬA LẠI: Luôn ở trên cùng) */}
      <header className="lg:hidden bg-white border-b border-indigo-100 p-4 sticky top-0 z-[100] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200"><Trophy className="text-white" size={20} /></div>
          <h2 className="font-bold truncate text-indigo-950 max-w-[200px]">{data?.competition.name}</h2>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-black/5 rounded-lg">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-[110] w-72 bg-white border-r border-indigo-100 flex flex-col shadow-xl lg:relative lg:translate-x-0 transition-transform duration-300", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-1.5">
            <NavItem active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} icon={<LayoutDashboard size={20} />} label="Tổng quan" />
            <NavItem active={activeTab === 'scoring'} onClick={() => handleTabChange('scoring')} icon={<CheckCircle2 size={20} />} label="Chấm điểm" />
            <NavItem active={activeTab === 'summary'} onClick={() => handleTabChange('summary')} icon={<BarChart3 size={20} />} label="Bảng tổng hợp" />
          </nav>
        </div>
        <div className="p-6 border-t border-indigo-50">
          <Button variant="ghost" className="w-full text-rose-500" onClick={() => setUserRole(null)}>Đăng xuất</Button>
        </div>
      </aside>

      {/* Main Content Area (BỎ OVERFLOW HIDDEN TẠI ĐÂY) */}
      <main className="flex-1 overflow-y-auto relative h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'scoring' && data && (
            <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 lg:p-8 space-y-6 min-h-screen">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <h1 className="text-3xl font-bold">Chấm điểm chuyên môn</h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={selectedEventId || ''} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full px-4 py-3 bg-white border border-black/5 rounded-2xl outline-none font-medium shadow-sm">
                  <option value="">-- Chọn môn thi --</option>
                  {data.events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {userRole === 'admin' && (
                  <select value={selectedJudgeId || ''} onChange={(e) => setSelectedJudgeId(e.target.value)} className="w-full px-4 py-3 bg-white border border-black/5 rounded-2xl outline-none font-medium shadow-sm">
                    <option value="">-- Chọn Giám khảo --</option>
                    {data.judges.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                )}
              </div>

              {selectedEventId && (selectedJudgeId || userRole === 'judge') && (
                <div className="relative">
                  {/* --- ACTION BAR CỐ ĐỊNH (STICKY 1) --- */}
                  <div className="sticky top-[-16px] lg:top-[-32px] z-[95] bg-indigo-50/95 backdrop-blur-md p-4 -mx-4 lg:-mx-8 border-y border-indigo-100 shadow-md flex justify-between items-center h-[72px]">
                    <span className={cn("text-sm font-bold", isDirty ? "text-amber-600 animate-pulse" : "text-emerald-600")}>
                      {isDirty ? "● Thay đổi chưa lưu" : "✓ Dữ liệu an toàn"}
                    </span>
                    <Button onClick={handleBulkSaveScore} disabled={isSaving || !isDirty} className="h-11 px-8 shadow-indigo-300">Lưu tất cả</Button>
                  </div>

                  {/* BẢNG DỮ LIỆU */}
                  <Card className="overflow-visible border-indigo-100 shadow-xl mt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-max">
                        {/* --- THEAD CỐ ĐỊNH (STICKY 2) --- */}
                        <thead className="sticky top-[56px] lg:top-[40px] z-[90] bg-slate-100 shadow-sm">
                          <tr className="bg-slate-200/50">
                            <th className="px-6 py-4 font-bold text-sm uppercase text-indigo-900 border-b min-w-[200px]">Lớp / Đơn vị</th>
                            {Array.from({ length: data.events.find(e=>e.id===selectedEventId)?.round_count || 1 }).map((_, i) => (
                              <th key={i} className="px-6 py-4 font-bold text-sm uppercase text-indigo-900 text-center border-b min-w-[120px]">Lần {i+1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(classesByGrade).map(([grade, classes]: any) => (
                            <React.Fragment key={grade}>
                              {/* --- TIÊU ĐỀ KHỐI CỐ ĐỊNH (STICKY 3) --- */}
                              <tr className="sticky top-[108px] lg:top-[92px] z-[85] bg-indigo-50/95 backdrop-blur-sm shadow-sm border-y border-indigo-100">
                                <td colSpan={10} className="px-6 py-2.5 font-black text-indigo-600 text-xs uppercase tracking-widest">
                                  Khối {grade}
                                </td>
                              </tr>
                              {classes.map((cls: any) => (
                                <tr key={cls.id} className="border-t border-black/5 hover:bg-indigo-50/30 transition-colors">
                                  <td className="px-6 py-4 font-bold text-indigo-950">{cls.name}</td>
                                  {Array.from({ length: data.events.find(e=>e.id===selectedEventId)?.round_count || 1 }).map((_, i) => (
                                    <td key={i} className="px-6 py-4 text-center">
                                      <ScoreInput value={pendingScores[`${cls.id}-${i + 1}-none`] || 0} onChange={(val: number) => handleSaveScore(cls.id, selectedEventId, (userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId)!, i + 1, val)} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'dashboard' && <div className="p-8 text-2xl font-bold">Chào mừng Ban tổ chức hội thi!</div>}
          {activeTab === 'summary' && <div className="p-8 text-2xl font-bold">Bảng tổng hợp kết quả hội thi.</div>}
        </AnimatePresence>
      </main>

      {/* Navigation Warning Modal */}
      <AnimatePresence>
        {showNavigationWarning && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6"><AlertCircle className="text-amber-500" size={32} /></div>
              <h3 className="text-2xl font-bold mb-3 text-indigo-950">Thay đổi chưa lưu!</h3>
              <p className="text-indigo-600/70 mb-8">Dữ liệu chấm điểm sẽ mất nếu bạn rời đi. Bạn có muốn lưu lại không?</p>
              <div className="flex gap-3"><Button variant="outline" className="flex-1 py-4 font-bold" onClick={() => setShowNavigationWarning(null)}>Ở lại</Button><Button variant="danger" className="flex-1 py-4 font-bold" onClick={confirmNavigation}>Vẫn rời đi</Button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold", active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]" : "text-indigo-600/60 hover:bg-indigo-50")}>
      <span className="shrink-0">{icon}</span><span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon }: any) {
  return (
    <Card className="p-6 border-indigo-50 shadow-sm">
      <div className="flex justify-between items-start mb-4"><div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">{icon}</div></div>
      <p className="text-3xl font-bold text-indigo-950">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600/40">{label}</p>
    </Card>
  );
}

function ScoreInput({ value, onChange, disabled }: any) {
  const [localValue, setLocalValue] = useState(isNaN(value) ? "" : value.toString());
  useEffect(() => { setLocalValue(isNaN(value) ? "" : value.toString()); }, [value]);
  return (
    <input
      type="number"
      value={localValue}
      disabled={disabled}
      inputMode="decimal"
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => { const num = parseFloat(localValue); onChange(isNaN(num) ? 0 : num); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-20 px-3 py-2 bg-black/5 border-none rounded-xl text-center font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none text-base"
    />
  );
}

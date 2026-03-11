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
    outline: 'border border-black/10 hover:bg-black/5 bg-white',
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
        "rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2",
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

  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');
  const [newClassCount, setNewClassCount] = useState(1);

  const [showAddJudge, setShowAddJudge] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [newJudgeCode, setNewJudgeCode] = useState('');
  const [judgeLoginCode, setJudgeLoginCode] = useState('');
  const [loggedInJudge, setLoggedInJudge] = useState<Judge | null>(null);
  const [loginError, setLoginError] = useState('');

  const [conversions, setConversions] = useState<PointConversion[]>([]);
  const [pendingScores, setPendingScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
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

  // Initialize pending scores when event/judge changes
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
      }
    }
  }, [selectedEventId, selectedJudgeId, userRole, loggedInJudge?.id, data]);

  const fetchCompetitions = async () => {
    const res = await fetch('/api/competitions');
    const json = await res.json();
    setCompetitions(json);
    if (json.length === 1 && !selectedCompId) {
      setSelectedCompId(json[0].id);
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

  const handleAddEvent = async () => {
    if (!newEventName) return;
    
    const payload = { 
      name: newEventName, 
      competition_id: selectedCompId, 
      type: newEventType, 
      round_count: newEventRounds, 
      weight: newEventWeight,
      round_names: newEventRoundNames.slice(0, newEventRounds)
    };

    if (editingEvent) {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewEventName('');
        setEditingEvent(null);
        setShowAddEvent(false);
        fetchFullData(selectedCompId!);
      }
    } else {
      const order = data ? data.events.length : 0;
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, order })
      });
      if (res.ok) {
        setNewEventName('');
        setShowAddEvent(false);
        fetchFullData(selectedCompId!);
      }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa nội dung này? Mọi điểm số liên quan cũng sẽ bị xóa.")) return;
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchFullData(selectedCompId!);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName || !newClassGrade) return;

    if (editingClass) {
      const res = await fetch(`/api/classes/${editingClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), grade: newClassGrade })
      });
      if (res.ok) {
        setNewClassName('');
        setNewClassGrade('');
        setEditingClass(null);
        setShowAddClass(false);
        fetchFullData(selectedCompId!);
      }
    } else {
      const classNames = newClassName.split('\n').map(n => n.trim()).filter(n => n !== '');
      
      if (classNames.length === 0) return;

      setIsSaving(true);
      try {
        const baseOrder = data ? data.classes.length : 0;
        await Promise.all(classNames.map((name, idx) => 
          fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, grade: newClassGrade, competition_id: selectedCompId, order: baseOrder + idx })
          })
        ));
        
        setNewClassName('');
        setNewClassGrade('');
        setNewClassCount(1);
        setShowAddClass(false);
        fetchFullData(selectedCompId!);
      } catch (error) {
        console.error("Error adding classes:", error);
        alert("Có lỗi xảy ra khi thêm lớp");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa lớp này? Mọi điểm số liên quan cũng sẽ bị xóa.")) return;
    const res = await fetch(`/api/classes/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchFullData(selectedCompId!);
    }
  };

  const handleAddJudge = async () => {
    if (!newJudgeName || !newJudgeCode) return;
    
    if (editingJudge) {
      const res = await fetch(`/api/judges/${editingJudge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJudgeName, code: newJudgeCode })
      });
      if (res.ok) {
        setNewJudgeName('');
        setNewJudgeCode('');
        setEditingJudge(null);
        setShowAddJudge(false);
        fetchFullData(selectedCompId!);
      }
    } else {
      const order = data ? data.judges.length : 0;
      const res = await fetch('/api/judges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJudgeName, code: newJudgeCode, competition_id: selectedCompId, order })
      });
      if (res.ok) {
        setNewJudgeName('');
        setNewJudgeCode('');
        setShowAddJudge(false);
        fetchFullData(selectedCompId!);
      }
    }
  };

  const handleDeleteJudge = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa giám khảo này? Tất cả điểm số của giám khảo này cũng sẽ bị xóa.')) return;
    const res = await fetch(`/api/judges/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchFullData(selectedCompId!);
    }
  };

  const handleJudgeLogin = async () => {
    if (!judgeLoginCode || !selectedCompId) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/judges/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: judgeLoginCode, competition_id: selectedCompId })
      });
      if (res.ok) {
        const judge = await res.json();
        setLoggedInJudge(judge);
        setUserRole('judge');
        setActiveTab('scoring');
      } else {
        const err = await res.json();
        setLoginError(err.error || "Mã giám khảo không đúng");
      }
    } catch (error) {
      setLoginError("Lỗi kết nối máy chủ");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLockAllEvents = async (lock: boolean) => {
    if (!confirm(`Bạn có chắc muốn ${lock ? 'khóa' : 'mở khóa'} tất cả nội dung thi?`)) return;
    const res = await fetch('/api/events/lock-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competition_id: selectedCompId, is_locked: lock })
    });
    if (res.ok) {
      fetchFullData(selectedCompId!);
    }
  };

  const handleSaveConversions = async () => {
    const res = await fetch('/api/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversions })
    });
    if (res.ok) {
      alert("Đã lưu cấu hình điểm quy đổi");
      fetchFullData(selectedCompId!);
    }
  };

  const handleReorder = async (collection: string, items: any[]) => {
    const reorderData = items.map((item, index) => ({ id: item.id, order: index }));
    await fetch('/api/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, items: reorderData })
    });
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
      
      // Update local state immediately
      const newClasses = data.classes.map(c => {
        if (c.grade === grade) {
          // Find the new position of this class in the reordered items
          const newIndex = (items as any[]).findIndex(it => it.id === c.id);
          if (newIndex !== -1) {
            return { ...c, order: newIndex };
          }
        }
        return c;
      });
      
      // Sort the new classes list to reflect the change
      newClasses.sort((a, b) => {
        if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
        return (a.order || 0) - (b.order || 0);
      });

      setData({ ...data, classes: newClasses });
      handleReorder('classes', items);
    }
  };

  const exportScoringTemplate = async () => {
    if (!data) return;
    
    const workbook = new ExcelJS.Workbook();
    const judgeId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
    const judgesToExport = judgeId 
      ? data.judges.filter(j => j.id === judgeId)
      : data.judges;

    if (judgesToExport.length === 0) {
      alert("Vui lòng thêm giám khảo trước khi xuất mẫu");
      return;
    }

    const grades = Array.from(new Set(data.classes.map(c => c.grade))).sort();

    for (const event of data.events) {
      const sheetName = event.name.replace(/[\\\/\?\*\[\]]/g, '').substring(0, 30);
      const ws = workbook.addWorksheet(sheetName);

      const effectiveRoundCount = event.round_count || 1;

      // 1. Metadata (Hidden rows 1-3)
      ws.getRow(1).hidden = true;
      ws.getCell('A1').value = event.id;
      
      const judgeIdRow = ws.getRow(2);
      judgeIdRow.hidden = true;
      const roundNumRow = ws.getRow(3);
      roundNumRow.hidden = true;

      let metaColIdx = 4;
      for (let r = 1; r <= effectiveRoundCount; r++) {
        judgesToExport.forEach(j => {
          judgeIdRow.getCell(metaColIdx).value = j.id;
          roundNumRow.getCell(metaColIdx).value = r;
          metaColIdx++;
        });
      }

      // 2. Title (Visible rows 4-5)
      const titleRow = ws.addRow(['', '', '', `NỘI DUNG THI ${event.name.toUpperCase()}`]);
      ws.mergeCells(titleRow.number, 4, titleRow.number, 4 + (judgesToExport.length * effectiveRoundCount) - 1);
      titleRow.getCell(4).font = { bold: true, color: { argb: 'FFFF0000' }, size: 16 };
      titleRow.getCell(4).alignment = { horizontal: 'center' };

      const compRow = ws.addRow(['', '', '', `Hội thi: ${data.competition.name}`]);
      ws.mergeCells(compRow.number, 4, compRow.number, 4 + (judgesToExport.length * effectiveRoundCount) - 1);
      compRow.getCell(4).alignment = { horizontal: 'center' };

      // 3. Headers (Rows 6-7)
      const h1 = ['ID', 'STT', 'LỚP'];
      const h2 = ['', '', ''];
      
      for (let r = 1; r <= effectiveRoundCount; r++) {
        const customName = event.round_names?.[r-1];
        const roundLabel = customName || (effectiveRoundCount > 1 ? `LẦN ${r}` : 'ĐIỂM CHẤM');
        h1.push(roundLabel, ...Array(judgesToExport.length - 1).fill(''));
        judgesToExport.forEach((_, i) => h2.push(`GK${i + 1}`));
      }

      const headerRow = ws.addRow(h1);
      const subHeaderRow = ws.addRow(h2);
      
      // Style headers
      [headerRow.number, subHeaderRow.number].forEach(rowNum => {
        ws.getRow(rowNum).eachCell((cell, colNum) => {
          if (colNum >= 2) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });
      ws.mergeCells(headerRow.number, 2, subHeaderRow.number, 2); // STT
      ws.mergeCells(headerRow.number, 3, subHeaderRow.number, 3); // LỚP
      
      let headerColIdx = 4;
      for (let r = 1; r <= effectiveRoundCount; r++) {
        ws.mergeCells(headerRow.number, headerColIdx, headerRow.number, headerColIdx + judgesToExport.length - 1);
        headerColIdx += judgesToExport.length;
      }

      // 4. Data grouped by grade
      grades.forEach(grade => {
        const gradeRow = ws.addRow(['', '', `KHỐI ${grade}`]);
        ws.mergeCells(gradeRow.number, 3, gradeRow.number, 4 + (judgesToExport.length * effectiveRoundCount) - 1);
        gradeRow.getCell(3).font = { bold: true, color: { argb: 'FF0000FF' } };
        gradeRow.getCell(3).alignment = { horizontal: 'right' };

        const gradeClasses = data.classes.filter(c => c.grade === grade);
        gradeClasses.forEach((cls, idx) => {
          const rowData = [cls.id, idx + 1, cls.name];
          for (let r = 1; r <= effectiveRoundCount; r++) {
            judgesToExport.forEach(j => {
              const score = data.scores.find(s => s.class_id === cls.id && s.event_id === event.id && s.judge_id === j.id && s.round === r);
              rowData.push(score ? score.score : '');
            });
          }
          const row = ws.addRow(rowData);
          row.eachCell((cell, colNum) => {
            if (colNum >= 2) {
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              cell.alignment = { horizontal: 'center' };
              if (colNum === 3) { // LỚP column
                cell.font = { bold: true, color: { argb: 'FF0000FF' } };
              }
            } else if (colNum === 1) {
              cell.font = { size: 8, color: { argb: 'FFCCCCCC' } };
            }
          });
        });
      });

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 5;
      ws.getColumn(3).width = 15;
      for (let i = 4; i < 4 + (judgesToExport.length * effectiveRoundCount); i++) {
        ws.getColumn(i).width = 8;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = judgeId 
      ? `Mau_Cham_Diem_${judgesToExport[0].name}_${data.competition.name}.xlsx`
      : `Mau_Cham_Diem_Tong_Hop_${data.competition.name}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    setIsImporting(true);
    const workbook = new ExcelJS.Workbook();
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        await workbook.xlsx.load(buffer);
        
        const scoresToSave: any[] = [];
        
        workbook.eachSheet(ws => {
          const eventId = ws.getCell('A1').value?.toString();
          if (!eventId) return;

          // Find judge IDs and rounds from rows 2 and 3
          const colMetadata: Record<number, { judgeId: string, round: number }> = {};
          const judgeRow = ws.getRow(2);
          const roundRow = ws.getRow(3);
          
          judgeRow.eachCell((cell, colNum) => {
            if (colNum >= 4) {
              const judgeId = cell.value?.toString();
              const round = parseInt(roundRow.getCell(colNum).value?.toString() || '1');
              if (judgeId) {
                colMetadata[colNum] = { judgeId, round };
              }
            }
          });

          // Iterate rows from 8 (data starts after headers and grade title)
          ws.eachRow((row, rowNum) => {
            if (rowNum < 8) return;
            const classId = row.getCell(1).value?.toString();
            if (!classId) return;
            
            Object.entries(colMetadata).forEach(([colStr, meta]) => {
              const colNum = Number(colStr);
              const scoreVal = row.getCell(colNum).value;
              const score = typeof scoreVal === 'number' ? scoreVal : parseFloat(scoreVal?.toString() || '');
              
              if (!isNaN(score)) {
                scoresToSave.push({
                  class_id: classId,
                  event_id: eventId,
                  judge_id: meta.judgeId,
                  round: meta.round,
                  score
                });
              }
            });
          });
        });

        if (scoresToSave.length > 0) {
          const res = await fetch('/api/scores/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scores: scoresToSave })
          });
          if (res.ok) {
            alert(`Đã nhập thành công ${scoresToSave.length} đầu điểm từ các sheet`);
            fetchFullData(selectedCompId!);
          } else {
            const err = await res.json();
            alert(err.error || "Lỗi khi lưu điểm");
          }
        } else {
          alert("Không tìm thấy dữ liệu điểm hợp lệ trong file");
        }
      } catch (err) {
        console.error(err);
        alert("Lỗi khi đọc file Excel. Vui lòng sử dụng đúng file mẫu.");
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fetchFullData = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/competitions/${id}/full`);
    const json = await res.json();
    setData(json);
    setConversions(json.conversions);
    setLoading(false);
  };

  const handleSaveScore = async (classId: string, eventId: string, judgeId: string, round: number, score: number, category?: string) => {
    const key = `${classId}-${round}-${category || 'none'}`;
    setPendingScores(prev => ({ ...prev, [key]: score }));
  };

  const handleBulkSaveScore = async () => {
    const judgeId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
    if (!judgeId || !selectedEventId) return;

    setIsSaving(true);
    const scoresToSave = Object.entries(pendingScores).map(([key, score]) => {
      const [classId, round, category] = key.split('-');
      return {
        class_id: classId,
        event_id: selectedEventId,
        judge_id: judgeId,
        round: Number(round),
        score,
        category: category === 'none' ? null : category
      };
    });

    try {
      const res = await fetch('/api/scores/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: scoresToSave })
      });
      if (res.ok) {
        alert("Đã lưu điểm thành công!");
        fetchFullData(selectedCompId!);
      } else {
        const err = await res.json();
        alert(err.error || "Lỗi khi lưu điểm");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLockEvent = async (eventId: string, isLocked: boolean) => {
    await fetch(`/api/events/${eventId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_locked: isLocked })
    });
    fetchFullData(selectedCompId!);
  };

  // --- Calculations ---

  const classesByGrade = useMemo<Record<string, Class[]>>(() => {
    if (!data) return {};
    const grouped: Record<string, Class[]> = {};
    data.classes.forEach(cls => {
      if (!grouped[cls.grade]) grouped[cls.grade] = [];
      grouped[cls.grade].push(cls);
    });
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {} as Record<string, Class[]>);
  }, [data]);

  const getGradeColor = (grade: string) => {
    const colors = [
      'bg-blue-50 border-blue-100 text-blue-700',
      'bg-emerald-50 border-emerald-100 text-emerald-700',
      'bg-purple-50 border-purple-100 text-purple-700',
      'bg-amber-50 border-amber-100 text-amber-700',
      'bg-rose-50 border-rose-100 text-rose-700',
      'bg-indigo-50 border-indigo-100 text-indigo-700',
      'bg-cyan-50 border-cyan-100 text-cyan-700',
    ];
    const index = parseInt(grade) % colors.length || 0;
    return colors[index];
  };

  const eventResults = useMemo(() => {
    if (!data) return [];

    return data.events.map(event => {
      const eventScores = data.scores.filter(s => s.event_id === event.id);
      
      const classResults = data.classes.map(cls => {
        const clsScores = eventScores.filter(s => s.class_id === cls.id);
        const totalScore = clsScores.reduce((sum, s) => sum + s.score, 0);
        const hasScores = clsScores.length > 0;
        
        // Group scores by judge for display
        const judgeScores: Record<string, number> = {};
        clsScores.forEach(s => {
          const key = `${s.judge_id}_${s.round}_${s.category || ''}`;
          judgeScores[key] = s.score;
        });

        return {
          classId: cls.id,
          className: cls.name,
          grade: cls.grade,
          totalScore,
          judgeScores,
          hasScores
        };
      });

      const hasAnyScores = eventScores.length > 0;

      // Rank within each grade
      const rankedResults = classResults.map(res => {
        if (!hasAnyScores) {
          return { ...res, rank: 0, convertedPoints: 0 };
        }

        const sameGrade = classResults.filter(r => r.grade === res.grade);
        const sorted = [...sameGrade].sort((a, b) => b.totalScore - a.totalScore);
        
        // Handle ties: find first index of this score
        const rank = sorted.findIndex(r => r.totalScore === res.totalScore) + 1;
        
        // Converted points
        const conv = data.conversions.find(c => c.rank === rank);
        const convertedPoints = (conv ? conv.points : (data.conversions.length > 0 ? data.conversions[data.conversions.length - 1].points : 0)) * event.weight;

        return { ...res, rank, convertedPoints };
      });

      return {
        event,
        results: rankedResults
      };
    });
  }, [data]);

  const overallSummary = useMemo(() => {
    if (!data || eventResults.length === 0) return [];

    const summary = data.classes.map(cls => {
      const eventPoints: Record<string, number> = {};
      const eventRawScores: Record<string, number> = {};
      let totalPoints = 0;
      let totalRawScore = 0;

      eventResults.forEach(er => {
        const res = er.results.find(r => r.classId === cls.id);
        const pts = res ? res.convertedPoints : 0;
        const raw = res ? res.totalScore : 0;
        eventPoints[er.event.id] = pts;
        eventRawScores[er.event.id] = raw;
        totalPoints += pts;
        totalRawScore += raw;
      });

      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        eventPoints,
        eventRawScores,
        totalPoints,
        totalRawScore
      };
    });

    // Rank overall by grade
    const rankedSummary = summary.map(s => {
      const sameGrade = summary.filter(other => other.grade === s.grade);
      const sorted = [...sameGrade].sort((a, b) => b.totalPoints - a.totalPoints);
      // Handle ties: find first index of this score
      const overallRank = sorted.findIndex(other => other.totalPoints === s.totalPoints) + 1;
      return { ...s, overallRank };
    });

    // Sort by grade then rank for display
    return rankedSummary.sort((a, b) => {
      if (a.grade !== b.grade) {
        // Try numeric sort if possible
        const gradeA = parseInt(a.grade);
        const gradeB = parseInt(b.grade);
        if (!isNaN(gradeA) && !isNaN(gradeB)) return gradeA - gradeB;
        return a.grade.localeCompare(b.grade);
      }
      return a.overallRank - b.overallRank;
    });
  }, [data, eventResults]);

  // --- Export Excel ---

  // --- Export Excel Styled ---

  const applyDefaultStyles = (cell: ExcelJS.Cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { name: 'Arial', size: 10 };
  };

  const exportEventRankings = async (eventId: string) => {
    if (!data) return;
    const eventRes = eventResults.find(er => er.event.id === eventId);
    if (!eventRes) return;

    const { event, results } = eventRes;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(event.name.substring(0, 30));

    // 1. Title
    const titleRow = worksheet.addRow([`NỘI DUNG THI ${event.name.toUpperCase()} (${data.competition.name.toUpperCase()})`]);
    const effectiveRoundCount = event.round_count || 1;
    let maxCols = 2 + (data.judges.length * effectiveRoundCount) + 3;
    worksheet.mergeCells(1, 1, 1, maxCols);
    titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' }, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.addRow([]); // Empty row

    // 2. Headers
    let h1: string[] = ['STT', 'LỚP'];
    let h2: string[] = ['', ''];
    
    for (let r = 1; r <= effectiveRoundCount; r++) {
      const customName = event.round_names?.[r-1];
      const roundLabel = customName || (effectiveRoundCount > 1 ? `ĐIỂM CHẤM LẦN ${r}` : 'ĐIỂM CHẤM');
      h1.push(roundLabel, ...Array(data.judges.length - 1).fill(''));
      data.judges.forEach((_, i) => h2.push(`GK${i + 1}`));
    }
    h1.push('TỔNG ĐIỂM', 'XẾP VT', 'TỔNG ĐIỂM');
    h2.push('', '', '');

    const headerRow1 = worksheet.addRow(h1);
    const headerRow2 = worksheet.addRow(h2);
    
    worksheet.mergeCells(3, 1, 4, 1); // STT
    worksheet.mergeCells(3, 2, 4, 2); // LỚP
    
    let colIdx = 3;
    for (let r = 1; r <= effectiveRoundCount; r++) {
      worksheet.mergeCells(3, colIdx, 3, colIdx + data.judges.length - 1);
      colIdx += data.judges.length;
    }
    worksheet.mergeCells(3, colIdx, 4, colIdx); // TỔNG ĐIỂM
    worksheet.mergeCells(3, colIdx + 1, 4, colIdx + 1); // XẾP VT
    worksheet.mergeCells(3, colIdx + 2, 4, colIdx + 2); // TỔNG ĐIỂM (Converted)

    [3, 4].forEach(rowNum => {
      worksheet.getRow(rowNum).eachCell(cell => {
        applyDefaultStyles(cell);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        cell.font = { bold: true, color: { argb: 'FFFF0000' }, size: 11 };
      });
    });

    // 3. Data grouped by grade
    const grades = Array.from(new Set(data.classes.map(c => c.grade))).sort();
    let currentRow = 5;

    grades.forEach(grade => {
      // Grade Header
      const gradeRow = worksheet.addRow([`KHỐI ${grade}`]);
      worksheet.mergeCells(currentRow, 1, currentRow, maxCols);
      gradeRow.getCell(1).font = { bold: true, color: { argb: 'FF0000FF' }, size: 12 };
      gradeRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      gradeRow.getCell(1).border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      currentRow++;

      const gradeResults = results.filter(r => r.grade === grade).sort((a, b) => a.rank - b.rank);
      gradeResults.forEach((r, idx) => {
        const rowData: any[] = [idx + 1, r.className];
        
        for (let rd = 1; rd <= effectiveRoundCount; rd++) {
          data.judges.forEach(j => {
            rowData.push(r.judgeScores[`${j.id}_${rd}_`] || r.judgeScores[`${j.id}_${rd}_none`] || 0);
          });
        }
        rowData.push(r.totalScore, r.rank, r.convertedPoints);

        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNum) => {
          applyDefaultStyles(cell);
          if (colNum === 2) cell.font = { bold: true, color: { argb: 'FF0000FF' } };
          
          // Color judge score columns
          if (colNum >= 3 && colNum < 3 + (effectiveRoundCount * data.judges.length)) {
            const roundIdx = Math.floor((colNum - 3) / data.judges.length);
            const colors = ['FFFFFF00', 'FF92D050', 'FF9BC2E6', 'FFD9E1F2', 'FFF2F2F2'];
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[roundIdx % colors.length] } };
            cell.font = { color: { argb: 'FFFF0000' } };
          }
        });
        currentRow++;
      });
    });

    // Column widths
    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 10;
    for (let i = 3; i < maxCols - 2; i++) worksheet.getColumn(i).width = 8;
    worksheet.getColumn(maxCols - 2).width = 12;
    worksheet.getColumn(maxCols - 1).width = 8;
    worksheet.getColumn(maxCols).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${data.competition.name}_${event.name}_XepHang.xlsx`);
  };

  const exportToExcel = async () => {
    if (!data) return;

    const workbook = new ExcelJS.Workbook();
    
    // 1. Overall Summary Sheet
    const wsSummary = workbook.addWorksheet("TỔNG HỢP");
    const titleRow = wsSummary.addRow([`BẢNG TỔNG HỢP KẾT QUẢ - ${data.competition.name.toUpperCase()}`]);
    wsSummary.mergeCells(1, 1, 1, data.events.length + 4);
    titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' }, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.addRow([]);

    const headerCols = ['STT', 'LỚP', ...data.events.map(e => e.name), 'TỔNG ĐIỂM', 'XẾP HẠNG'];
    const headerRow = wsSummary.addRow(headerCols);
    headerRow.eachCell(cell => {
      applyDefaultStyles(cell);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      cell.font = { bold: true, color: { argb: 'FFFF0000' } };
    });

    overallSummary.forEach((s, idx) => {
      const rowData = [
        idx + 1,
        s.className,
        ...data.events.map(e => s.eventPoints[e.id]),
        s.totalPoints,
        s.overallRank
      ];
      const row = wsSummary.addRow(rowData);
      row.eachCell((cell, colNum) => {
        applyDefaultStyles(cell);
        if (colNum === 2) cell.font = { bold: true, color: { argb: 'FF0000FF' } };
      });
    });

    // 2. Event Sheets
    for (const er of eventResults) {
      const { event, results } = er;
      const ws = workbook.addWorksheet(event.name.substring(0, 30));
      
      // Title
      const eTitle = ws.addRow([`NỘI DUNG THI ${event.name.toUpperCase()} (${data.competition.name.toUpperCase()})`]);
      let maxCols = 2 + (data.judges.length * (event.type === 'discipline' ? event.round_count : (event.type === 'hygiene' ? 2 : 1))) + 3;

      ws.mergeCells(1, 1, 1, maxCols);
      eTitle.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' }, size: 16 };
      eTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.addRow([]);

      // Headers
      let h1: string[] = ['STT', 'LỚP'];
      let h2: string[] = ['', ''];
      
      if (event.type === 'normal') {
        h1.push('ĐIỂM CHẤM', ...Array(data.judges.length - 1).fill(''));
        data.judges.forEach((_, i) => h2.push(`GK${i + 1}`));
      } else if (event.type === 'hygiene') {
        h1.push('ĐỔ RÁC', ...Array(data.judges.length - 1).fill(''), 'VSATTP', ...Array(data.judges.length - 1).fill(''));
        data.judges.forEach((_, i) => h2.push(`GK${i + 1}`));
        data.judges.forEach((_, i) => h2.push(`GK${i + 1}`));
      } else if (event.type === 'discipline') {
        for (let r = 1; r <= event.round_count; r++) {
          h1.push(`ĐIỂM CHẤM LẦN ${r}`, ...Array(data.judges.length - 1).fill(''));
          data.judges.forEach((_, i) => h2.push(`GK${i + 1}`));
        }
      }
      h1.push('TỔNG ĐIỂM', 'XẾP VT', 'TỔNG ĐIỂM');
      h2.push('', '', '');

      const row1 = ws.addRow(h1);
      const row2 = ws.addRow(h2);

      // Merge headers
      ws.mergeCells(3, 1, 4, 1); // STT
      ws.mergeCells(3, 2, 4, 2); // LỚP
      
      let colIdx = 3;
      if (event.type === 'normal') {
        ws.mergeCells(3, colIdx, 3, colIdx + data.judges.length - 1);
        colIdx += data.judges.length;
      } else if (event.type === 'hygiene') {
        ws.mergeCells(3, colIdx, 3, colIdx + data.judges.length - 1);
        ws.mergeCells(3, colIdx + data.judges.length, 3, colIdx + (2 * data.judges.length) - 1);
        colIdx += 2 * data.judges.length;
      } else if (event.type === 'discipline') {
        for (let r = 1; r <= event.round_count; r++) {
          ws.mergeCells(3, colIdx, 3, colIdx + data.judges.length - 1);
          colIdx += data.judges.length;
        }
      }
      ws.mergeCells(3, colIdx, 4, colIdx); // TỔNG ĐIỂM
      ws.mergeCells(3, colIdx + 1, 4, colIdx + 1); // XẾP VT
      ws.mergeCells(3, colIdx + 2, 4, colIdx + 2); // TỔNG ĐIỂM (Converted)

      [3, 4].forEach(rowNum => {
        ws.getRow(rowNum).eachCell(cell => {
          applyDefaultStyles(cell);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
          cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        });
      });

      // Data grouped by grade
      const grades = Array.from(new Set(data.classes.map(c => c.grade))).sort();
      let curRow = 5;

      grades.forEach(grade => {
        const gRow = ws.addRow([`KHỐI ${grade}`]);
        ws.mergeCells(curRow, 1, curRow, maxCols);
        gRow.getCell(1).font = { bold: true, color: { argb: 'FF0000FF' }, size: 12 };
        gRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        gRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        curRow++;

        const gRes = results.filter(r => r.grade === grade).sort((a, b) => a.rank - b.rank);
        gRes.forEach((r, idx) => {
          const rowData: any[] = [idx + 1, r.className];
          
          if (event.type === 'normal') {
            data.judges.forEach(j => rowData.push(r.judgeScores[`${j.id}_1_`] || 0));
          } else if (event.type === 'hygiene') {
            data.judges.forEach(j => rowData.push(r.judgeScores[`${j.id}_1_do_rac`] || 0));
            data.judges.forEach(j => rowData.push(r.judgeScores[`${j.id}_1_vsattp`] || 0));
          } else if (event.type === 'discipline') {
            for (let rd = 1; rd <= event.round_count; rd++) {
              data.judges.forEach(j => rowData.push(r.judgeScores[`${j.id}_${rd}_`] || 0));
            }
          }
          rowData.push(r.totalScore, r.rank, r.convertedPoints);
          
          const dataRow = ws.addRow(rowData);
          dataRow.eachCell((cell, colNum) => {
            applyDefaultStyles(cell);
            if (colNum === 2) cell.font = { bold: true, color: { argb: 'FF0000FF' } };
            
            // Color judge score columns
            if (event.type === 'normal') {
              if (colNum >= 3 && colNum < 3 + data.judges.length) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                cell.font = { color: { argb: 'FFFF0000' } };
              }
            } else if (event.type === 'hygiene') {
              if (colNum >= 3 && colNum < 3 + (2 * data.judges.length)) {
                const isVsat = colNum >= 3 + data.judges.length;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isVsat ? 'FF92D050' : 'FFFFFF00' } };
                cell.font = { color: { argb: 'FFFF0000' } };
              }
            } else if (event.type === 'discipline') {
              const roundIdx = Math.floor((colNum - 3) / data.judges.length);
              if (colNum >= 3 && colNum < 3 + (event.round_count * data.judges.length)) {
                const colors = ['FFFFFF00', 'FF92D050', 'FF9BC2E6'];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[roundIdx % 3] } };
                cell.font = { color: { argb: 'FFFF0000' } };
              }
            }
          });
          curRow++;
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${data.competition.name}_KetQua.xlsx`);
  };

  // --- Views ---

  const handleAdminLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminLoginPassword })
      });
      
      if (res.ok) {
        setUserRole('admin');
        setAdminLoginPassword('');
        setShowAdminLogin(false);
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Mật khẩu không chính xác');
      }
    } catch (error) {
      setLoginError('Lỗi kết nối máy chủ');
    }
  };

  if (!userRole) {
    if (showAdminLogin) {
      return (
        <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md space-y-8 bg-white p-8 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/50"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <Lock className="text-white" size={32} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Đăng nhập Admin</h1>
              <p className="text-indigo-600/60">Vui lòng nhập mật khẩu quản trị</p>
            </div>

            <div className="space-y-4">
              <Input 
                label="Mật khẩu" 
                value={adminLoginPassword} 
                onChange={(val) => {
                  setAdminLoginPassword(val);
                  if (loginError) setLoginError('');
                }} 
                placeholder="Nhập mật khẩu" 
                type="password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && adminLoginPassword) {
                    handleAdminLogin();
                  }
                }}
              />
              {loginError && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm font-medium text-center bg-red-50 py-2 rounded-xl border border-red-100"
                >
                  {loginError}
                </motion.p>
              )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="secondary" 
              className="flex-1 py-4 h-14" 
              onClick={() => {
                setShowAdminLogin(false);
                setAdminLoginPassword('');
              }}
            >
              Quay lại
            </Button>
            <Button 
              className="flex-1 py-4 h-14" 
              onClick={handleAdminLogin}
              disabled={!adminLoginPassword}
            >
              Đăng nhập
            </Button>
          </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
              <Trophy className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-indigo-950">Hệ thống Chấm điểm</h1>
            <p className="text-indigo-600/60 text-lg">Chào mừng bạn đến với hệ thống quản lý hội thi</p>
          </div>

          <div className="grid gap-4">
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="group bg-white p-5 sm:p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md hover:border-black/10 transition-all flex items-center gap-4 sm:gap-6 text-left"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Settings size={24} className="sm:size-[28px]" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Quản trị viên</h3>
                <p className="text-sm text-black/40">Quản lý nội dung, lớp, giám khảo</p>
              </div>
            </button>

            <button 
              onClick={() => setUserRole('judge')}
              className="group bg-white p-5 sm:p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md hover:border-black/10 transition-all flex items-center gap-4 sm:gap-6 text-left"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Trophy size={24} className="sm:size-[28px]" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Giám khảo</h3>
                <p className="text-sm text-black/40">Đăng nhập bằng mã để chấm điểm</p>
              </div>
            </button>

            <button 
              onClick={() => setUserRole('btc')}
              className="group bg-white p-5 sm:p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md hover:border-black/10 transition-all flex items-center gap-4 sm:gap-6 text-left"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <LayoutDashboard size={24} className="sm:size-[28px]" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Ban tổ chức</h3>
                <p className="text-sm text-black/40">Xem bảng xếp hạng & tổng hợp</p>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (userRole === 'judge' && !loggedInJudge) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Đăng nhập Giám khảo</h2>
            <p className="text-sm text-black/40">Chọn hội thi và nhập mã của bạn</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-black/40 ml-1">Chọn hội thi</label>
              <select 
                value={selectedCompId || ''} 
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 border-none rounded-xl focus:ring-2 focus:ring-black/10 outline-none font-medium"
              >
                <option value="">-- Chọn hội thi --</option>
                {competitions.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
              </select>
            </div>

            <Input 
              label="Mã giám khảo" 
              value={judgeLoginCode} 
              onChange={(val) => {
                setJudgeLoginCode(val);
                if (loginError) setLoginError('');
              }} 
              placeholder="Nhập mã được cấp" 
              type="password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && judgeLoginCode) {
                  handleJudgeLogin();
                }
              }}
            />

            {loginError && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-medium text-center bg-red-50 py-2 rounded-xl border border-red-100"
              >
                {loginError}
              </motion.p>
            )}

            <Button 
              className="w-full py-4 h-14 text-lg" 
              onClick={handleJudgeLogin} 
              disabled={!selectedCompId || !judgeLoginCode || isLoggingIn}
            >
              {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
            
            <Button variant="ghost" className="w-full" onClick={() => setUserRole(null)}>
              Quay lại
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!selectedCompId) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Chọn Hội thi</h1>
            <Button variant="ghost" onClick={() => setUserRole(null)}><LogOut size={18} /> Thoát</Button>
          </div>

          {userRole === 'admin' && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Tạo Hội thi mới</h2>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <Input label="Tên hội thi" value={newCompName} onChange={setNewCompName} placeholder="VD: Ngày hội STEM 2024" className="flex-1 w-full" />
                <Input label="Ngày tổ chức" type="date" value={newCompDate} onChange={setNewCompDate} className="w-full sm:w-auto" />
                <Button onClick={handleCreateCompetition} className="w-full sm:w-auto"><Plus size={18} /> Tạo</Button>
              </div>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {competitions.map(comp => (
              <button 
                key={comp.id}
                onClick={() => setSelectedCompId(comp.id)}
                className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md text-left transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                    <Trophy size={24} />
                  </div>
                  <span className="text-xs font-bold text-black/30 bg-black/5 px-2 py-1 rounded-lg">{comp.date}</span>
                </div>
                <h3 className="font-bold text-xl">{comp.name}</h3>
                <div className="mt-4 flex items-center text-black/40 text-sm font-medium">
                  Tiếp tục <ChevronRight size={16} className="ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50/20 flex flex-col lg:flex-row font-sans text-indigo-950">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-indigo-100 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Trophy className="text-white" size={20} />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold truncate text-indigo-950 max-w-[200px]">{data?.competition.name}</h2>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-black/5 rounded-lg"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-indigo-100 flex flex-col shadow-xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-sm lg:z-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Trophy className="text-white" size={20} />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold truncate text-indigo-950">{data?.competition.name}</h2>
              <p className="text-[10px] uppercase tracking-widest text-indigo-600/50 font-bold">
                {userRole === 'judge' && loggedInJudge ? loggedInJudge.name : userRole}
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard size={20} />} label="Tổng quan" />
            {userRole === 'admin' && (
              <>
                <NavItem active={activeTab === 'events'} onClick={() => { setActiveTab('events'); setIsMobileMenuOpen(false); }} icon={<Trophy size={20} />} label="Nội dung thi" />
                <NavItem active={activeTab === 'classes'} onClick={() => { setActiveTab('classes'); setIsMobileMenuOpen(false); }} icon={<Users size={20} />} label="Danh sách lớp" />
                <NavItem active={activeTab === 'judges'} onClick={() => { setActiveTab('judges'); setIsMobileMenuOpen(false); }} icon={<UserCircle2 size={20} />} label="Giám khảo" />
                <NavItem active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} icon={<Settings size={20} />} label="Cấu hình" />
              </>
            )}
            {(userRole === 'admin' || userRole === 'judge') && (
              <NavItem active={activeTab === 'scoring'} onClick={() => { setActiveTab('scoring'); setIsMobileMenuOpen(false); }} icon={<CheckCircle2 size={20} />} label="Chấm điểm" />
            )}
            <NavItem active={activeTab === 'summary'} onClick={() => { setActiveTab('summary'); setIsMobileMenuOpen(false); }} icon={<BarChart3 size={20} />} label="Bảng tổng hợp" />
            <NavItem active={activeTab === 'rankings'} onClick={() => { setActiveTab('rankings'); setIsMobileMenuOpen(false); }} icon={<Trophy size={20} />} label="Bảng xếp hạng" />
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-2 border-t border-indigo-50">
          <Button variant="outline" className="w-full border-indigo-100 text-indigo-600 hover:bg-indigo-50" onClick={() => { setSelectedCompId(null); setIsMobileMenuOpen(false); }}>Đổi hội thi</Button>
          <Button variant="ghost" className="w-full text-rose-500 hover:bg-rose-50" onClick={() => { setUserRole(null); setIsMobileMenuOpen(false); }}>Đăng xuất</Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Tổng quan</h1>
                  <p className="text-black/40">Thống kê kết quả hiện tại</p>
                </div>
                <Button variant="secondary" onClick={exportToExcel}><FileSpreadsheet size={18} /> Xuất Excel</Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard label="Tổng số lớp" value={data?.classes.length || 0} icon={<Users className="text-blue-600" />} />
                <StatCard label="Nội dung thi" value={data?.events.length || 0} icon={<Trophy className="text-amber-600" />} />
                <StatCard label="Giám khảo" value={data?.judges.length || 0} icon={<UserCircle2 className="text-emerald-600" />} />
                <StatCard label="Tiến độ chấm" value={`${Math.round((data?.scores.length || 0) / ((data?.classes.length || 1) * (data?.events.length || 1) * (data?.judges.length || 1)) * 100)}%`} icon={<CheckCircle2 className="text-purple-600" />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                <Card className="col-span-2 p-6">
                  <h3 className="font-bold text-lg mb-6">Top 10 Lớp dẫn đầu</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overallSummary.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                        <XAxis dataKey="className" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#00000005' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="totalPoints" radius={[6, 6, 0, 0]}>
                          {overallSummary.slice(0, 10).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#000000'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-6">Xếp hạng nhanh theo khối</h3>
                  <div className="space-y-6">
                    {Array.from(new Set(overallSummary.map(s => s.grade))).map(grade => (
                      <div key={grade}>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-3 border-b border-black/5 pb-1">Khối {grade}</h4>
                        <div className="space-y-2">
                          {overallSummary.filter(s => s.grade === grade).slice(0, 3).map((s, idx) => (
                            <div key={s.classId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 transition-colors">
                              <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center font-bold text-[10px]",
                                s.overallRank === 1 ? "bg-amber-100 text-amber-700" : 
                                s.overallRank === 2 ? "bg-slate-100 text-slate-700" : 
                                s.overallRank === 3 ? "bg-orange-100 text-orange-700" : "bg-black/5 text-black/40"
                              )}>
                                {s.overallRank}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm">{s.className}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">{s.totalPoints}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Trophy className="text-amber-500" size={20} />
                  Bảng vàng vinh danh (Hạng 1 các nội dung)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eventResults.map(er => (
                    <div key={er.event.id} className="space-y-3">
                      <h4 className="font-bold text-sm border-l-4 border-black pl-3 py-1 bg-black/5 rounded-r-lg">{er.event.name}</h4>
                      <div className="space-y-2">
                        {Array.from(new Set(data.classes.map(c => c.grade))).sort().map(grade => {
                          const winner = er.results.find(r => r.grade === grade && r.rank === 1 && r.totalScore > 0);
                          if (!winner) return null;
                          return (
                            <div key={grade} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                              <span className="font-bold text-emerald-700">Khối {grade}</span>
                              <span className="font-bold">{winner.className}</span>
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">{winner.totalScore} đ</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'events' && data && (
            <motion.div key="events" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Nội dung thi</h1>
                  <p className="text-black/40">Quản lý các môn thi đấu</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleLockAllEvents(true)}><Lock size={18} /> Khóa tất cả</Button>
                  <Button variant="outline" onClick={() => handleLockAllEvents(false)}><Unlock size={18} /> Mở tất cả</Button>
                  <Button onClick={() => {
                    if (showAddEvent) {
                      setEditingEvent(null);
                      setNewEventName('');
                      setNewEventRounds(1);
                      setNewEventRoundNames([]);
                    }
                    setShowAddEvent(!showAddEvent);
                  }}><Plus size={18} /> {showAddEvent ? 'Hủy' : 'Thêm nội dung'}</Button>
                </div>
              </div>

              {showAddEvent && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">{editingEvent ? 'Sửa nội dung thi' : 'Thêm nội dung thi mới'}</h2>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Input label="Tên nội dung" value={newEventName} onChange={setNewEventName} placeholder="VD: Dân vũ, Văn nghệ..." />
                    <Input label="Hệ số" type="number" value={newEventWeight} onChange={setNewEventWeight} />
                    <Input label="Số lần chấm" type="number" value={newEventRounds} onChange={(val) => {
                      const rounds = parseInt(val.toString()) || 1;
                      setNewEventRounds(rounds);
                      const names = [...newEventRoundNames];
                      while (names.length < rounds) names.push('');
                      setNewEventRoundNames(names);
                    }} />
                  </div>
                  
                  {newEventRounds > 1 && (
                    <div className="mt-4 space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-black/50 ml-1">Tên các lần chấm (Ví dụ: Vệ sinh trại, VSATTP...)</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {Array.from({ length: newEventRounds }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-black/30 w-12">Lần {i + 1}:</span>
                            <input 
                              type="text"
                              value={newEventRoundNames[i] || ''}
                              onChange={(e) => {
                                const names = [...newEventRoundNames];
                                names[i] = e.target.value;
                                setNewEventRoundNames(names);
                              }}
                              placeholder={`Tên lần ${i + 1}`}
                              className="flex-1 px-3 py-2 bg-black/5 border-none rounded-lg focus:ring-2 focus:ring-black/10 outline-none text-sm font-medium"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-6">
                    <Button className="flex-1" onClick={handleAddEvent}><Save size={18} /> {editingEvent ? 'Cập nhật' : 'Lưu nội dung'}</Button>
                    {editingEvent && (
                      <Button variant="outline" onClick={() => {
                        setEditingEvent(null);
                        setNewEventName('');
                        setNewEventRounds(1);
                        setNewEventRoundNames([]);
                        setShowAddEvent(false);
                      }}>Hủy</Button>
                    )}
                  </div>
                </Card>
              )}

              <DragDropContext onDragEnd={(res) => onDragEnd(res, 'events')}>
                <Droppable droppableId="events-list">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.events.map((event, index) => (
                        <DraggableAny key={event.id} draggableId={event.id} index={index}>
                          {(provided: any) => (
                            <div ref={provided.innerRef} {...provided.draggableProps}>
                              <Card className="p-4 flex items-center justify-between group hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div {...provided.dragHandleProps} className="cursor-grab text-black/20 hover:text-black/40">
                                    <GripVertical size={20} />
                                  </div>
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                    event.is_locked ? "bg-red-100 text-red-600" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                                  )}>
                                    <Trophy size={20} />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-lg leading-tight">{event.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Hệ số: {event.weight}</span>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Số lần chấm: {event.round_count}</span>
                                    </div>
                                    {event.round_names && event.round_names.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {event.round_names.map((name, i) => (
                                          <span key={i} className="text-[9px] bg-black/5 px-1.5 py-0.5 rounded text-black/60">{name || `Lần ${i+1}`}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingEvent(event);
                                      setNewEventName(event.name);
                                      setNewEventWeight(event.weight);
                                      setNewEventRounds(event.round_count);
                                      setNewEventRoundNames(event.round_names || []);
                                      setShowAddEvent(true);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                    title="Sửa"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteEvent(event.id)}
                                    className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleLockEvent(event.id, !event.is_locked)} 
                                    className={cn(
                                      "p-2 rounded-lg transition-colors", 
                                      event.is_locked ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    )}
                                    title={event.is_locked ? "Mở khóa" : "Khóa"}
                                  >
                                    {event.is_locked ? <Lock size={18} /> : <Unlock size={18} />}
                                  </button>
                                </div>
                              </Card>
                            </div>
                          )}
                        </DraggableAny>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </motion.div>
          )}

          {activeTab === 'classes' && data && (
            <motion.div key="classes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Danh sách lớp</h1>
                  <p className="text-black/40">Quản lý các lớp tham gia</p>
                </div>
                <Button onClick={() => {
                  if (showAddClass) {
                    setEditingClass(null);
                    setNewClassName('');
                    setNewClassGrade('');
                    setNewClassCount(1);
                  }
                  setShowAddClass(!showAddClass);
                }}>
                  <Plus size={18} /> {showAddClass ? 'Hủy' : 'Thêm lớp'}
                </Button>
              </div>

              {showAddClass && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">{editingClass ? 'Sửa lớp' : 'Thêm lớp mới'}</h2>
                  <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <Input label="Khối" value={newClassGrade} onChange={setNewClassGrade} placeholder="VD: 6" />
                      {!editingClass && (
                        <Input 
                          label="Số lượng lớp" 
                          type="number" 
                          value={newClassCount} 
                          onChange={(val) => {
                            setNewClassCount(val);
                            // Optionally auto-generate names if empty
                            if (!newClassName.trim()) {
                              const names = [];
                              for (let i = 1; i <= val; i++) {
                                names.push(`${newClassGrade}/${i}`);
                              }
                              setNewClassName(names.join('\n'));
                            }
                          }} 
                          placeholder="Số lượng lớp" 
                        />
                      )}
                    </div>
                    {editingClass ? (
                      <Input label="Tên lớp" value={newClassName} onChange={setNewClassName} placeholder="VD: 6/1" />
                    ) : (
                      <Textarea 
                        label="Tên các lớp (mỗi lớp một dòng)" 
                        value={newClassName} 
                        onChange={setNewClassName} 
                        placeholder={`VD:\n6/1\n6/2\n6/3`} 
                        rows={Math.max(4, newClassName.split('\n').length)}
                      />
                    )}
                    <Button className="w-full" onClick={handleAddClass} disabled={isSaving}>
                      {isSaving ? 'Đang xử lý...' : (editingClass ? 'Cập nhật' : 'Thêm')}
                    </Button>
                  </div>
                </Card>
              )}

              <div className="space-y-8">
                {(Object.entries(classesByGrade) as [string, Class[]][]).map(([grade, classes]) => (
                  <div key={grade} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", getGradeColor(grade))}>
                        Khối {grade}
                      </div>
                      <div className="h-px flex-1 bg-black/5"></div>
                    </div>
                    <DragDropContext onDragEnd={(res) => onDragEnd(res, 'classes', grade)}>
                      <Droppable droppableId={`classes-${grade}`} direction="horizontal">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {classes.map((cls, index) => (
                              <DraggableAny key={cls.id} draggableId={cls.id} index={index}>
                                {(provided: any) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps}>
                                    <Card className={cn("p-3 flex justify-between items-center group border transition-all hover:shadow-sm", getGradeColor(grade).split(' ').slice(0, 2).join(' '))}>
                                      <div className="flex items-center gap-2">
                                        <div {...provided.dragHandleProps} className="cursor-grab text-black/10 hover:text-black/30">
                                          <GripVertical size={14} />
                                        </div>
                                        <p className="font-bold text-sm">{cls.name}</p>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => {
                                            setEditingClass(cls);
                                            setNewClassName(cls.name);
                                            setNewClassGrade(cls.grade);
                                            setNewClassCount(1);
                                            setShowAddClass(true);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                          }}
                                          className="p-1.5 hover:bg-black/5 rounded-md text-black/40 hover:text-black transition-colors"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteClass(cls.id)}
                                          className="p-1.5 hover:bg-red-50 rounded-md text-black/40 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </Card>
                                  </div>
                                )}
                              </DraggableAny>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'judges' && data && (
            <motion.div key="judges" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Giám khảo</h1>
                  <p className="text-black/40">Quản lý ban giám khảo</p>
                </div>
                <Button onClick={() => {
                  if (showAddJudge) {
                    setEditingJudge(null);
                    setNewJudgeName('');
                    setNewJudgeCode('');
                  }
                  setShowAddJudge(!showAddJudge);
                }}>
                  <Plus size={18} /> {showAddJudge ? 'Hủy' : 'Thêm giám khảo'}
                </Button>
              </div>

              {showAddJudge && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">{editingJudge ? 'Sửa giám khảo' : 'Thêm giám khảo mới'}</h2>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <Input label="Tên giám khảo" value={newJudgeName} onChange={setNewJudgeName} placeholder="VD: Nguyễn Văn A" />
                    <Input label="Mã đăng nhập" value={newJudgeCode} onChange={setNewJudgeCode} placeholder="VD: GK01" />
                    <Button className="col-span-2" onClick={handleAddJudge}><Save size={18} /> {editingJudge ? 'Cập nhật' : 'Thêm'}</Button>
                  </div>
                </Card>
              )}

              <DragDropContext onDragEnd={(res) => onDragEnd(res, 'judges')}>
                <Droppable droppableId="judges-list">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {data.judges.map((j, index) => (
                        <DraggableAny key={j.id} draggableId={j.id} index={index}>
                          {(provided: any) => (
                            <div ref={provided.innerRef} {...provided.draggableProps}>
                              <Card className="p-4 flex items-center justify-between group hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div {...provided.dragHandleProps} className="cursor-grab text-black/10 hover:text-black/30">
                                    <GripVertical size={18} />
                                  </div>
                                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <UserCircle2 size={20} className="text-indigo-400" />
                                  </div>
                                  <div>
                                    <p className="font-bold">{j.name}</p>
                                    <p className="text-[10px] font-bold text-black/30">MÃ: {j.code}</p>
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => {
                                      setEditingJudge(j);
                                      setNewJudgeName(j.name);
                                      setNewJudgeCode(j.code || '');
                                      setShowAddJudge(true);
                                    }}
                                    className="p-2 hover:bg-black/5 rounded-lg text-black/40 hover:text-black transition-colors"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteJudge(j.id)}
                                    className="p-2 hover:bg-red-50 rounded-lg text-black/40 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </Card>
                            </div>
                          )}
                        </DraggableAny>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </motion.div>
          )}

          {activeTab === 'scoring' && data && (
            <motion.div key="scoring" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Chấm điểm</h1>
                  <p className="text-black/40">Nhập điểm cho từng nội dung</p>
                  {userRole === 'judge' && loggedInJudge && (
                    <p className="mt-2 font-bold text-emerald-600">Giám khảo: {loggedInJudge.name}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={exportScoringTemplate} className="border-indigo-100 text-indigo-600">
                    <Download size={18} /> {userRole === 'admin' && !selectedJudgeId ? 'Xuất mẫu tất cả GK' : 'Xuất mẫu Excel'}
                  </Button>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleImportExcel} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      disabled={isImporting}
                    />
                    <Button variant="secondary" disabled={isImporting}>
                      {isImporting ? "Đang xử lý..." : <><Upload size={18} /> Nhập từ Excel</>}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold uppercase text-black/40 ml-1">Chọn nội dung thi</label>
                  <select 
                    value={selectedEventId || ''} 
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-black/5 rounded-2xl focus:ring-2 focus:ring-black/10 outline-none font-medium"
                  >
                    <option value="">-- Chọn nội dung --</option>
                    {data.events.map(e => <option key={e.id} value={e.id}>{e.name} {e.is_locked ? '🔒' : ''}</option>)}
                  </select>
                </div>
                {userRole === 'admin' && (
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold uppercase text-black/40 ml-1">Chấm với tư cách GK</label>
                    <select 
                      value={selectedJudgeId || ''} 
                      onChange={(e) => setSelectedJudgeId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-black/5 rounded-2xl focus:ring-2 focus:ring-black/10 outline-none font-medium"
                    >
                      <option value="">-- Chọn giám khảo --</option>
                      {data.judges.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {selectedEventId && (selectedJudgeId || userRole === 'judge') && (
                <Card className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-black/5">
                        <th className="px-6 py-4 font-bold text-sm uppercase tracking-wider">Lớp</th>
                        {Array.from({ length: data.events.find(e => e.id === selectedEventId)?.round_count || 1 }).map((_, i) => {
                          const event = data.events.find(e => e.id === selectedEventId);
                          const customName = event?.round_names?.[i];
                          return (
                            <th key={i} className="px-6 py-4 font-bold text-sm uppercase tracking-wider text-center">
                              {customName || ((event?.round_count || 1) > 1 ? `Lần ${i + 1}` : 'Điểm số')}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.entries(classesByGrade) as [string, Class[]][]).map(([grade, classes]) => (
                        <React.Fragment key={grade}>
                          <tr className={cn("bg-black/[0.02]", getGradeColor(grade).split(' ')[0])}>
                            <td colSpan={10} className="px-6 py-2">
                              <span className={cn("text-[10px] font-bold uppercase tracking-widest", getGradeColor(grade).split(' ')[2])}>Khối {grade}</span>
                            </td>
                          </tr>
                          {classes.map(cls => {
                            const event = data.events.find(e => e.id === selectedEventId)!;
                            const judgeId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;

                            if (!judgeId) return null;

                            return (
                              <tr key={cls.id} className="border-t border-black/5 hover:bg-black/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                  <p className="font-bold">{cls.name}</p>
                                </td>
                                {Array.from({ length: event.round_count || 1 }).map((_, i) => (
                                  <td key={i} className="px-6 py-4 text-center">
                                    <ScoreInput 
                                      value={pendingScores[`${cls.id}-${i + 1}-none`] || 0}
                                      onChange={(val) => handleSaveScore(cls.id, selectedEventId, judgeId, i + 1, val)}
                                      disabled={event.is_locked}
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-6 bg-black/[0.02] border-t border-black/5 flex justify-end">
                    <Button 
                      onClick={handleBulkSaveScore} 
                      disabled={isSaving || data.events.find(e => e.id === selectedEventId)?.is_locked}
                      className="min-w-[200px]"
                    >
                      {isSaving ? 'Đang lưu...' : 'Xác nhận chấm điểm'}
                    </Button>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && data && (
            <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold">Cấu hình</h1>
                <p className="text-black/40">Thiết lập điểm quy đổi và hệ thống</p>
              </div>

              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Điểm quy đổi thứ hạng</h2>
                  <Button variant="outline" size="sm" onClick={() => {
                    const nextRank = conversions.length + 1;
                    setConversions([...conversions, { rank: nextRank, points: 0 }]);
                  }}>
                    <Plus size={16} /> Thêm hạng
                  </Button>
                </div>
                <div className="space-y-4">
                  {conversions.map((c, idx) => (
                    <div key={c.rank} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center font-bold">
                        #{c.rank}
                      </div>
                      <div className="flex-1">
                        <Input 
                          type="number" 
                          value={c.points} 
                          onChange={(val) => {
                            const newConvs = [...conversions];
                            newConvs[idx].points = val;
                            setConversions(newConvs);
                          }} 
                        />
                      </div>
                      <p className="text-sm font-bold text-black/30">Điểm</p>
                      <button 
                        onClick={() => {
                          const newConvs = conversions.filter((_, i) => i !== idx)
                            .map((conv, i) => ({ ...conv, rank: i + 1 }));
                          setConversions(newConvs);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <Button className="w-full mt-4" onClick={handleSaveConversions}><Save size={18} /> Lưu cấu hình</Button>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'summary' && data && (
            <motion.div key="summary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">Bảng tổng hợp</h1>
                  <p className="text-black/40">Kết quả quy đổi điểm toàn đoàn</p>
                </div>
                <Button variant="secondary" onClick={exportToExcel}><FileSpreadsheet size={18} /> Xuất Excel</Button>
              </div>

              <Card className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-black/5">
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider sticky left-0 bg-black/5 z-10">STT</th>
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider sticky left-12 bg-black/5 z-10">Lớp</th>
                      {data.events.map(e => (
                        <th key={e.id} className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center min-w-[140px]">
                          {e.name}
                          <div className="text-[9px] font-normal normal-case opacity-40">Quy đổi / Thô</div>
                        </th>
                      ))}
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center bg-black/10 min-w-[120px]">Tổng điểm</th>
                      <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center bg-black/10">Xếp hạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallSummary.map((s, idx) => {
                      const showGradeHeader = idx === 0 || overallSummary[idx-1].grade !== s.grade;
                      return (
                        <React.Fragment key={s.classId}>
                          {showGradeHeader && (
                            <tr className="bg-black/[0.03]">
                              <td colSpan={data.events.length + 5} className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
                                Khối {s.grade}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t border-black/5 hover:bg-black/[0.02] transition-colors">
                            <td className="px-6 py-4 text-sm text-black/40 sticky left-0 bg-white">{idx + 1}</td>
                            <td className="px-6 py-4 sticky left-12 bg-white">
                              <p className="font-bold">{s.className}</p>
                              <p className="text-[10px] font-bold text-black/30">KHỐI {s.grade}</p>
                            </td>
                            {data.events.map(e => (
                              <td key={e.id} className="px-6 py-4 text-center">
                                <div className="font-bold text-emerald-600">{s.eventPoints[e.id] || 0}</div>
                                <div className="text-[10px] text-black/30">Thô: {s.eventRawScores[e.id] || 0}</div>
                              </td>
                            ))}
                            <td className="px-6 py-4 text-center bg-black/[0.02]">
                              <div className="font-bold text-lg">{s.totalPoints}</div>
                              <div className="text-[10px] text-black/30">Tổng thô: {s.totalRawScore}</div>
                            </td>
                            <td className="px-6 py-4 text-center sticky right-0 bg-white">
                              <div className={cn(
                                "inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold",
                                s.overallRank === 1 ? "bg-amber-100 text-amber-700" : 
                                s.overallRank === 2 ? "bg-slate-100 text-slate-700" : 
                                s.overallRank === 3 ? "bg-orange-100 text-orange-700" : "bg-black/5 text-black/40"
                              )}>
                                {s.overallRank}
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </motion.div>
          )}

          {activeTab === 'rankings' && data && (
            <motion.div key="rankings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Bảng xếp hạng</h1>
                  <p className="text-black/40">Xem thứ hạng chi tiết theo bộ lọc</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="w-48">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-1 block">Nội dung</label>
                    <select 
                      value={rankingEventId || ''} 
                      onChange={(e) => setRankingEventId(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl focus:ring-2 focus:ring-black/10 outline-none font-medium shadow-sm text-sm"
                    >
                      <option value="overall">Tổng hợp toàn đoàn</option>
                      {data.events.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-1 block">Khối</label>
                    <select 
                      value={rankingGrade} 
                      onChange={(e) => setRankingGrade(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl focus:ring-2 focus:ring-black/10 outline-none font-medium shadow-sm text-sm"
                    >
                      <option value="all">Tất cả khối</option>
                      {Array.from(new Set(data.classes.map(c => c.grade))).sort().map(g => (
                        <option key={g} value={g}>Khối {g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-1 block">Giới hạn</label>
                    <select 
                      value={rankingLimit} 
                      onChange={(e) => setRankingLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl focus:ring-2 focus:ring-black/10 outline-none font-medium shadow-sm text-sm"
                    >
                      <option value="all">Tất cả</option>
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                  </div>
                  {rankingEventId && (
                    <div className="flex items-end">
                      <Button variant="secondary" onClick={() => rankingEventId === 'overall' ? exportToExcel() : exportEventRankings(rankingEventId)} className="h-[38px]">
                        <FileSpreadsheet size={16} /> Xuất Excel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {(rankingGrade === 'all' ? Array.from(new Set(data.classes.map(c => c.grade))).sort() : [rankingGrade]).map(grade => {
                  let results: any[] = [];
                  let title = "";

                  if (rankingEventId === 'overall') {
                    results = overallSummary
                      .filter(s => s.grade === grade)
                      .map(s => ({
                        id: s.classId,
                        name: s.className,
                        score: s.totalPoints,
                        rawScore: s.totalRawScore,
                        rank: s.overallRank
                      }));
                    title = "Bảng điểm tổng hợp";
                  } else {
                    const eventRes = eventResults.find(er => er.event.id === rankingEventId);
                    results = (eventRes?.results || [])
                      .filter(r => r.grade === grade)
                      .map(r => ({
                        id: r.classId,
                        name: r.className,
                        score: r.convertedPoints,
                        rawScore: r.totalScore,
                        rank: r.rank
                      }));
                    title = `Nội dung: ${eventRes?.event.name}`;
                  }

                  results.sort((a, b) => a.rank - b.rank);
                  if (rankingLimit !== 'all') {
                    results = results.slice(0, rankingLimit);
                  }

                  if (results.length === 0) return null;

                  return (
                    <Card key={grade} className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-sm">Khối {grade}</span>
                          {title}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-max">
                          <thead>
                            <tr className="bg-black/5">
                              <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider w-20">Hạng</th>
                              <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Lớp</th>
                              <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center">Điểm thô</th>
                              <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center">Điểm quy đổi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                            {results.map((r) => (
                              <tr key={r.id} className="hover:bg-black/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold",
                                    r.rank === 1 ? "bg-amber-100 text-amber-700" : 
                                    r.rank === 2 ? "bg-slate-100 text-slate-700" : 
                                    r.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-black/5 text-black/40"
                                  )}>
                                    {r.rank || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-bold">{r.name}</td>
                                <td className="px-6 py-4 text-center font-medium">{r.rawScore}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                                    {rankingEventId === 'overall' ? r.score : `+${r.score}`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
          : "text-indigo-600/60 hover:bg-indigo-50 hover:text-indigo-600"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="p-6 border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-indigo-950">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600/40">{label}</p>
    </Card>
  );
}

function ScoreInput({ value, onChange, disabled }: { value: number; onChange: (val: number) => void; disabled?: boolean }) {
  const [localValue, setLocalValue] = useState(isNaN(value) ? "" : value.toString());

  useEffect(() => {
    setLocalValue(isNaN(value) ? "" : value.toString());
  }, [value]);

  return (
    <input
      type="number"
      value={localValue}
      disabled={disabled}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        const num = parseFloat(localValue);
        if (!isNaN(num)) onChange(num);
        else setLocalValue(value.toString());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const num = parseFloat(localValue);
          if (!isNaN(num)) onChange(num);
          else setLocalValue(value.toString());
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-20 px-3 py-2 bg-black/5 border-none rounded-lg text-center font-bold focus:ring-2 focus:ring-black/10 outline-none disabled:opacity-50"
    />
  );
}

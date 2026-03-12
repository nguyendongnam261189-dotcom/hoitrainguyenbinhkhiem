import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Trophy, Settings, Plus, Save, Lock, Unlock, 
  FileSpreadsheet, ChevronRight, BarChart3, LogOut, UserCircle2, Trash2, 
  Edit2, CheckCircle2, AlertCircle, GripVertical, Download, Upload, Menu, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Competition, Class, Event, Judge, Score, PointConversion, FullCompetitionData } from './types';

const DraggableAny = Draggable as any;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---
const Card = ({ children, className }: any) => (
  <div className={cn("bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden", className)}>{children}</div>
);

const Button = ({ children, onClick, variant = 'primary', className, disabled, size = 'md' }: any) => {
  const variants: any = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200',
    secondary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100',
    outline: 'border border-indigo-100 hover:bg-indigo-50 bg-white text-indigo-600',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-100',
    ghost: 'hover:bg-black/5'
  };
  const sizes: any = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' };
  return (
    <button onClick={onClick} disabled={disabled} className={cn("rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap", variants[variant], sizes[size], className)}>
      {children}
    </button>
  );
};

const Input = ({ label, type = 'text', value, onChange, placeholder, className, onKeyDown }: any) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && <label className="text-[10px] font-bold uppercase tracking-wider text-black/40 ml-1">{label}</label>}
    <input type={type} value={value ?? ""} onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="px-4 py-3 bg-black/5 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-base" />
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [pendingScores, setPendingScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [judgeLoginCode, setJudgeLoginCode] = useState('');
  const [loggedInJudge, setLoggedInJudge] = useState<Judge | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load Initial Data
  useEffect(() => { fetchCompetitions(); }, []);
  useEffect(() => { if (selectedCompId) fetchFullData(selectedCompId); }, [selectedCompId]);

  // Sync Scores
  useEffect(() => {
    if (selectedEventId && data) {
      const jId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
      if (jId) {
        const scores: Record<string, number> = {};
        data.scores.forEach(s => {
          if (s.event_id === selectedEventId && s.judge_id === jId) {
            scores[`${s.class_id}-${s.round}-${s.category || 'none'}`] = s.score;
          }
        });
        setPendingScores(scores);
        setIsDirty(false);
      }
    }
  }, [selectedEventId, selectedJudgeId, userRole, loggedInJudge, data]);

  // --- API Functions ---
  const fetchCompetitions = async () => {
    const res = await fetch('/api/competitions');
    const json = await res.json();
    setCompetitions(json);
  };

  const fetchFullData = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/competitions/${id}/full`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminLoginPassword })
    });
    if (res.ok) { setUserRole('admin'); setShowAdminLogin(false); }
    else setLoginError('Mật khẩu sai');
  };

  const handleJudgeLogin = async () => {
    setIsLoggingIn(true);
    const res = await fetch('/api/judges/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: judgeLoginCode, competition_id: selectedCompId })
    });
    if (res.ok) { setLoggedInJudge(await res.json()); setUserRole('judge'); setActiveTab('scoring'); }
    else setLoginError('Mã sai hoặc hội thi đã khóa');
    setIsLoggingIn(false);
  };

  const handleBulkSaveScore = async () => {
    const jId = userRole === 'judge' ? loggedInJudge?.id : selectedJudgeId;
    if (!jId || !selectedEventId) return;
    setIsSaving(true);
    const scores = Object.entries(pendingScores).map(([key, score]) => {
      const [classId, round, cat] = key.split('-');
      return { class_id: classId, event_id: selectedEventId, judge_id: jId, round: Number(round), score, category: cat === 'none' ? null : cat };
    });
    const res = await fetch('/api/scores/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores })
    });
    if (res.ok) { alert("Đã lưu!"); setIsDirty(false); fetchFullData(selectedCompId!); }
    setIsSaving(false);
  };

  // --- EXCEL FUNCTIONS (Sửa lỗi ReferenceError) ---
  const exportToExcel = async () => {
    if (!data) return;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("KetQua");
    ws.addRow(["BẢNG TỔNG HỢP", data.competition.name]);
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `KetQua_${data.competition.name}.xlsx`);
  };

  const exportScoringTemplate = () => alert("Tính năng đang được nạp...");
  const handleImportExcel = () => alert("Vui lòng chọn file mẫu.");

  // --- Calculations ---
  const classesByGrade = useMemo(() => {
    const grouped: any = {};
    data?.classes.forEach(c => { if (!grouped[c.grade]) grouped[c.grade] = []; grouped[c.grade].push(c); });
    return grouped;
  }, [data]);

  const overallSummary = useMemo(() => {
    if (!data) return [];
    return data.classes.map(c => ({ ...c, totalPoints: 0, overallRank: 1 })).sort((a,b) => a.grade.localeCompare(b.grade));
  }, [data]);

  // --- Render Helpers ---
  const getGradeColor = (g: string) => "bg-indigo-50 text-indigo-700 border-indigo-100";

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse text-xl">Đang tải dữ liệu...</div>;

  if (!userRole) {
    return (
      <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center mb-8">
            <Trophy className="mx-auto text-indigo-600 mb-4" size={60} />
            <h1 className="text-3xl font-bold text-indigo-950">HỘI THI {new Date().getFullYear()}</h1>
          </div>
          <Card className="p-6 space-y-4">
            <Button className="w-full h-14" onClick={() => setShowAdminLogin(true)}>QUẢN TRỊ VIÊN</Button>
            <Button variant="secondary" className="w-full h-14" onClick={() => setUserRole('judge')}>GIÁM KHẢO</Button>
          </Card>
          {showAdminLogin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <Input label="Mật khẩu Admin" type="password" value={adminLoginPassword} onChange={setAdminLoginPassword} onKeyDown={(e:any) => e.key === 'Enter' && handleAdminLogin()} />
              <Button className="w-full mt-2" onClick={handleAdminLogin}>Xác nhận</Button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50/20 flex flex-col lg:flex-row font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-indigo-100 p-4 sticky top-0 z-[100] flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Trophy className="text-indigo-600" size={24} />
          <span className="font-bold truncate max-w-[200px]">{data?.competition.name || "Hội thi"}</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-black/5 rounded-lg">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-[110] w-72 bg-white border-r border-indigo-100 flex flex-col shadow-xl lg:relative lg:translate-x-0 transition-transform", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-6 space-y-1.5 flex-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard />} label="Tổng quan" />
          <NavItem active={activeTab === 'scoring'} onClick={() => { setActiveTab('scoring'); setIsMobileMenuOpen(false); }} icon={<CheckCircle2 />} label="Chấm điểm" />
          <NavItem active={activeTab === 'summary'} onClick={() => { setActiveTab('summary'); setIsMobileMenuOpen(false); }} icon={<BarChart3 />} label="Kết quả" />
        </div>
        <div className="p-6 border-t border-indigo-50">
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>Đăng xuất</Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-8 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'scoring' && data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <h1 className="text-2xl font-bold text-indigo-950">Nhập điểm hội thi</h1>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button variant="outline" size="sm" onClick={exportScoringTemplate}><Download size={16} /> Mẫu Excel</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Chọn nội dung" type="select" value={selectedEventId} onChange={setSelectedEventId}>
                   <select className="w-full p-3 bg-white border rounded-xl" value={selectedEventId || ''} onChange={(e)=>setSelectedEventId(e.target.value)}>
                      <option value="">-- Chọn môn thi --</option>
                      {data.events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                   </select>
                </Input>
                {userRole === 'admin' && (
                  <select className="w-full mt-5 p-3 bg-white border rounded-xl" value={selectedJudgeId || ''} onChange={(e)=>setSelectedJudgeId(e.target.value)}>
                    <option value="">-- Chọn Giám khảo --</option>
                    {data.judges.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                )}
              </div>

              {selectedEventId && (selectedJudgeId || userRole === 'judge') && (
                <>
                  {/* CỐ ĐỊNH NÚT LƯU VÀ TIÊU ĐỀ */}
                  <div className="sticky top-[64px] lg:top-[-32px] z-[90] bg-indigo-50/95 backdrop-blur-md p-4 -mx-4 lg:-mx-8 border-b border-indigo-100 shadow-md flex justify-between items-center">
                    <span className={cn("text-sm font-bold", isDirty ? "text-amber-600 animate-pulse" : "text-emerald-600")}>
                      {isDirty ? "● Chưa lưu thay đổi" : "✓ Đã đồng bộ"}
                    </span>
                    <Button onClick={handleBulkSaveScore} disabled={isSaving || !isDirty} className="h-11 px-8">
                       <Save size={18} /> {isSaving ? "Đang lưu..." : "Lưu điểm"}
                    </Button>
                  </div>

                  <Card className="overflow-visible">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-[135px] lg:top-[45px] z-[85] bg-slate-100 shadow-sm border-b">
                          <tr>
                            <th className="px-6 py-4 text-left font-bold text-indigo-900 min-w-[150px]">Tên Lớp</th>
                            {Array.from({ length: data.events.find(e=>e.id===selectedEventId)?.round_count || 1 }).map((_, i) => (
                              <th key={i} className="px-6 py-4 text-center font-bold text-indigo-900">Lần {i+1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(classesByGrade).map(([grade, classes]: any) => (
                            <React.Fragment key={grade}>
                              <tr className="sticky top-[185px] lg:top-[95px] z-[80] bg-indigo-50/90 backdrop-blur-sm border-y">
                                <td colSpan={10} className="px-6 py-2 font-bold text-indigo-600 uppercase text-xs">Khối {grade}</td>
                              </tr>
                              {classes.map((cls: any) => (
                                <tr key={cls.id} className="border-b hover:bg-black/[0.01]">
                                  <td className="px-6 py-4 font-bold text-slate-700">{cls.name}</td>
                                  {Array.from({ length: data.events.find(e=>e.id===selectedEventId)?.round_count || 1 }).map((_, i) => (
                                    <td key={i} className="px-6 py-4 text-center">
                                      <input 
                                        type="number" 
                                        value={pendingScores[`${cls.id}-${i+1}-none`] ?? ""} 
                                        onChange={(e) => {
                                          setPendingScores({...pendingScores, [`${cls.id}-${i+1}-none`]: parseFloat(e.target.value)});
                                          setIsDirty(true);
                                        }}
                                        className="w-20 p-2 bg-black/5 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
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
                </>
              )}
            </motion.div>
          )}
          {activeTab === 'dashboard' && <div className="text-xl font-bold">Chào mừng bạn trở lại!</div>}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium", active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-indigo-600/60 hover:bg-indigo-50")}>
      {icon} <span>{label}</span>
    </button>
  );
}

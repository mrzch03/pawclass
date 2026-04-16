import { useEffect, useState } from "react";
import { authFetch, getUser, clearAuth } from "../lib/auth";
import { API_BASE as API } from "../lib/config";


interface StudentOverview {
  studentId: string;
  accuracy: number;
  totalAttempts: number;
  dueForReview: number;
  totalConcepts: number;
  byLevel: { new: number; learning: number; practiced: number; mastered: number };
}

interface ConceptAvg {
  conceptId: string;
  name: string;
  average: number;
  studentCount: number;
}

interface Directive {
  id: string;
  studentId: string;
  content: string;
  status: string;
  agentNote: string | null;
  createdAt: string;
}

export function TeacherDashboard() {
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [overview, setOverview] = useState<{ conceptAverages: ConceptAvg[] } | null>(null);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/api/teacher/students`).then(r => r.json()),
      authFetch(`${API}/api/teacher/overview`).then(r => r.json()),
      authFetch(`${API}/api/teacher/directives`).then(r => r.json()),
    ]).then(([s, o, d]) => {
      setStudents(s);
      setOverview(o);
      setDirectives(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalStudents = students.length;
  const avgAccuracy = totalStudents > 0 ? Math.round(students.reduce((s, st) => s + st.accuracy, 0) / totalStudents) : 0;
  const totalDue = students.reduce((s, st) => s + st.dueForReview, 0);
  const weakConcepts = (overview?.conceptAverages || []).filter(c => c.average < 60).slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm mb-1">教师端</p>
            <h1 className="text-2xl font-bold">全班概览</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-indigo-200 text-sm">{getUser()}</span>
            <a href="/teacher/directives" className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20">指令管理</a>
            <button onClick={() => { clearAuth(); window.location.href = "/dashboard"; }} className="text-xs text-indigo-300 hover:text-white">退出</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="学生数" value={totalStudents} color="indigo" />
          <StatCard label="平均准确率" value={`${avgAccuracy}%`} color="emerald" />
          <StatCard label="全班待复习" value={totalDue} color="amber" />
          <StatCard label="薄弱知识点" value={weakConcepts.length} color="red" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Student cards */}
          <div className="col-span-2">
            <h3 className="text-sm font-semibold text-slate-500 mb-3">学生列表</h3>
            <div className="grid grid-cols-2 gap-3">
              {students.map(s => (
                <a
                  key={s.studentId}
                  href={`/teacher/student/${s.studentId}`}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {s.studentId.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800">{s.studentId}</span>
                    </div>
                    <span className={`text-lg font-bold ${s.accuracy >= 70 ? "text-emerald-600" : s.accuracy >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {s.accuracy}%
                    </span>
                  </div>
                  {/* Mastery bar */}
                  <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-2">
                    {s.byLevel.mastered > 0 && <div className="bg-emerald-500" style={{ flex: s.byLevel.mastered }} />}
                    {s.byLevel.practiced > 0 && <div className="bg-blue-500" style={{ flex: s.byLevel.practiced }} />}
                    {s.byLevel.learning > 0 && <div className="bg-amber-400" style={{ flex: s.byLevel.learning }} />}
                    {s.byLevel.new > 0 && <div className="bg-slate-200" style={{ flex: s.byLevel.new }} />}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>做题 {s.totalAttempts}</span>
                    <span>待复习 {s.dueForReview}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Weak concepts */}
            <h3 className="text-sm font-semibold text-slate-500 mb-3">全班薄弱知识点</h3>
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              {weakConcepts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {weakConcepts.map(c => (
                    <div key={c.conceptId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                        <span className="text-xs text-red-500 font-mono">{c.average}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${c.average}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent directives */}
            <h3 className="text-sm font-semibold text-slate-500 mb-3">最近指令</h3>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {directives.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">暂无指令</p>
              ) : (
                <div className="space-y-2">
                  {directives.slice(0, 5).map(d => (
                    <div key={d.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                      <StatusDot status={d.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{d.content}</p>
                        <p className="text-xs text-slate-400">{d.studentId} · {d.createdAt?.split("T")[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-4 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "done" ? "bg-emerald-500" : status === "executing" ? "bg-blue-500" : status === "pending" ? "bg-amber-400" : "bg-slate-300";
  return <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${color}`} />;
}

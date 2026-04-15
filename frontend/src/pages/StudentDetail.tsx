import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

const API = "";

export function StudentDetail({ studentId }: { studentId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [directives, setDirectives] = useState<any[]>([]);
  const [directiveText, setDirectiveText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    const [p, h, d] = await Promise.all([
      authFetch(`${API}/api/teacher/student/${studentId}/profile`).then(r => r.json()),
      authFetch(`${API}/api/teacher/student/${studentId}/history?limit=10`).then(r => r.json()),
      authFetch(`${API}/api/teacher/directives?studentId=${studentId}`).then(r => r.json()),
    ]);
    setProfile(p);
    setHistory(h);
    setDirectives(d);
    setLoading(false);
  }

  async function sendDirective() {
    if (!directiveText.trim()) return;
    setSending(true);
    await authFetch(`${API}/api/teacher/directive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, content: directiveText }),
    });
    setDirectiveText("");
    setSending(false);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const levelColors: Record<string, string> = {
    mastered: "bg-emerald-100 text-emerald-700",
    practiced: "bg-blue-100 text-blue-700",
    learning: "bg-amber-100 text-amber-700",
    new: "bg-slate-100 text-slate-500",
  };
  const levelLabels: Record<string, string> = {
    mastered: "已掌握", practiced: "已练习", learning: "学习中", new: "未开始",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <a href="/teacher" className="text-xs text-slate-400 hover:text-indigo-500 mb-2 inline-block">← 返回全班概览</a>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {studentId.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{studentId} 的学习画像</h1>
                <p className="text-sm text-slate-400">
                  做题 {profile?.totalAttempts || 0} · 准确率 {profile?.accuracy || 0}% · 待复习 {profile?.dueForReview || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left: mastery + weakness */}
          <div className="col-span-2 space-y-4">
            {/* Mastery bar */}
            {profile && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-500 mb-3">掌握度概览</h3>
                <div className="flex gap-0.5 h-3 rounded-full overflow-hidden mb-3">
                  {profile.byLevel.mastered > 0 && <div className="bg-emerald-500" style={{ flex: profile.byLevel.mastered }} />}
                  {profile.byLevel.practiced > 0 && <div className="bg-blue-500" style={{ flex: profile.byLevel.practiced }} />}
                  {profile.byLevel.learning > 0 && <div className="bg-amber-400" style={{ flex: profile.byLevel.learning }} />}
                  {profile.byLevel.new > 0 && <div className="bg-slate-200" style={{ flex: profile.byLevel.new }} />}
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 已掌握 {profile.byLevel.mastered}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 已练习 {profile.byLevel.practiced}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 学习中 {profile.byLevel.learning}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" /> 未开始 {profile.byLevel.new}</span>
                </div>
              </div>
            )}

            {/* Weak concepts */}
            {profile?.weakConcepts?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-500 mb-3">薄弱知识点</h3>
                <div className="space-y-2">
                  {profile.weakConcepts.map((w: any) => (
                    <div key={w.conceptId} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${levelColors[w.masteryLevel] || levelColors.new}`}>
                          {levelLabels[w.masteryLevel] || w.masteryLevel}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{w.conceptId}</span>
                        <span className="text-xs text-slate-400">错 {w.wrongCount} 次</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${w.accuracy < 50 ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${w.accuracy}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{w.accuracy}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice history */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-500 mb-3">近期练习记录</h3>
              {history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">暂无记录</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h: any) => {
                    const exercises = h.exercises || [];
                    const score = exercises.filter((e: any) => e.result === true).length;
                    const total = exercises.length;
                    return (
                      <div key={h.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-slate-700">{h.title || h.mode}</span>
                          <span className="text-xs text-slate-400 ml-2">{h.startedAt?.split("T")[0]}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${total > 0 && score / total >= 0.7 ? "text-emerald-600" : "text-amber-600"}`}>
                            {score}/{total}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            h.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}>
                            {h.status === "completed" ? "完成" : h.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: directive */}
          <div className="space-y-4">
            {/* Send directive */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-500 mb-3">发指令给 Agent</h3>
              <textarea
                value={directiveText}
                onChange={e => setDirectiveText(e.target.value)}
                placeholder="例如：语法薄弱，加强 be 动词练习"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-indigo-400"
                rows={3}
              />
              <button
                onClick={sendDirective}
                disabled={!directiveText.trim() || sending}
                className="mt-2 w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {sending ? "发送中..." : "发送指令"}
              </button>
            </div>

            {/* Directive history */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-500 mb-3">指令历史</h3>
              {directives.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">暂无指令</p>
              ) : (
                <div className="space-y-3">
                  {directives.map((d: any) => (
                    <div key={d.id} className="pb-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          d.status === "done" ? "bg-emerald-500" : d.status === "executing" ? "bg-blue-500" : "bg-amber-400"
                        }`} />
                        <span className="text-xs text-slate-400">
                          {d.status === "done" ? "已完成" : d.status === "executing" ? "执行中" : "待执行"}
                        </span>
                        <span className="text-xs text-slate-300">{d.createdAt?.split("T")[0]}</span>
                      </div>
                      <p className="text-sm text-slate-700">{d.content}</p>
                      {d.agentNote && (
                        <p className="text-xs text-emerald-600 mt-1">Agent: {d.agentNote}</p>
                      )}
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

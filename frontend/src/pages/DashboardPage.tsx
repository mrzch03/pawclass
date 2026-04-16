import { useEffect, useState } from "react";
import { authFetch, getUser, clearAuth } from "../lib/auth";
import type { LearnerProfile, DailyPlan, ConceptSummary } from "../types/learning";

import { DEFAULT_COURSE_ID as COURSE_ID, API_BASE as API } from "../lib/config";

export function DashboardPage() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [concepts, setConcepts] = useState<ConceptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/api/learner/profile?course=${COURSE_ID}`).then((r) => r.json()),
      authFetch(`${API}/api/plan/today?course=${COURSE_ID}`).then((r) => r.json()),
      fetch(`${API}/api/kb/concepts`).then((r) => r.json()),
    ]).then(([p, pl, c]) => {
      setProfile(p);
      setPlan(pl);
      setConcepts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function startPractice(mode: string, conceptIds?: string[]) {
    const res = await authFetch(`${API}/api/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: COURSE_ID, mode, concepts: conceptIds, count: 10 }),
    });
    const data = await res.json();
    if (data.id) {
      window.location.href = `/practice/${data.id}`;
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-8">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <p className="text-blue-200 text-sm mb-1">七年级英语上册</p>
            <h1 className="text-2xl font-bold">学习中心</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-blue-200 text-sm">{getUser()}</span>
            <button onClick={() => { clearAuth(); window.location.href = "/dashboard"; }} className="text-xs text-blue-300 hover:text-white">退出</button>
          </div>
        </div>
        {profile && (
          <p className="text-blue-100 text-sm mt-2">
            已掌握 {profile.byLevel.mastered + profile.byLevel.practiced} / {profile.totalConcepts} 个知识点 · 准确率 {profile.accuracy}%
          </p>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4">
        {/* Stat cards */}
        {profile && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="知识点" value={profile.totalConcepts} color="blue" />
            <StatCard label="已掌握" value={profile.byLevel.mastered} color="emerald" />
            <StatCard label="待复习" value={profile.dueForReview} color="amber" />
            <StatCard label="准确率" value={`${profile.accuracy}%`} color="purple" />
          </div>
        )}

        {/* Today's Plan */}
        {plan && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-800">今日计划</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {plan.source === "agent" ? "Agent 制定" : "自动生成"} · {plan.totalMinutes} 分钟
                </p>
              </div>
              <span className="text-sm text-slate-500">
                {plan.completedCount}/{(plan.tasks as any[]).length} 完成
              </span>
            </div>
            <div className="space-y-2">
              {(plan.tasks as any[]).map((task: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    task.status === "completed"
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-slate-200 hover:border-blue-300 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (task.status !== "completed") {
                      startPractice(task.mode, task.conceptIds);
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    task.status === "completed" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {task.status === "completed" ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-700">{task.description}</div>
                    <div className="text-xs text-slate-400">{task.count} 题 · {task.minutes} 分钟</div>
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {task.type === "review" ? "复习" : task.type === "new" ? "新学" : "练习"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <ActionCard
            title="开始复习"
            desc={`${profile?.dueForReview || 0} 个知识点待复习`}
            color="amber"
            onClick={() => startPractice("review")}
          />
          <ActionCard
            title="自由练习"
            desc="随机出题训练"
            color="blue"
            onClick={() => startPractice("practice")}
          />
          <ActionCard
            title="薄弱强化"
            desc="针对弱项出题"
            color="red"
            onClick={() => {
              const weakIds = profile?.weakConcepts.map((w) => w.conceptId) || [];
              startPractice("practice", weakIds);
            }}
          />
        </div>

        {/* Weak concepts */}
        {profile && profile.weakConcepts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <h2 className="font-semibold text-slate-800 mb-3">薄弱知识点</h2>
            <div className="space-y-2">
              {profile.weakConcepts.map((w) => {
                const concept = concepts.find((c) => c.id === w.conceptId);
                return (
                  <div key={w.conceptId} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{concept?.name || w.conceptId}</span>
                      <span className="text-xs text-slate-400 ml-2">错 {w.wrongCount} 次</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${w.accuracy}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-10 text-right">{w.accuracy}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mastery overview */}
        {profile && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-8">
            <h2 className="font-semibold text-slate-800 mb-3">掌握度概览</h2>
            <div className="flex gap-1 h-4 rounded-full overflow-hidden">
              {profile.byLevel.mastered > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ flex: profile.byLevel.mastered }} title={`已掌握 ${profile.byLevel.mastered}`} />
              )}
              {profile.byLevel.practiced > 0 && (
                <div className="bg-blue-500 transition-all" style={{ flex: profile.byLevel.practiced }} title={`已练习 ${profile.byLevel.practiced}`} />
              )}
              {profile.byLevel.learning > 0 && (
                <div className="bg-amber-400 transition-all" style={{ flex: profile.byLevel.learning }} title={`学习中 ${profile.byLevel.learning}`} />
              )}
              {profile.byLevel.new > 0 && (
                <div className="bg-slate-200 transition-all" style={{ flex: profile.byLevel.new }} title={`未开始 ${profile.byLevel.new}`} />
              )}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 已掌握 {profile.byLevel.mastered}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 已练习 {profile.byLevel.practiced}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 学习中 {profile.byLevel.learning}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" /> 未开始 {profile.byLevel.new}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-4 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, color, onClick }: { title: string; desc: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    amber: "border-amber-200 hover:bg-amber-50",
    blue: "border-blue-200 hover:bg-blue-50",
    red: "border-red-200 hover:bg-red-50",
  };
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-xl border-2 p-4 transition-colors ${colors[color]}`}
    >
      <div className="font-semibold text-sm text-slate-800">{title}</div>
      <div className="text-xs text-slate-400 mt-1">{desc}</div>
    </button>
  );
}

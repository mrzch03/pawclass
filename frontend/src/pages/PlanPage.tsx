import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";
import type { DailyPlan } from "../types/learning";

const API = "";
const COURSE_ID = "middle/grade7-up/english";

export function PlanPage() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    const res = await authFetch(`${API}/api/plan/today?course=${COURSE_ID}`);
    const data = await res.json();
    setPlan(data);
    setLoading(false);
  }

  async function startTask(task: any, index: number) {
    const res = await authFetch(`${API}/api/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: COURSE_ID,
        mode: task.mode,
        concepts: task.conceptIds,
        count: task.count,
      }),
    });
    const data = await res.json();
    if (data.id) window.location.href = `/practice/${data.id}`;
  }

  async function markComplete(index: number) {
    if (!plan) return;
    await authFetch(`${API}/api/plan/${plan.id}/task/${index}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    loadPlan();
  }

  async function skipTask(index: number) {
    if (!plan) return;
    await authFetch(`${API}/api/plan/${plan.id}/task/${index}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    loadPlan();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-3">暂无今日计划</p>
          <a href="/dashboard" className="text-blue-500 hover:underline">返回学习中心</a>
        </div>
      </div>
    );
  }

  const tasks = plan.tasks as any[];
  const completedCount = tasks.filter((t: any) => t.status === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const typeIcons: Record<string, string> = { review: "🔁", practice: "✍️", new: "🆕" };
  const typeLabels: Record<string, string> = { review: "复习", practice: "练习", new: "新学" };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <a href="/dashboard" className="text-xs text-slate-400 hover:text-blue-500 mb-1 inline-block">← 返回学习中心</a>
              <h1 className="text-xl font-bold text-slate-800">今日学习计划</h1>
              <p className="text-sm text-slate-400 mt-1">
                {plan.planDate} · {plan.source === "agent" ? "Agent 制定" : "自动生成"} · {plan.totalMinutes} 分钟
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{progress}%</div>
              <div className="text-xs text-slate-400">{completedCount}/{tasks.length} 完成</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="space-y-3">
          {tasks.map((task: any, i: number) => {
            const done = task.status === "completed";
            const skipped = task.status === "skipped";

            return (
              <div
                key={i}
                className={`bg-white rounded-xl border-2 p-5 transition-all ${
                  done ? "border-emerald-200 bg-emerald-50/50" :
                  skipped ? "border-slate-200 opacity-50" :
                  "border-slate-200 hover:border-blue-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Number/check */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                    done ? "bg-emerald-500 text-white" :
                    skipped ? "bg-slate-200 text-slate-400" :
                    "bg-blue-100 text-blue-600"
                  }`}>
                    {done ? "✓" : skipped ? "—" : typeIcons[task.type] || (i + 1)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${done ? "text-emerald-700 line-through" : "text-slate-800"}`}>
                        {task.description}
                      </h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                        {typeLabels[task.type] || task.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {task.count} 题 · {task.minutes} 分钟
                    </p>
                    {task.conceptIds?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {task.conceptIds.map((cid: string) => (
                          <span key={cid} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-500 rounded-full">{cid}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!done && !skipped && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startTask(task, i)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        开始
                      </button>
                      <button
                        onClick={() => skipTask(i)}
                        className="px-3 py-2 text-sm text-slate-400 hover:text-slate-600"
                      >
                        跳过
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* All done */}
        {completedCount === tasks.length && tasks.length > 0 && (
          <div className="mt-8 text-center bg-emerald-50 rounded-2xl p-8">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold text-emerald-800">今日计划已完成!</h2>
            <p className="text-sm text-emerald-600 mt-2">继续保持，明天见!</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";
import { usePracticeStore } from "../store/practice-store";
import { ExerciseCard } from "../components/exercises/ExerciseCard";

interface PracticePageProps {
  sessionId: string;
}

export function PracticePage({ sessionId }: PracticePageProps) {
  const store = usePracticeStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  async function loadSession() {
    try {
      const res = await authFetch(`/api/practice/${sessionId}`);
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();

      if (data.status === "completed") {
        store.startSession(sessionId, []);
        store.complete();
        return;
      }

      // Load exercises with full data
      const exercises = (data.exercises as any[]).map((e: any) => ({
        id: e.exerciseId,
        type: "fill_blank",
        question: e.exerciseId,
        concepts: [e.conceptId],
        difficulty: 2,
      }));

      // Fetch actual exercises from KB API
      const conceptIds = [...new Set((data.exercises as any[]).map((e: any) => e.conceptId).filter(Boolean))];
      const allExercises: any[] = [];
      for (const cid of conceptIds) {
        const exRes = await fetch(`/api/kb/exercises/${cid}`);
        if (exRes.ok) {
          const exData = await exRes.json();
          allExercises.push(...exData);
        }
      }

      // Match session exercises with KB data
      const matched = (data.exercises as any[])
        .filter((e: any) => e.status === "pending")
        .map((e: any) => {
          const kbEx = allExercises.find((k: any) => k.id === e.exerciseId);
          return kbEx || { id: e.exerciseId, type: "fill_blank", question: e.exerciseId, concepts: [e.conceptId], difficulty: 2 };
        });

      store.startSession(sessionId, matched);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-400 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>加载练习中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <a href="/dashboard" className="text-blue-500 hover:underline">返回</a>
        </div>
      </div>
    );
  }

  if (store.status === "completed") {
    return <CompletionScreen />;
  }

  const current = store.exercises[store.currentIndex];
  if (!current) return null;

  const result = store.results.get(current.id);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <ExerciseCard
        exercise={current}
        index={store.currentIndex}
        total={store.total}
        result={result}
        onSubmit={async (answer) => {
          await store.submitAnswer(current.id, answer);
        }}
        onNext={() => {
          if (store.currentIndex < store.exercises.length - 1) {
            store.next();
          } else {
            store.complete();
          }
        }}
      />
    </div>
  );
}

function CompletionScreen() {
  const { score, total, reset } = usePracticeStore();
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">
          {accuracy >= 80 ? "🎉" : accuracy >= 60 ? "👍" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">练习完成!</h2>
        <div className="flex justify-center gap-8 my-6">
          <div>
            <div className="text-3xl font-bold text-blue-600">{score}</div>
            <div className="text-sm text-slate-500">正确</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-400">{total - score}</div>
            <div className="text-sm text-slate-500">错误</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-emerald-600">{accuracy}%</div>
            <div className="text-sm text-slate-500">准确率</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <a
            href="/dashboard"
            className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
          >
            返回首页
          </a>
          <button
            onClick={() => { reset(); window.history.back(); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
          >
            再来一组
          </button>
        </div>
      </div>
    </div>
  );
}

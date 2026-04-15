/**
 * QuizRenderer — renders quiz questions and handles submissions.
 * Adapted from OpenMAIC quiz-renderer.
 */

import { useState, useCallback, useMemo } from "react";
import { MarkdownContent } from "./MarkdownContent";
import type { QuizQuestion } from "../types/stage";

interface QuizRendererProps {
  sessionId: string;
  stepIndex: number;
  questions: QuizQuestion[];
  mode?: "session" | "course";
  onComplete: () => void;
}

/**
 * Normalize quiz option to { key, text } regardless of data format.
 *
 * Old format: { label: "A", value: "早晨的梦" }  → key="A", text="早晨的梦"
 * New format: { value: "A", label: "早晨的梦" }  → key="A", text="早晨的梦"
 */
function normalizeOption(opt: any, index: number): { key: string; text: string } {
  const letter = String.fromCharCode(65 + index);
  // If value is a single uppercase letter → new format (value=key, label=text)
  if (typeof opt.value === "string" && /^[A-Z]$/.test(opt.value)) {
    return { key: opt.value, text: opt.label || opt.value };
  }
  // If label is a single uppercase letter → old format (label=key, value=text)
  if (typeof opt.label === "string" && /^[A-Z]$/.test(opt.label)) {
    return { key: opt.label, text: opt.value || opt.label };
  }
  // Fallback: generate letter, use value or label as text
  return { key: letter, text: opt.value || opt.label || letter };
}

export function QuizRenderer({ sessionId, stepIndex, questions, mode = "session", onComplete }: QuizRendererProps) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; index: number }[]>([]);

  // Pre-normalize all options for consistent key/text access
  const normalizedQuestions = useMemo(() =>
    questions.map((q) => ({
      ...q,
      _options: q.options?.map((opt, i) => normalizeOption(opt, i)) || [],
    })),
    [questions],
  );

  const handleSelect = (qIndex: number, key: string, isMultiple: boolean) => {
    setAnswers((prev) => {
      const current = prev[qIndex] || [];
      if (isMultiple) {
        if (current.includes(key)) {
          return { ...prev, [qIndex]: current.filter((v) => v !== key) };
        }
        return { ...prev, [qIndex]: [...current, key] };
      }
      return { ...prev, [qIndex]: [key] };
    });
  };

  const handleTextAnswer = (qIndex: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: [text] }));
  };

  const handleSubmit = useCallback(async () => {
    const quizResults = normalizedQuestions.map((q, i: number) => {
      const studentAnswer = answers[i] || [];
      // Normalize answer keys for comparison (handle both "0" index and "A" letter formats)
      const correctAnswer = (q.answer || []).map((a: string) => {
        // If answer is a numeric string, convert to letter
        if (/^\d+$/.test(a)) return String.fromCharCode(65 + parseInt(a, 10));
        return a;
      });
      const correct = correctAnswer.length > 0
        ? JSON.stringify(studentAnswer.sort()) === JSON.stringify([...correctAnswer].sort())
        : false;
      return { questionIndex: i, studentAnswer: studentAnswer.join(","), correct };
    });

    const score = quizResults.filter((r) => r.correct).length;
    const result = {
      stepIndex,
      answers: quizResults,
      score,
      total: questions.length,
      submittedAt: Date.now(),
    };

    setResults(quizResults.map((r, i) => ({ correct: r.correct, index: i })));
    setSubmitted(true);

    // POST to server
    const quizPath = mode === "course"
      ? `/api/course/${sessionId}/quiz-submit`
      : `/api/session/${sessionId}/quiz-submit`;
    await fetch(quizPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex, result }),
    });

    // Auto-complete step after showing results
    setTimeout(onComplete, 3000);
  }, [answers, mode, normalizedQuestions, onComplete, questions.length, sessionId, stepIndex]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      {normalizedQuestions.map((q, qIndex: number) => {
        // Normalize correct answers for display comparison
        const correctKeys = (q.answer || []).map((a: string) =>
          /^\d+$/.test(a) ? String.fromCharCode(65 + parseInt(a, 10)) : a
        );

        return (
          <div
            key={q.id || qIndex}
            className={`quiz-card p-5 md:p-6 ${
              submitted
                ? results.find((r) => r.index === qIndex)?.correct
                  ? "border-emerald-300/70 bg-emerald-100/80"
                  : "border-red-300 bg-red-50"
                : "border-white/60 bg-white/88"
            }`}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300/70 bg-slate-950 text-xs font-semibold text-white">
                {qIndex + 1}
              </div>
              <MarkdownContent
                content={q.question}
                className="markdown-content flex-1 text-base font-semibold text-slate-900"
              />
            </div>

            {q.type === "short_answer" ? (
              <textarea
                className="min-h-32 w-full rounded-[1.25rem] border border-slate-300/70 bg-white/90 p-4 text-sm text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                rows={3}
                value={answers[qIndex]?.[0] || ""}
                onChange={(e) => handleTextAnswer(qIndex, e.target.value)}
                disabled={submitted}
                placeholder="输入你的答案..."
              />
            ) : (
              <div className="space-y-2">
                {q._options.map((opt: { key: string; text: string }) => {
                  const selected = (answers[qIndex] || []).includes(opt.key);
                  const isCorrect = submitted && correctKeys.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelect(qIndex, opt.key, q.type === "multiple")}
                      disabled={submitted}
                      className={`flex w-full items-start gap-3 rounded-[1.25rem] border px-4 py-3 text-left text-sm transition duration-200 ${
                        submitted
                          ? isCorrect
                            ? "border-emerald-400 bg-emerald-100"
                            : selected
                              ? "border-red-400 bg-red-100"
                              : "border-slate-200/70 bg-white/70"
                          : selected
                            ? "border-amber-500 bg-amber-50 shadow-[0_12px_30px_rgba(217,119,6,0.12)]"
                            : "border-slate-200/70 bg-white/80 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        submitted
                          ? isCorrect
                            ? "border-green-500 bg-green-500 text-white"
                            : selected
                              ? "border-red-400 bg-red-400 text-white"
                              : "border-slate-300"
                          : selected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300"
                      }`}>
                        {opt.key}
                      </span>
                      <MarkdownContent
                        content={opt.text}
                        className="markdown-content flex-1 pt-0.5 text-sm font-medium text-slate-700"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {submitted && q.analysis && (
              <MarkdownContent
                content={q.analysis}
                className="markdown-content mt-4 rounded-[1.25rem] border border-sky-200/80 bg-sky-50/90 p-4 text-sm text-sky-900"
              />
            )}
          </div>
        );
      })}

      {!submitted && (
        <button
          onClick={handleSubmit}
          className="w-full rounded-[1.4rem] bg-slate-950 py-3.5 font-semibold tracking-[0.18em] text-white transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
        >
          提交答案
        </button>
      )}

      {submitted && (
        <div className="text-center text-sm font-medium text-slate-500">
          答对 {results.filter((r) => r.correct).length}/{questions.length} 题，3秒后继续...
        </div>
      )}
    </div>
  );
}

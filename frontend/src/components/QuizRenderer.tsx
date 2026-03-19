/**
 * QuizRenderer — renders quiz questions and handles submissions.
 * Adapted from OpenMAIC quiz-renderer.
 */

import { useState, useCallback } from "react";

interface QuizRendererProps {
  sessionId: string;
  stepIndex: number;
  questions: any[];
  onComplete: () => void;
}

export function QuizRenderer({ sessionId, stepIndex, questions, onComplete }: QuizRendererProps) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; index: number }[]>([]);

  const handleSelect = (qIndex: number, value: string, isMultiple: boolean) => {
    setAnswers((prev) => {
      const current = prev[qIndex] || [];
      if (isMultiple) {
        if (current.includes(value)) {
          return { ...prev, [qIndex]: current.filter((v) => v !== value) };
        }
        return { ...prev, [qIndex]: [...current, value] };
      }
      return { ...prev, [qIndex]: [value] };
    });
  };

  const handleTextAnswer = (qIndex: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: [text] }));
  };

  const handleSubmit = useCallback(async () => {
    const quizResults = questions.map((q, i) => {
      const studentAnswer = answers[i] || [];
      const correct = q.answer
        ? JSON.stringify(studentAnswer.sort()) === JSON.stringify([...q.answer].sort())
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
    await fetch(`/api/session/${sessionId}/quiz-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex, result }),
    });

    // Auto-complete step after showing results
    setTimeout(onComplete, 3000);
  }, [answers, questions, sessionId, stepIndex, onComplete]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {questions.map((q: any, qIndex: number) => (
        <div
          key={q.id || qIndex}
          className={`rounded-xl border p-5 ${
            submitted
              ? results.find((r) => r.index === qIndex)?.correct
                ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="mb-3 font-semibold text-slate-800">
            {qIndex + 1}. {q.question}
          </p>

          {q.type === "short_answer" ? (
            <textarea
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              value={answers[qIndex]?.[0] || ""}
              onChange={(e) => handleTextAnswer(qIndex, e.target.value)}
              disabled={submitted}
              placeholder="输入你的答案..."
            />
          ) : (
            <div className="space-y-2">
              {q.options?.map((opt: any) => {
                const selected = (answers[qIndex] || []).includes(opt.value);
                const isCorrect = submitted && q.answer?.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(qIndex, opt.value, q.type === "multiple")}
                    disabled={submitted}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      submitted
                        ? isCorrect
                          ? "border-green-400 bg-green-100"
                          : selected
                            ? "border-red-400 bg-red-100"
                            : "border-slate-200"
                        : selected
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                      selected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"
                    }`}>
                      {opt.value}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {submitted && q.analysis && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              {q.analysis}
            </div>
          )}
        </div>
      ))}

      {!submitted && (
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          提交答案
        </button>
      )}

      {submitted && (
        <div className="text-center text-sm text-slate-500">
          答对 {results.filter((r) => r.correct).length}/{questions.length} 题，3秒后继续...
        </div>
      )}
    </div>
  );
}

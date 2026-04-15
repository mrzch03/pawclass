import { useState } from "react";
import type { Exercise, SubmitResult } from "../../types/learning";

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  total: number;
  result?: SubmitResult;
  onSubmit: (answer: string) => void;
  onNext: () => void;
}

export function ExerciseCard({ exercise, index, total, result, onSubmit, onNext }: ExerciseCardProps) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const isChoice = exercise.type === "single_choice" || exercise.type === "multiple_choice";
  const submitted = !!result;

  function handleSubmit() {
    const finalAnswer = isChoice ? selectedOption || "" : answer;
    if (!finalAnswer.trim()) return;
    onSubmit(finalAnswer);
  }

  function handleNext() {
    setAnswer("");
    setSelectedOption(null);
    onNext();
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-slate-500 shrink-0">{index + 1}/{total}</span>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 mb-4">
        {exercise.concepts.map((c) => (
          <span key={c} className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">{c}</span>
        ))}
        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
          难度 {"●".repeat(exercise.difficulty)}{"○".repeat(5 - exercise.difficulty)}
        </span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
        <p className="text-lg font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
          {exercise.question}
        </p>
      </div>

      {/* Answer input */}
      {!submitted && (
        <div className="mb-4">
          {isChoice && exercise.options ? (
            <div className="space-y-2">
              {exercise.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const selected = selectedOption === letter;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(letter)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      selected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className="font-semibold mr-2">{letter}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="输入答案..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-lg"
              autoFocus
            />
          )}
        </div>
      )}

      {/* Result feedback */}
      {submitted && (
        <div className={`rounded-2xl p-5 mb-4 ${result.correct ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xl ${result.correct ? "text-emerald-500" : "text-red-500"}`}>
              {result.correct ? "✓" : "✗"}
            </span>
            <span className={`font-semibold ${result.correct ? "text-emerald-700" : "text-red-700"}`}>
              {result.correct ? "正确!" : "错误"}
            </span>
          </div>
          <p className="text-sm text-slate-700 mb-1">
            <span className="font-medium">正确答案: </span>{result.correctAnswer}
          </p>
          {result.explanation && (
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{result.explanation}</p>
          )}
        </div>
      )}

      {/* Action button */}
      <div className="flex justify-end">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={isChoice ? !selectedOption : !answer.trim()}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            提交
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            {index < total - 1 ? "下一题" : "完成"}
          </button>
        )}
      </div>
    </div>
  );
}

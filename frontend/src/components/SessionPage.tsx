/**
 * SessionPage — main teaching session page.
 *
 * Layout:
 *   ProgressBar (step N / M)
 *   SceneRenderer
 *     ├ ScreenCanvas (slide)
 *     ├ WhiteboardOverlay
 *     ├ QuizRenderer
 *     └ InteractiveRenderer
 *   BottomBar [不懂] [跳过] [退出]
 */

import { usePlaybackStore } from "../store/playback-store";
import { useStageStore } from "../store/stage-store";
import { usePlayback } from "../hooks/usePlayback";
import { ScreenCanvas } from "./ScreenCanvas";
import { WhiteboardOverlay } from "./WhiteboardOverlay";
import { QuizRenderer } from "./QuizRenderer";
import { InteractiveRenderer } from "./InteractiveRenderer";

interface SessionPageProps {
  sessionId: string;
  mode?: "session" | "course";
}

export function SessionPage({ sessionId, mode = "session" }: SessionPageProps) {
  const status = usePlaybackStore((s) => s.status);
  const currentStep = usePlaybackStore((s) => s.currentStepIndex);
  const totalSteps = usePlaybackStore((s) => s.totalSteps);
  const generatingProgress = usePlaybackStore((s) => s.generatingProgress);
  const generatingMessage = usePlaybackStore((s) => s.generatingMessage);
  const currentScene = useStageStore((s) => s.currentScene);
  const scenes = useStageStore((s) => s.scenes);
  const { requestHelp, exitSession } = usePlayback(sessionId, mode);

  // Course draft state — building indicator with live scene count
  if (mode === "course" && (status === "idle" || status as string === "draft")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <div className="h-8 w-8 animate-pulse rounded-full bg-blue-500" />
        </div>
        <p className="text-lg font-semibold text-slate-700">
          课程构建中...
        </p>
        <p className="text-sm text-slate-500">
          已添加 {scenes.length} 个场景
        </p>
        {scenes.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {scenes.map((s: any, i: number) => (
              <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                {i + 1}. {s.title || s.type}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generating state (session mode)
  if (status === "idle" || status === "generating") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-lg font-semibold text-slate-700">
          {status === "idle" ? "准备中..." : "正在生成教学内容..."}
        </p>
        {status === "generating" && (
          <>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${generatingProgress}%` }}
              />
            </div>
            <p className="text-sm text-slate-500">{generatingMessage}</p>
          </>
        )}
      </div>
    );
  }

  // Completed/ended state
  if (status === "completed" || status === "ended") {
    const handleReplay = async () => {
      const base = mode === "course" ? `/api/course/${sessionId}/replay` : "";
      if (!base) return;
      await fetch(base, { method: "POST" });
      window.location.reload();
    };

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50">
        <span className="text-5xl">🎉</span>
        <p className="text-xl font-bold text-slate-800">教学完成！</p>
        <p className="text-sm text-slate-500">
          共完成 {totalSteps} 个步骤
        </p>
        {mode === "course" && (
          <button
            onClick={handleReplay}
            className="mt-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            重新开始
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Progress bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              步骤 {currentStep + 1} / {totalSteps}
            </span>
            {currentScene && (
              <span className="text-xs text-slate-400">— {currentScene.title}</span>
            )}
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: totalSteps > 0 ? `${((currentStep + 1) / totalSteps) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            status === "playing"
              ? "bg-green-100 text-green-700"
              : status === "paused"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {status === "playing" ? "播放中" : status === "paused" ? "已暂停" : status}
        </span>
      </div>

      {/* Scene renderer */}
      <div className="relative flex-1 overflow-hidden">
        {currentScene?.type === "slide" && currentScene.content?.canvas && (
          <div className="flex h-full items-center justify-center p-4">
            <ScreenCanvas slide={currentScene.content.canvas} width={800} />
            <WhiteboardOverlay />
          </div>
        )}

        {currentScene?.type === "quiz" && currentScene.content?.questions && (
          <div className="h-full overflow-y-auto">
            <QuizRenderer
              sessionId={sessionId}
              stepIndex={currentStep}
              questions={currentScene.content.questions}
              onComplete={() => {
                fetch(`/api/session/${sessionId}/step-complete`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ stepIndex: currentStep }),
                });
              }}
            />
          </div>
        )}

        {currentScene?.type === "interactive" && (
          <div className="h-full">
            <InteractiveRenderer
              html={currentScene.content?.html}
              url={currentScene.content?.url}
            />
          </div>
        )}

        {!currentScene && (
          <div className="flex h-full items-center justify-center text-slate-400">
            等待播放...
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
        <button
          onClick={requestHelp}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <span className="text-base">❓</span>
          不懂
        </button>
        <button
          onClick={() => {
            const base = mode === "course"
              ? `/api/course/${sessionId}/step-complete`
              : `/api/session/${sessionId}/step-complete`;
            fetch(base, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stepIndex: currentStep }),
            });
          }}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <span className="text-base">⏭️</span>
          跳过
        </button>
        <button
          onClick={exitSession}
          className="flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <span className="text-base">🚪</span>
          退出
        </button>
      </div>
    </div>
  );
}

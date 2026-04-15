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
import { MarkdownContent } from "./MarkdownContent";
import type { Scene } from "../types/stage";

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
  const speechText = usePlaybackStore((s) => s.speechText);
  const currentScene = useStageStore((s) => s.currentScene);
  const scenes = useStageStore((s) => s.scenes);
  const { requestHelp, exitSession } = usePlayback(sessionId, mode);
  const typedCurrentScene = currentScene as Scene | null;

  const getStepCompletePath = () =>
    mode === "course"
      ? `/api/course/${sessionId}/step-complete`
      : `/api/session/${sessionId}/step-complete`;

  const submitStepComplete = async () => {
    await fetch(getStepCompletePath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: currentStep }),
    });
  };

  const handleReplay = async () => {
    if (mode !== "course") return;
    await fetch(`/api/course/${sessionId}/replay`, { method: "POST" });
    window.location.reload();
  };

  // Course draft state — building indicator with live scene count
  if (mode === "course" && (status === "idle" || status === "draft")) {
    return (
      <div className="stage-shell flex h-full flex-col items-center justify-center px-6 py-10">
        <div className="stage-orb flex h-20 w-20 items-center justify-center rounded-full">
          <div className="h-9 w-9 animate-pulse rounded-full bg-amber-500/90" />
        </div>
        <p className="font-display text-2xl text-slate-900">
          课程构建中...
        </p>
        <p className="max-w-md text-center text-sm text-slate-600">
          已添加 {scenes.length} 个场景
        </p>
        {scenes.length > 0 && (
          <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
            {scenes.map((s, i: number) => (
              <span key={i} className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur">
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
      <div className="stage-shell flex h-full flex-col items-center justify-center gap-4 px-6 py-10">
        <div className="stage-spinner" />
        <p className="font-display text-2xl text-slate-900">
          {status === "idle" ? "准备中..." : "正在生成教学内容..."}
        </p>
        {status === "generating" && (
          <>
            <div className="h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all duration-500"
                style={{ width: `${generatingProgress}%` }}
              />
            </div>
            <p className="max-w-md text-center text-sm text-slate-600">{generatingMessage}</p>
          </>
        )}
      </div>
    );
  }

  // Completed/ended state
  if (status === "completed" || status === "ended") {
    return (
      <div className="stage-shell flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="rounded-full border border-amber-300/70 bg-amber-50/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          Session Complete
        </div>
        <p className="font-display text-3xl text-slate-900">教学完成</p>
        <p className="text-sm text-slate-600">
          共完成 {totalSteps} 个步骤
        </p>
        {mode === "course" && (
          <button
            onClick={handleReplay}
            className="mt-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
          >
            重新开始
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="stage-shell flex h-full flex-col">
      {/* Progress bar */}
      <div className="border-b border-white/60 bg-white/72 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Live Lesson
              </span>
              <span className="text-xs font-semibold text-slate-500">
              步骤 {currentStep + 1} / {totalSteps}
              </span>
              {typedCurrentScene?.title && (
                <span className="truncate text-sm text-slate-700">{typedCurrentScene.title}</span>
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-slate-950 via-amber-600 to-rose-500 transition-all duration-300"
                style={{ width: totalSteps > 0 ? `${((currentStep + 1) / totalSteps) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            status === "playing"
              ? "bg-emerald-100 text-emerald-700"
              : status === "paused"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {status === "playing" ? "播放中"
              : status === "paused" ? "已暂停"
              : status === "ready" || status === "finalized" ? "就绪"
              : status === "completed" ? "已完成"
              : status === "ended" ? "已结束"
              : status}
          </span>
        </div>
      </div>

      {/* Scene renderer */}
      <div className="relative flex-1 overflow-hidden px-3 py-3 md:px-6 md:py-5">
        <div className="stage-panel relative h-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          {typedCurrentScene?.type === "slide" && typedCurrentScene.content?.canvas && (
            <div className="flex h-full items-center justify-center p-4 md:p-8">
              <ScreenCanvas slide={typedCurrentScene.content.canvas} width={800} />
              <WhiteboardOverlay />
            </div>
          )}

          {typedCurrentScene?.type === "quiz" && typedCurrentScene.content?.questions && (
            <div className="h-full overflow-y-auto">
              <QuizRenderer
                sessionId={sessionId}
                stepIndex={currentStep}
                questions={typedCurrentScene.content.questions}
                mode={mode}
                onComplete={submitStepComplete}
              />
            </div>
          )}

          {typedCurrentScene?.type === "interactive" && (
            <div className="h-full">
              <InteractiveRenderer
                html={typedCurrentScene.content?.html}
                url={typedCurrentScene.content?.url}
              />
            </div>
          )}

          {!typedCurrentScene && (
            <div className="flex h-full items-center justify-center text-slate-400">
              等待播放...
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/6 to-transparent" />
        </div>
      </div>

      {/* Narration subtitle bar */}
      {speechText && (
        <div className="border-t border-white/60 bg-slate-950/86 px-4 py-3 md:px-6">
          <MarkdownContent
            content={speechText}
            className="markdown-content mx-auto max-w-4xl text-center text-sm leading-relaxed text-white/92"
          />
        </div>
      )}

      {/* Bottom action bar */}
      <div className="border-t border-white/60 bg-white/72 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <button
            onClick={requestHelp}
            className="stage-action-button"
          >
            <span className="text-base">❓</span>
            不懂
          </button>
          <button
            onClick={submitStepComplete}
            className="stage-action-button"
          >
            <span className="text-base">⏭️</span>
            跳过
          </button>
          <button
            onClick={exitSession}
            className="stage-action-button border-red-200/80 text-red-600 hover:bg-red-50/90"
          >
            <span className="text-base">🚪</span>
            退出
          </button>
        </div>
      </div>
    </div>
  );
}

import { SessionPage } from "./components/SessionPage";

declare global {
  interface Window {
    __STAGE_SESSION_ID__?: string;
    __STAGE_MODE__?: "session" | "course";
  }
}

export default function App() {
  // Session/Course ID from URL or injected global
  const sessionId =
    window.__STAGE_SESSION_ID__ ||
    window.location.pathname.match(/\/(?:session|course)\/(.+)/)?.[1] ||
    null;

  // Detect mode from global or URL path
  const mode: "session" | "course" =
    window.__STAGE_MODE__ ||
    (window.location.pathname.startsWith("/course/") ? "course" : "session");

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">ClawBox Stage</h1>
          <p className="mt-2 text-slate-500">No session ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <SessionPage sessionId={sessionId} mode={mode} />
    </div>
  );
}

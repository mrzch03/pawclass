import { SessionPage } from "./components/SessionPage";

declare global {
  interface Window {
    __STAGE_SESSION_ID__?: string;
  }
}

export default function App() {
  // Session ID from URL or injected global
  const sessionId =
    window.__STAGE_SESSION_ID__ ||
    window.location.pathname.match(/\/session\/(.+)/)?.[1] ||
    null;

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
      <SessionPage sessionId={sessionId} />
    </div>
  );
}

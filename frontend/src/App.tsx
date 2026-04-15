import { SessionPage } from "./components/SessionPage";
import { PracticePage } from "./pages/PracticePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ConceptsPage } from "./pages/ConceptsPage";
import { PlanPage } from "./pages/PlanPage";
import { LoginPage } from "./pages/LoginPage";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { StudentDetail } from "./pages/StudentDetail";
import { isLoggedIn } from "./lib/auth";

declare global {
  interface Window {
    __STAGE_SESSION_ID__?: string;
    __STAGE_MODE__?: "session" | "course";
  }
}

export default function App() {
  const path = window.location.pathname;

  // All app routes require login
  const appRoutes = ["/dashboard", "/learn", "/concepts", "/plan", "/teacher"];
  const isPractice = path.match(/\/practice\/(.+)/);
  const isAppRoute = appRoutes.some((r) => path === r || path.startsWith(r + "/")) || isPractice;

  if (isAppRoute && !isLoggedIn()) {
    return <LoginPage />;
  }

  // Teacher routes — check role
  if (path === "/teacher") {
    const role = localStorage.getItem("pawclass_role");
    if (role !== "teacher") {
      // Wrong role, clear and re-login
      localStorage.removeItem("pawclass_token");
      localStorage.removeItem("pawclass_user");
      localStorage.removeItem("pawclass_role");
      return <LoginPage />;
    }
    return <TeacherDashboard />;
  }
  const studentMatch = path.match(/\/teacher\/student\/(.+)/);
  if (studentMatch) {
    return <StudentDetail studentId={studentMatch[1]} />;
  }

  // Student routes
  if (path === "/dashboard" || path === "/learn") {
    return <DashboardPage />;
  }
  if (path === "/concepts" || path.startsWith("/concepts/")) {
    return <ConceptsPage />;
  }
  if (path === "/plan") {
    return <PlanPage />;
  }
  if (isPractice) {
    return <PracticePage sessionId={isPractice[1]} />;
  }

  // Existing course/session playback
  const sessionId =
    window.__STAGE_SESSION_ID__ ||
    path.match(/\/(?:session|course)\/(.+)/)?.[1] ||
    null;

  const mode: "session" | "course" =
    window.__STAGE_MODE__ ||
    (path.startsWith("/course/") ? "course" : "session");

  if (!sessionId) {
    return (
      <div className="stage-shell flex h-screen items-center justify-center px-6">
        <div className="stage-panel max-w-md rounded-[2rem] px-8 py-10 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">PawClass</p>
          <h1 className="font-display text-3xl text-slate-900">学习系统</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            通过课件或练习路由打开页面。
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              进入学习中心
            </a>
          </div>
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

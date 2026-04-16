import { SessionPage } from "./components/SessionPage";
import { PracticePage } from "./pages/PracticePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ConceptsPage } from "./pages/ConceptsPage";
import { PlanPage } from "./pages/PlanPage";
import { LoginPage } from "./pages/LoginPage";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { StudentDetail } from "./pages/StudentDetail";
import { LandingPage } from "./pages/LandingPage";
import { isLoggedIn } from "./lib/auth";
import { useClerkAuth } from "./hooks/useClerkAuth";

declare global {
  interface Window {
    __STAGE_SESSION_ID__?: string;
    __STAGE_MODE__?: "session" | "course";
  }
}

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  return HAS_CLERK ? <ClerkApp /> : <LocalApp />;
}

/** Clerk-authenticated app (production) */
function ClerkApp() {
  const { isSignedIn, isLoaded, tokenReady } = useClerkAuth();

  if (!isLoaded || (isSignedIn && !tokenReady)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Course/session playback is always public
  const path = window.location.pathname;
  if (path.startsWith("/course/") || path.startsWith("/session/")) {
    return <PlaybackRoute />;
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  return <Router />;
}

/** Local dev app (no Clerk) */
function LocalApp() {
  const path = window.location.pathname;

  if (path.startsWith("/course/") || path.startsWith("/session/")) {
    return <PlaybackRoute />;
  }
  if (path === "/dev-login") return <LoginPage />;

  const protectedRoutes = ["/dashboard", "/learn", "/concepts", "/plan", "/teacher", "/practice"];
  if (protectedRoutes.some(r => path === r || path.startsWith(r + "/")) && !isLoggedIn()) {
    return <LoginPage />;
  }

  return <Router />;
}

/** Main router — all paths after auth check */
function Router() {
  const path = window.location.pathname;

  if (path === "/") {
    window.location.href = "/dashboard";
    return null;
  }

  // Teacher
  if (path === "/teacher") return <TeacherDashboard />;
  const studentMatch = path.match(/\/teacher\/student\/(.+)/);
  if (studentMatch) return <StudentDetail studentId={studentMatch[1]} />;

  // Student
  if (path === "/dashboard" || path === "/learn") return <DashboardPage />;
  if (path === "/concepts" || path.startsWith("/concepts/")) return <ConceptsPage />;
  if (path === "/plan") return <PlanPage />;

  const practiceMatch = path.match(/\/practice\/(.+)/);
  if (practiceMatch) return <PracticePage sessionId={practiceMatch[1]} />;

  // Playback
  if (path.startsWith("/course/") || path.startsWith("/session/")) return <PlaybackRoute />;

  // Dev login
  if (path === "/dev-login") return <LoginPage />;

  // Fallback
  window.location.href = "/dashboard";
  return null;
}

/** Course/session playback (always public) */
function PlaybackRoute() {
  const path = window.location.pathname;
  const sessionId =
    window.__STAGE_SESSION_ID__ ||
    path.match(/\/(?:session|course)\/(.+)/)?.[1] ||
    null;

  if (!sessionId) return null;

  const mode: "session" | "course" =
    window.__STAGE_MODE__ || (path.startsWith("/course/") ? "course" : "session");

  return (
    <div className="h-screen w-screen overflow-hidden">
      <SessionPage sessionId={sessionId} mode={mode} />
    </div>
  );
}

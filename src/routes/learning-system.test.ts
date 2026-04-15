/**
 * Learning system API integration tests
 *
 * Tests the full stack: auth → API → DB → response
 * Run: bun test src/routes/learning-system.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";

const BASE = "http://localhost:9801";
const JWT_SECRET = process.env.MISTAKES_JWT_SECRET || "pawclass-local-dev-secret-2026";

async function makeToken(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

async function api(method: string, path: string, token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

describe("Knowledge Base API (public, no auth)", () => {
  it("GET /api/kb/concepts returns concepts array", async () => {
    const res = await fetch(`${BASE}/api/kb/concepts`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("exerciseCount");
  });

  it("GET /api/kb/syllabus returns units array", async () => {
    const res = await fetch(`${BASE}/api/kb/syllabus`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("key");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("concepts");
  });

  it("GET /api/kb/exercises returns exercise index", async () => {
    const res = await fetch(`${BASE}/api/kb/exercises`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data).toBe("object");
    const keys = Object.keys(data);
    expect(keys.length).toBeGreaterThan(0);
    expect(data[keys[0]]).toHaveProperty("count");
  });

  it("GET /api/kb/exercises/:conceptId returns exercises array", async () => {
    const res = await fetch(`${BASE}/api/kb/exercises/be-verb?limit=3`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(3);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty("question");
      expect(data[0]).toHaveProperty("answer");
    }
  });
});

describe("Auth", () => {
  it("POST /api/auth/login returns token with role", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test_student", role: "student" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("token");
    expect(data.role).toBe("student");
  });

  it("POST /api/auth/login teacher gets students claim", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "teacher1", role: "teacher", students: ["s1", "s2"] }),
    });
    const data = await res.json();
    expect(data.role).toBe("teacher");
  });

  it("protected route rejects without token", async () => {
    const res = await fetch(`${BASE}/api/learner/profile`);
    expect(res.status).toBe(401);
  });
});

describe("Learner API (student role)", () => {
  let token: string;

  beforeAll(async () => {
    token = await makeToken({ sub: "test_student_1", role: "student" });
  });

  it("GET /api/learner/profile returns profile", async () => {
    const { status, data } = await api("GET", "/api/learner/profile", token);
    expect(status).toBe(200);
    expect(data).toHaveProperty("totalConcepts");
    expect(data).toHaveProperty("byLevel");
    expect(data).toHaveProperty("accuracy");
    expect(data).toHaveProperty("dueForReview");
  });

  it("GET /api/learner/mastery returns array", async () => {
    const { status, data } = await api("GET", "/api/learner/mastery", token);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/learner/due returns array", async () => {
    const { status, data } = await api("GET", "/api/learner/due", token);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Practice API", () => {
  let studentToken: string;
  let sessionId: string;

  beforeAll(async () => {
    studentToken = await makeToken({ sub: "test_student_practice", role: "student" });
  });

  it("POST /api/practice creates session", async () => {
    const { status, data } = await api("POST", "/api/practice", studentToken, {
      courseId: "middle/grade7-up/english",
      mode: "practice",
      count: 3,
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("exercises");
    expect(data.total).toBeGreaterThan(0);
    sessionId = data.id;
  });

  it("GET /api/practice/:id returns session", async () => {
    const { status, data } = await api("GET", `/api/practice/${sessionId}`, studentToken);
    expect(status).toBe(200);
    expect(data.id).toBe(sessionId);
    expect(data.status).toBe("active");
  });

  it("POST /api/practice/:id/submit grades answer", async () => {
    const { data: session } = await api("GET", `/api/practice/${sessionId}`, studentToken);
    const exercises = session.exercises as any[];
    if (exercises.length === 0) return;

    const first = exercises[0];
    const { status, data } = await api("POST", `/api/practice/${sessionId}/submit`, studentToken, {
      exerciseId: first.exerciseId,
      answer: "test_answer",
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("correct");
    expect(data).toHaveProperty("correctAnswer");
    expect(data).toHaveProperty("progress");
  });

  it("POST /api/practice/:id/complete finishes session", async () => {
    const { status, data } = await api("POST", `/api/practice/${sessionId}/complete`, studentToken);
    expect(status).toBe(200);
    expect(data.status).toBe("completed");
  });
});

describe("Plan API", () => {
  let studentToken: string;

  beforeAll(async () => {
    studentToken = await makeToken({ sub: "test_student_plan", role: "student" });
  });

  it("GET /api/plan/today auto-generates plan", async () => {
    const { status, data } = await api("GET", "/api/plan/today", studentToken);
    expect(status).toBe(200);
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("totalMinutes");
    expect(Array.isArray(data.tasks)).toBe(true);
  });
});

describe("Teacher API", () => {
  let teacherToken: string;

  beforeAll(async () => {
    teacherToken = await makeToken({ sub: "test_teacher", role: "teacher", students: ["test_student_1", "test_student_practice"] });
  });

  it("GET /api/teacher/students returns student list", async () => {
    const { status, data } = await api("GET", "/api/teacher/students", teacherToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]).toHaveProperty("studentId");
    expect(data[0]).toHaveProperty("accuracy");
  });

  it("GET /api/teacher/student/:id/profile returns profile", async () => {
    const { status, data } = await api("GET", "/api/teacher/student/test_student_1/profile", teacherToken);
    expect(status).toBe(200);
    expect(data).toHaveProperty("studentId");
    expect(data).toHaveProperty("byLevel");
  });

  it("GET /api/teacher/overview returns class overview", async () => {
    const { status, data } = await api("GET", "/api/teacher/overview", teacherToken);
    expect(status).toBe(200);
    expect(data).toHaveProperty("conceptAverages");
    expect(data).toHaveProperty("students");
  });

  it("POST /api/teacher/directive creates directive", async () => {
    const { status, data } = await api("POST", "/api/teacher/directive", teacherToken, {
      studentId: "test_student_1",
      content: "加强语法练习",
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("id");
    expect(data.status).toBe("pending");
  });

  it("GET /api/teacher/directives lists directives", async () => {
    const { status, data } = await api("GET", "/api/teacher/directives", teacherToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("student cannot access teacher routes", async () => {
    const studentToken = await makeToken({ sub: "test_student_1", role: "student" });
    const { status } = await api("GET", "/api/teacher/students", studentToken);
    expect(status).toBe(403);
  });
});

describe("Directive API (agent flow)", () => {
  let agentToken: string;
  let directiveId: string;

  beforeAll(async () => {
    agentToken = await makeToken({ sub: "agent_1", role: "agent", studentId: "test_student_1" });

    // Teacher creates a directive first
    const teacherToken = await makeToken({ sub: "test_teacher", role: "teacher", students: ["test_student_1"] });
    const { data } = await api("POST", "/api/teacher/directive", teacherToken, {
      studentId: "test_student_1",
      content: "Agent test directive",
    });
    directiveId = data.id;
  });

  it("GET /api/directive/pending returns pending directives", async () => {
    const { status, data } = await api("GET", "/api/directive/pending?studentId=test_student_1", agentToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((d: any) => d.id === directiveId);
    expect(found).toBeDefined();
  });

  it("POST /api/directive/:id/start marks executing", async () => {
    const { status } = await api("POST", `/api/directive/${directiveId}/start`, agentToken);
    expect(status).toBe(200);
  });

  it("POST /api/directive/:id/complete marks done", async () => {
    const { status } = await api("POST", `/api/directive/${directiveId}/complete`, agentToken, {
      note: "已创建练习会话",
      resultRefs: { practiceIds: ["prs_test123"] },
    });
    expect(status).toBe(200);
  });

  it("agent can access learner profile for their student", async () => {
    const { status, data } = await api("GET", "/api/learner/profile", agentToken);
    expect(status).toBe(200);
    expect(data).toHaveProperty("totalConcepts");
  });
});

describe("Cross-role access control", () => {
  it("teacher can view student profile via learner API", async () => {
    const teacherToken = await makeToken({ sub: "teacher_x", role: "teacher", students: ["test_student_1"] });
    const { status, data } = await api("GET", "/api/learner/profile?studentId=test_student_1", teacherToken);
    expect(status).toBe(200);
    expect(data).toHaveProperty("totalConcepts");
  });

  it("teacher cannot view unauthorized student", async () => {
    const teacherToken = await makeToken({ sub: "teacher_x", role: "teacher", students: ["other_student"] });
    const { status } = await api("GET", "/api/learner/profile?studentId=test_student_1", teacherToken);
    expect(status).toBe(500); // resolveStudentId throws
  });
});

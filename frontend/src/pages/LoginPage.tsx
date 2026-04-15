import { useState } from "react";
import { setAuth } from "../lib/auth";

export function LoginPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [students, setStudents] = useState("xiaoming,xiaohong");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!name.trim()) return;
    setLoading(true);
    const body: any = { username: name.trim(), role };
    if (role === "teacher") {
      body.students = students.split(",").map(s => s.trim()).filter(Boolean);
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.token) {
      setAuth(data.token, data.userId);
      localStorage.setItem("pawclass_role", role);
      window.location.href = role === "teacher" ? "/teacher" : "/dashboard";
    }
    setLoading(false);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-96">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">P</div>
          <h1 className="text-xl font-bold text-slate-800">PawClass</h1>
          <p className="text-sm text-slate-400 mt-1">学习系统</p>
        </div>

        {/* Role selection */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setRole("student")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              role === "student" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            我是学生
          </button>
          <button
            onClick={() => setRole("teacher")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              role === "teacher" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            我是老师
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder={role === "teacher" ? "输入老师姓名" : "输入你的名字"}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-center text-lg mb-3"
          autoFocus
        />

        {role === "teacher" && (
          <input
            type="text"
            value={students}
            onChange={(e) => setStudents(e.target.value)}
            placeholder="学生列表（逗号分隔）"
            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-center text-sm mb-3 text-slate-600"
          />
        )}

        <button
          onClick={handleLogin}
          disabled={!name.trim() || loading}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "登录中..." : role === "teacher" ? "进入教师端" : "开始学习"}
        </button>
      </div>
    </div>
  );
}

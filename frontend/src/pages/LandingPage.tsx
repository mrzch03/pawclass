import { SignIn } from "@clerk/clerk-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
          <span className="font-semibold text-slate-800">PawClass</span>
        </div>
        <a
          href="https://app.teachclaw.app"
          className="text-sm text-slate-500 hover:text-blue-600"
        >
          TeachClaw 平台 →
        </a>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: intro */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold mb-6">
              <span>AI 驱动的学习系统</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-6">
              知识点精准诊断
              <br />
              <span className="text-blue-600">个性化学习路径</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
              PawClass 基于知识图谱和间隔重复算法，为每个学生定制学习计划。
              Agent 自动诊断薄弱点，智能出题，跟踪掌握进度。
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <Stat value="41" label="知识点" />
              <Stat value="1600+" label="真题库" />
              <Stat value="3" label="角色协同" />
            </div>

            <div className="flex gap-3">
              <a
                href="https://app.teachclaw.app"
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                通过 TeachClaw 登录
              </a>
              <a
                href="/dev-login"
                className="px-6 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                开发者入口
              </a>
            </div>
          </div>

          {/* Right: Clerk sign-in */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <h2 className="text-xl font-bold text-slate-800 text-center mb-6">登录</h2>
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "w-full !max-w-none",
                  card: "w-full !max-w-none bg-transparent shadow-none border-0 p-0",
                  header: "hidden",
                  footer: "hidden",
                  socialButtonsBlockButton:
                    "h-12 rounded-xl border border-slate-200 bg-white shadow-none hover:bg-slate-50",
                  socialButtonsBlockButtonText: "text-slate-700 font-semibold",
                  formFieldLabel: "text-slate-700 font-semibold",
                  formFieldInput:
                    "h-12 rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                  formButtonPrimary:
                    "h-12 rounded-xl bg-blue-600 text-white font-bold shadow-none hover:bg-blue-700",
                  dividerLine: "bg-slate-200",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-slate-50 border-t border-slate-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-12">三角色协同学习</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Feature
              icon="🎓"
              title="学生"
              desc="个性化仪表盘、间隔重复练习、每日学习计划。掌握度实时追踪。"
            />
            <Feature
              icon="🤖"
              title="AI Agent"
              desc="自动诊断薄弱知识点，制定学习计划，动态出题。全程跟踪学习进度。"
            />
            <Feature
              icon="👩‍🏫"
              title="老师"
              desc="全班学习数据看板，一句话教学指令。Agent 自动执行，结果实时反馈。"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-slate-400">
        PawClass by TeachClaw · Powered by ClawBox Agent Platform
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

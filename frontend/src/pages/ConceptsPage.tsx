import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";
import type { ConceptSummary, ConceptMastery } from "../types/learning";

import { DEFAULT_COURSE_ID as COURSE_ID, API_BASE as API } from "../lib/config";

interface SyllabusUnit {
  key: string;
  name: string;
  concepts: string[];
}

export function ConceptsPage() {
  const [units, setUnits] = useState<SyllabusUnit[]>([]);
  const [concepts, setConcepts] = useState<ConceptSummary[]>([]);
  const [masteries, setMasteries] = useState<ConceptMastery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/kb/syllabus`).then((r) => r.json()),
      fetch(`${API}/api/kb/concepts`).then((r) => r.json()),
      authFetch(`${API}/api/learner/mastery?course=${COURSE_ID}`).then((r) => r.json()).catch(() => []),
    ]).then(([u, c, m]) => {
      setUnits(u);
      setConcepts(c);
      setMasteries(m);
    });
  }, []);

  async function selectConcept(id: string) {
    setSelected(id);
    const [d, e] = await Promise.all([
      fetch(`${API}/api/kb/concepts/${id}`).then((r) => r.json()),
      fetch(`${API}/api/kb/exercises/${id}?limit=10`).then((r) => r.json()),
    ]);
    setDetail(d);
    setExercises(e);
  }

  async function startPractice(conceptId: string) {
    const res = await authFetch(`${API}/api/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: COURSE_ID, mode: "practice", concepts: [conceptId], count: 10 }),
    });
    const data = await res.json();
    if (data.id) window.location.href = `/practice/${data.id}`;
  }

  const conceptMap = new Map(concepts.map((c) => [c.id, c]));
  const masteryMap = new Map(masteries.map((m) => [m.conceptId, m]));

  const levelColors: Record<string, string> = {
    mastered: "bg-emerald-100 text-emerald-700",
    practiced: "bg-blue-100 text-blue-700",
    learning: "bg-amber-100 text-amber-700",
    new: "bg-slate-100 text-slate-500",
  };
  const levelLabels: Record<string, string> = {
    mastered: "已掌握",
    practiced: "已练习",
    learning: "学习中",
    new: "未开始",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left: Unit tree */}
      <div className="w-72 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">知识点浏览</h2>
          <p className="text-xs text-slate-400 mt-1">七年级英语上册</p>
        </div>
        <div className="p-2">
          <a href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg mb-2">
            ← 返回学习中心
          </a>
          {units.map((unit) => (
            <UnitGroup
              key={unit.key}
              unit={unit}
              conceptMap={conceptMap}
              masteryMap={masteryMap}
              levelColors={levelColors}
              selected={selected}
              onSelect={selectConcept}
            />
          ))}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!detail ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            选择左侧知识点查看详情
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{detail.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{detail.nameEn}</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const m = masteryMap.get(detail.id);
                  const level = m?.masteryLevel || "new";
                  return (
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${levelColors[level]}`}>
                      {levelLabels[level]}
                    </span>
                  );
                })()}
                <button
                  onClick={() => startPractice(detail.id)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
                >
                  练习此知识点
                </button>
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-600 mb-6">{detail.description}</p>

            {/* Rules */}
            {detail.rules?.length > 0 && (
              <Section title="规则">
                {detail.rules.map((r: string, i: number) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed">{r}</li>
                ))}
              </Section>
            )}

            {/* Common mistakes */}
            {detail.commonMistakes?.length > 0 && (
              <Section title="易错点" color="amber">
                {detail.commonMistakes.map((m: string, i: number) => (
                  <li key={i} className="text-sm text-amber-800 leading-relaxed">{m}</li>
                ))}
              </Section>
            )}

            {/* Examples */}
            {detail.exampleSentences?.length > 0 && (
              <Section title="例句" color="emerald">
                {detail.exampleSentences.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-emerald-800 leading-relaxed italic">{s}</li>
                ))}
              </Section>
            )}

            {/* Related concepts */}
            {detail.relatedConcepts?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 mb-2">关联知识点</h3>
                <div className="flex gap-2 flex-wrap">
                  {detail.relatedConcepts.map((r: string) => (
                    <button
                      key={r}
                      onClick={() => selectConcept(r)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                    >
                      {conceptMap.get(r)?.name || r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sample exercises */}
            {exercises.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-3">题目示例 ({exercises.length})</h3>
                <div className="space-y-2">
                  {exercises.map((ex: any, i: number) => (
                    <div key={`${ex.id}-${i}`} className="p-4 bg-white rounded-xl border border-slate-200">
                      <p className="text-sm font-medium text-slate-800">{ex.question}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="text-emerald-600">答案: {ex.answer}</span>
                        <span>难度 {ex.difficulty}</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">{ex.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitGroup({ unit, conceptMap, masteryMap, levelColors, selected, onSelect }: any) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg"
      >
        <span className="font-medium">{unit.name}</span>
        <span className="text-xs text-slate-400">{unit.concepts.length}</span>
      </button>
      {expanded && (
        <div className="ml-3 pl-3 border-l border-slate-200">
          {unit.concepts.map((cid: string) => {
            const c = conceptMap.get(cid);
            const m = masteryMap.get(cid);
            const level = m?.masteryLevel || "new";
            return (
              <button
                key={cid}
                onClick={() => onSelect(cid)}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg mb-0.5 transition-colors ${
                  selected === cid ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{c?.name || cid}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    level === "mastered" ? "bg-emerald-500" :
                    level === "practiced" ? "bg-blue-500" :
                    level === "learning" ? "bg-amber-400" : "bg-slate-300"
                  }`} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, color = "blue", children }: { title: string; color?: string; children: React.ReactNode }) {
  const bg = color === "amber" ? "bg-amber-50" : color === "emerald" ? "bg-emerald-50" : "bg-blue-50";
  return (
    <div className={`${bg} rounded-xl p-4 mb-4`}>
      <h3 className="text-sm font-semibold text-slate-600 mb-2">{title}</h3>
      <ul className="list-disc list-inside space-y-1">{children}</ul>
    </div>
  );
}

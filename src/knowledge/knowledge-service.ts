/**
 * KnowledgeService — 从 knowledge-base 文件系统按需读取知识库数据
 *
 * 不导入数据库，直接读文件。缓存 index.json 和 syllabus 以提高性能。
 */

import fs from "fs";
import path from "path";

// --- Types ---

export interface ConceptSummary {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  exerciseCount: number;
  relatedConcepts: string[];
}

export interface ConceptDetail extends ConceptSummary {
  rules: string[];
  commonMistakes: string[];
  exampleSentences: string[];
  content: string; // raw markdown
}

export interface Exercise {
  id: string;
  type: string;
  question: string;
  answer: string;
  explanation: string;
  concepts: string[];
  difficulty: number;
  [key: string]: unknown;
}

export interface ExerciseIndex {
  [conceptId: string]: {
    count: number;
    difficulty_range: [number, number];
    types: string[];
  };
}

export interface SyllabusUnit {
  key: string;
  name: string;
  concepts: string[];
}

export interface Asset {
  type: string;
  title: string;
  content: string;
  concepts: string[];
  usable_for: string;
  sourceFile: string;
}

// --- Service ---

export class KnowledgeService {
  private basePath: string;
  private indexCache = new Map<string, { data: ExerciseIndex; mtime: number }>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /** Resolve course path, e.g. "middle/grade7-up/english" → absolute path */
  private coursePath(courseId: string): string {
    return path.join(this.basePath, ...courseId.split("/"));
  }

  /** List available courses from registry.json */
  listCourses(): Record<string, any> {
    const registryPath = path.join(this.basePath, "registry.json");
    if (!fs.existsSync(registryPath)) return {};
    return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  }

  /** Read syllabus.md and parse into structured units */
  getSyllabus(courseId: string): SyllabusUnit[] {
    const syllabusPath = path.join(this.coursePath(courseId), "syllabus.md");
    if (!fs.existsSync(syllabusPath)) return [];

    const text = fs.readFileSync(syllabusPath, "utf-8");
    const units: SyllabusUnit[] = [];
    let currentUnit = "";
    let currentConcepts: string[] = [];

    for (const line of text.split("\n")) {
      if (line.startsWith("## ")) {
        if (currentUnit && currentConcepts.length) {
          units.push({
            key: slugify(currentUnit),
            name: currentUnit,
            concepts: [...new Set(currentConcepts)],
          });
        }
        currentUnit = line.slice(3).trim();
        currentConcepts = [];
      } else if (line.includes("`") && currentUnit) {
        const match = line.match(/`([^`]+)`/);
        if (match) currentConcepts.push(match[1]);
      }
    }
    if (currentUnit && currentConcepts.length) {
      units.push({
        key: slugify(currentUnit),
        name: currentUnit,
        concepts: [...new Set(currentConcepts)],
      });
    }
    return units;
  }

  /** List all concepts for a course */
  listConcepts(courseId: string): ConceptSummary[] {
    const conceptsDir = path.join(this.coursePath(courseId), "concepts");
    if (!fs.existsSync(conceptsDir)) return [];

    const index = this.getExerciseIndex(courseId);

    return fs
      .readdirSync(conceptsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => {
        const id = f.replace(".md", "");
        const parsed = this.parseConceptMd(
          fs.readFileSync(path.join(conceptsDir, f), "utf-8")
        );
        return {
          id,
          name: parsed.name,
          nameEn: parsed.nameEn,
          description: parsed.description,
          exerciseCount: index[id]?.count || 0,
          relatedConcepts: parsed.relatedConcepts,
        };
      });
  }

  /** Get full detail of one concept */
  getConcept(courseId: string, conceptId: string): ConceptDetail | null {
    const filePath = path.join(this.coursePath(courseId), "concepts", `${conceptId}.md`);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = this.parseConceptMd(content);
    const index = this.getExerciseIndex(courseId);

    return {
      id: conceptId,
      content,
      exerciseCount: index[conceptId]?.count || 0,
      ...parsed,
    };
  }

  /** Get exercise index (cached, invalidated on file change) */
  getExerciseIndex(courseId: string): ExerciseIndex {
    const indexPath = path.join(this.coursePath(courseId), "exercises", "index.json");
    if (!fs.existsSync(indexPath)) return {};

    const stat = fs.statSync(indexPath);
    const cached = this.indexCache.get(courseId);
    if (cached && cached.mtime === stat.mtimeMs) return cached.data;

    const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    this.indexCache.set(courseId, { data, mtime: stat.mtimeMs });
    return data;
  }

  /** Get all exercises for a concept */
  getExercises(
    courseId: string,
    conceptId: string,
    opts?: { difficulty?: number; type?: string; limit?: number }
  ): Exercise[] {
    const dir = path.join(this.coursePath(courseId), "exercises", conceptId);
    if (!fs.existsSync(dir)) return [];

    let exercises: Exercise[] = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));

    if (opts?.difficulty) {
      exercises = exercises.filter((e) => e.difficulty === opts.difficulty);
    }
    if (opts?.type) {
      exercises = exercises.filter((e) => e.type === opts.type);
    }
    if (opts?.limit) {
      exercises = exercises.slice(0, opts.limit);
    }
    return exercises;
  }

  /** Sample random exercises from multiple concepts */
  sampleExercises(
    courseId: string,
    opts: { concepts: string[]; count: number; difficulty?: number; exclude?: string[] }
  ): Exercise[] {
    const all: Exercise[] = [];
    const excludeSet = new Set(opts.exclude || []);

    for (const conceptId of opts.concepts) {
      const exercises = this.getExercises(courseId, conceptId, {
        difficulty: opts.difficulty,
      });
      for (const ex of exercises) {
        if (!excludeSet.has(ex.id)) all.push(ex);
      }
    }

    // Shuffle and pick
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, opts.count);
  }

  /** Get teaching assets for a unit */
  getAssets(courseId: string, unit?: string): Asset[] {
    const assetsDir = path.join(this.coursePath(courseId), "assets");
    if (!fs.existsSync(assetsDir)) return [];

    const results: Asset[] = [];
    const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      if (unit && !file.includes(slugify(unit))) continue;
      const items = JSON.parse(fs.readFileSync(path.join(assetsDir, file), "utf-8"));
      for (const item of items) {
        item.sourceFile = file;
        results.push(item);
      }
    }
    return results;
  }

  // --- Helpers ---

  private parseConceptMd(text: string) {
    let name = "";
    let nameEn = "";
    let description = "";
    const rules: string[] = [];
    const commonMistakes: string[] = [];
    const exampleSentences: string[] = [];
    const relatedConcepts: string[] = [];

    let section = "";
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("# ")) name = t.slice(2).trim();
      else if (t.startsWith("English:")) nameEn = t.slice(8).trim();
      else if (t.startsWith("## 描述")) section = "desc";
      else if (t.startsWith("## 规则")) section = "rules";
      else if (t.startsWith("## 易错点")) section = "mistakes";
      else if (t.startsWith("## 例句")) section = "examples";
      else if (t.startsWith("## 关联")) section = "related";
      else if (t.startsWith("## ")) section = "";
      else if (t.startsWith("- ") && section) {
        const item = t.slice(2).trim();
        if (section === "rules") rules.push(item);
        else if (section === "mistakes") commonMistakes.push(item);
        else if (section === "examples") exampleSentences.push(item);
        else if (section === "related") {
          const m = item.match(/\[(.+?)\]/);
          if (m) relatedConcepts.push(m[1]);
        }
      } else if (section === "desc" && t && !description) {
        description = t;
      }
    }
    return { name, nameEn, description, rules, commonMistakes, exampleSentences, relatedConcepts };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
}

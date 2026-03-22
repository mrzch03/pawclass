import { describe, it, expect, beforeEach } from "vitest";
import { courseStore } from "./course-store";

describe("课程存储", () => {
  let courseId: string;

  beforeEach(() => {
    // 清理所有课程
    for (const c of courseStore.list()) {
      courseStore.delete(c.id);
    }
    const course = courseStore.create("test_1", "测试课程");
    courseId = course.id;
  });

  it("应创建空课程", () => {
    const course = courseStore.get(courseId);
    expect(course).toBeDefined();
    expect(course!.title).toBe("测试课程");
    expect(course!.status).toBe("draft");
    expect(course!.scenes).toHaveLength(0);
    expect(course!.quizResults).toHaveLength(0);
  });

  it("应列出所有课程", () => {
    courseStore.create("test_2", "另一个课程");
    expect(courseStore.list()).toHaveLength(2);
  });

  it("应添加 Scene 并设置 stepIndex", () => {
    const scene1 = { id: "s1", stepIndex: -1, type: "slide" as const, title: "第一页", content: {}, actions: [] };
    const scene2 = { id: "s2", stepIndex: -1, type: "quiz" as const, title: "测验", content: {}, actions: [] };

    const idx1 = courseStore.addScene(courseId, scene1);
    const idx2 = courseStore.addScene(courseId, scene2);

    expect(idx1).toBe(0);
    expect(idx2).toBe(1);

    const course = courseStore.get(courseId)!;
    expect(course.scenes).toHaveLength(2);
    expect(course.scenes[0].stepIndex).toBe(0);
    expect(course.scenes[1].stepIndex).toBe(1);
  });

  it("应追加 Action 到最后一个 Scene", () => {
    courseStore.addScene(courseId, { id: "s1", stepIndex: 0, type: "slide" as const, title: "页1", content: {}, actions: [] });
    courseStore.addScene(courseId, { id: "s2", stepIndex: 1, type: "slide" as const, title: "页2", content: {}, actions: [] });

    const result = courseStore.addActionToLastScene(courseId, { id: "a1", type: "speech", text: "你好" });

    expect(result).toBeDefined();
    expect(result!.sceneIndex).toBe(1); // 最后一个 scene
    expect(result!.actionId).toBe("a1");

    const course = courseStore.get(courseId)!;
    expect(course.scenes[0].actions).toHaveLength(0);
    expect(course.scenes[1].actions).toHaveLength(1);
  });

  it("空课程不能追加 Action", () => {
    const result = courseStore.addActionToLastScene(courseId, { id: "a1", type: "speech" });
    expect(result).toBeUndefined();
  });

  it("应更新状态", () => {
    courseStore.updateStatus(courseId, "finalized");
    expect(courseStore.get(courseId)!.status).toBe("finalized");

    courseStore.updateStatus(courseId, "playing");
    const course = courseStore.get(courseId)!;
    expect(course.status).toBe("playing");
    expect(course.startedAt).toBeDefined();
  });

  it("应记录完成时间", () => {
    courseStore.updateStatus(courseId, "completed");
    expect(courseStore.get(courseId)!.completedAt).toBeDefined();
  });

  it("应设置当前步骤", () => {
    courseStore.setCurrentStep(courseId, 3);
    expect(courseStore.get(courseId)!.currentStepIndex).toBe(3);
  });

  it("应添加测验结果", () => {
    const result = { stepIndex: 0, answers: [], score: 3, total: 5, submittedAt: Date.now() };
    courseStore.addQuizResult(courseId, result);
    expect(courseStore.get(courseId)!.quizResults).toHaveLength(1);
    expect(courseStore.get(courseId)!.quizResults[0].score).toBe(3);
  });

  it("应删除课程", () => {
    expect(courseStore.delete(courseId)).toBe(true);
    expect(courseStore.get(courseId)).toBeUndefined();
    expect(courseStore.delete(courseId)).toBe(false);
  });

  it("不存在的课程返回 undefined", () => {
    expect(courseStore.get("nonexistent")).toBeUndefined();
    expect(courseStore.addScene("nonexistent", {} as any)).toBeUndefined();
    expect(courseStore.addActionToLastScene("nonexistent", {} as any)).toBeUndefined();
    expect(courseStore.updateStatus("nonexistent", "draft")).toBeUndefined();
    expect(courseStore.setCurrentStep("nonexistent", 0)).toBeUndefined();
    expect(courseStore.addQuizResult("nonexistent", {} as any)).toBeUndefined();
  });
});

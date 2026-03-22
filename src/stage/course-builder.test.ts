import { describe, it, expect } from "vitest";
import {
  buildSlideScene,
  buildCodeScene,
  buildQuizScene,
  buildInteractiveScene,
  buildNarrationAction,
  buildWhiteboardAction,
} from "./course-builder";

describe("幻灯片场景构建", () => {
  it("应生成 slide 类型的 Scene", () => {
    const scene = buildSlideScene({ title: "Python 入门", content: "# 特点\n- 简洁\n- 强大" });

    expect(scene.type).toBe("slide");
    expect(scene.title).toBe("Python 入门");
    expect(scene.id).toBeTruthy();
    expect(scene.actions).toEqual([]);
  });

  it("应生成含标题和内容的 Slide canvas", () => {
    const scene = buildSlideScene({ title: "测试", content: "内容文字" });
    const content = scene.content as any;

    expect(content.type).toBe("slide");
    expect(content.canvas).toBeDefined();
    expect(content.canvas.elements).toHaveLength(2);
    expect(content.canvas.elements[0].textType).toBe("title");
    expect(content.canvas.elements[1].textType).toBe("content");
    expect(content.canvas.viewportSize).toBe(1000);
    expect(content.canvas.viewportRatio).toBe(0.5625);
  });

  it("应转义 HTML 特殊字符", () => {
    const scene = buildSlideScene({ title: "<script>alert(1)</script>", content: "a & b" });
    const content = scene.content as any;
    expect(content.canvas.elements[0].content).toContain("&lt;script&gt;");
    expect(content.canvas.elements[1].content).toContain("&amp;");
  });

  it("应将 markdown 列表转为圆点", () => {
    const scene = buildSlideScene({ title: "列表", content: "- 项目1\n- 项目2\n* 项目3" });
    const content = scene.content as any;
    const html = content.canvas.elements[1].content;
    expect(html).toContain("• 项目1");
    expect(html).toContain("• 项目2");
    expect(html).toContain("• 项目3");
  });
});

describe("代码场景构建", () => {
  it("应生成代码 Scene", () => {
    const scene = buildCodeScene({ language: "python", content: "print('hello')" });

    expect(scene.type).toBe("slide");
    expect(scene.title).toBe("python 代码");
  });

  it("应使用自定义标题", () => {
    const scene = buildCodeScene({ language: "python", content: "x=1", title: "变量赋值" });
    expect(scene.title).toBe("变量赋值");
  });

  it("应使用暗色主题", () => {
    const scene = buildCodeScene({ language: "python", content: "pass" });
    const content = scene.content as any;
    expect(content.canvas.background.color).toBe("#1e1e1e");
    expect(content.canvas.theme.backgroundColor).toBe("#1e1e1e");
  });

  it("应使用等宽字体", () => {
    const scene = buildCodeScene({ language: "python", content: "pass" });
    const content = scene.content as any;
    const codeElement = content.canvas.elements[1];
    expect(codeElement.defaultFontName).toBe("Consolas");
  });
});

describe("测验场景构建", () => {
  it("应生成 quiz 类型的 Scene", () => {
    const scene = buildQuizScene({ question: "1+1=?", options: ["1", "2", "3"], answer: 1 });

    expect(scene.type).toBe("quiz");
    const content = scene.content as any;
    expect(content.type).toBe("quiz");
    expect(content.questions).toHaveLength(1);
  });

  it("应设置正确答案", () => {
    const scene = buildQuizScene({ question: "问题", options: ["A", "B", "C"], answer: 2 });
    const q = (scene.content as any).questions[0];
    expect(q.answer).toEqual(["2"]);
    expect(q.hasAnswer).toBe(true);
  });

  it("应生成 A/B/C 选项标签", () => {
    const scene = buildQuizScene({ question: "问题", options: ["选项1", "选项2", "选项3"], answer: 0 });
    const q = (scene.content as any).questions[0];
    expect(q.options[0].label).toBe("A");
    expect(q.options[1].label).toBe("B");
    expect(q.options[2].label).toBe("C");
    expect(q.options[0].value).toBe("选项1");
  });

  it("应截断过长的标题", () => {
    const longQuestion = "这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的问题你觉得呢";
    expect(longQuestion.length).toBeGreaterThan(40);
    const scene = buildQuizScene({ question: longQuestion, options: ["A"], answer: 0 });
    expect(scene.title.length).toBeLessThanOrEqual(43); // 40 + "..."
    expect(scene.title).toContain("...");
  });
});

describe("互动场景构建", () => {
  it("应生成 interactive 类型的 Scene", () => {
    const scene = buildInteractiveScene({ type: "code-editor", language: "python" });

    expect(scene.type).toBe("interactive");
    expect(scene.title).toContain("code-editor");
    expect(scene.title).toContain("python");
  });

  it("代码编辑器应生成 HTML", () => {
    const scene = buildInteractiveScene({ type: "code-editor", language: "javascript" });
    const content = scene.content as any;
    expect(content.type).toBe("interactive");
    expect(content.html).toContain("javascript");
    expect(content.html).toContain("textarea");
  });

  it("未知类型应生成占位 HTML", () => {
    const scene = buildInteractiveScene({ type: "unknown-type" });
    const content = scene.content as any;
    expect(content.html).toContain("unknown-type");
  });
});

describe("旁白 Action 构建", () => {
  it("应生成 speech 类型的 Action", () => {
    const action = buildNarrationAction({ text: "欢迎来到课堂" });

    expect(action.type).toBe("speech");
    expect(action.text).toBe("欢迎来到课堂");
    expect(action.id).toBeTruthy();
  });
});

describe("白板 Action 构建", () => {
  it("应生成文字 Action", () => {
    const action = buildWhiteboardAction({ type: "text", content: "重点", x: 100, y: 200, fontSize: 24 });

    expect(action.type).toBe("wb_draw_text");
    expect((action as any).content).toBe("重点");
    expect((action as any).x).toBe(100);
    expect((action as any).y).toBe(200);
    expect((action as any).fontSize).toBe(24);
  });

  it("应生成形状 Action", () => {
    const action = buildWhiteboardAction({ type: "shape", x: 50, y: 50, width: 200, height: 100, shape: "circle" });

    expect(action.type).toBe("wb_draw_shape");
    expect((action as any).shape).toBe("circle");
  });

  it("应生成 LaTeX Action", () => {
    const action = buildWhiteboardAction({ type: "latex", content: "E=mc^2", x: 0, y: 0 });

    expect(action.type).toBe("wb_draw_latex");
    expect((action as any).latex).toBe("E=mc^2");
  });

  it("应生成线条 Action", () => {
    const action = buildWhiteboardAction({ type: "line", x: 10, y: 20, width: 100, height: 50 });

    expect(action.type).toBe("wb_draw_line");
    expect((action as any).startX).toBe(10);
    expect((action as any).startY).toBe(20);
    expect((action as any).endX).toBe(110);
    expect((action as any).endY).toBe(70);
  });
});

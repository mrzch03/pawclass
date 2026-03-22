import { describe, it, expect } from "vitest";
import { canTransitionCourse, assertCourseTransition, canAddContent } from "./course-types";
import type { CourseStatus } from "../types";

describe("课程状态机", () => {
  const validTransitions: [CourseStatus, CourseStatus][] = [
    ["draft", "finalized"],
    ["draft", "playing"],
    ["finalized", "playing"],
    ["playing", "paused"],
    ["playing", "completed"],
    ["playing", "ended"],
    ["paused", "playing"],
    ["paused", "ended"],
    ["completed", "ended"],
  ];

  const invalidTransitions: [CourseStatus, CourseStatus][] = [
    ["draft", "paused"],
    ["draft", "completed"],
    ["draft", "ended"],
    ["finalized", "draft"],
    ["finalized", "paused"],
    ["finalized", "ended"],
    ["playing", "draft"],
    ["playing", "finalized"],
    ["paused", "draft"],
    ["paused", "finalized"],
    ["completed", "draft"],
    ["completed", "playing"],
    ["ended", "draft"],
    ["ended", "playing"],
    ["ended", "finalized"],
  ];

  for (const [from, to] of validTransitions) {
    it(`应允许 ${from} → ${to}`, () => {
      expect(canTransitionCourse(from, to)).toBe(true);
    });
  }

  for (const [from, to] of invalidTransitions) {
    it(`应禁止 ${from} → ${to}`, () => {
      expect(canTransitionCourse(from, to)).toBe(false);
    });
  }

  it("assertCourseTransition 合法转换不抛异常", () => {
    expect(() => assertCourseTransition("draft", "finalized")).not.toThrow();
  });

  it("assertCourseTransition 非法转换抛异常", () => {
    expect(() => assertCourseTransition("ended", "draft")).toThrow("Invalid course transition");
  });
});

describe("内容添加权限", () => {
  it("draft 状态可以添加内容", () => {
    expect(canAddContent("draft")).toBe(true);
  });

  it("playing 状态可以添加内容（渐进式）", () => {
    expect(canAddContent("playing")).toBe(true);
  });

  it("finalized 状态不能添加内容", () => {
    expect(canAddContent("finalized")).toBe(false);
  });

  it("paused 状态不能添加内容", () => {
    expect(canAddContent("paused")).toBe(false);
  });

  it("completed 状态不能添加内容", () => {
    expect(canAddContent("completed")).toBe(false);
  });

  it("ended 状态不能添加内容", () => {
    expect(canAddContent("ended")).toBe(false);
  });
});

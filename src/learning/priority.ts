/**
 * priority.ts — 知识点优先级评分 + 间隔复习调度
 *
 * 从 english-learning-system HTML 原型移植并简化
 */

import type { ConceptMastery } from "../db/schema";

/** 计算知识点的复习优先级分数，分数越高越需要优先练习 */
export function computePriority(mastery: ConceptMastery): number {
  let score = 0;
  const now = Date.now();

  // 错误越多，优先级越高
  score += mastery.wrongCount * 16;

  // 错误次数 >= 2，额外加分
  if (mastery.wrongCount >= 2) score += 70;

  // 已到复习时间，加分
  if (mastery.nextReviewAt) {
    const reviewTime = new Date(mastery.nextReviewAt).getTime();
    if (reviewTime <= now) {
      score += 80;
      // 逾期天数，越久越急
      const overdueDays = Math.floor((now - reviewTime) / 86400000);
      score += overdueDays * 6;
    }
  }

  // 从未练习的知识点，给一点基础分
  if (mastery.masteryLevel === "new") score += 10;

  // 连对越多，优先级越低（已掌握的不急）
  score -= mastery.streak * 4;

  return Math.max(0, score);
}

/** 根据掌握情况计算下次复习时间 */
export function computeNextReview(mastery: {
  masteryLevel: string;
  streak: number;
  isCorrect: boolean;
}): Date {
  const now = new Date();

  // 答错了：明天复习，不管当前等级
  if (!mastery.isCorrect) {
    return addDays(now, 1);
  }

  // 答对了：根据掌握等级和连对数决定间隔
  switch (mastery.masteryLevel) {
    case "new":
    case "learning":
      if (mastery.streak <= 0) return addDays(now, 1);
      if (mastery.streak === 1) return addDays(now, 2);
      return addDays(now, 3);

    case "practiced":
      if (mastery.streak <= 1) return addDays(now, 3);
      return addDays(now, 7);

    case "mastered":
      return addDays(now, 14);

    default:
      return addDays(now, 1);
  }
}

/** 根据练习结果更新掌握等级 */
export function computeMasteryLevel(mastery: {
  masteryLevel: string;
  totalAttempts: number;
  correctCount: number;
  streak: number;
}): string {
  const accuracy = mastery.totalAttempts > 0
    ? mastery.correctCount / mastery.totalAttempts
    : 0;

  // mastered: 连对 >= 3 且准确率 >= 80%
  if (mastery.streak >= 3 && accuracy >= 0.8 && mastery.totalAttempts >= 5) {
    return "mastered";
  }

  // practiced: 准确率 >= 60% 且做题 >= 5
  if (accuracy >= 0.6 && mastery.totalAttempts >= 5) {
    return "practiced";
  }

  // learning: 有过练习
  if (mastery.totalAttempts > 0) {
    return "learning";
  }

  return "new";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Action types — copied from OpenMAIC, minus discussion and play_video.
 */

export interface ActionBase {
  id: string;
  title?: string;
  description?: string;
}

export interface SpotlightAction extends ActionBase {
  type: 'spotlight';
  elementId: string;
  dimOpacity?: number;
}

export interface LaserAction extends ActionBase {
  type: 'laser';
  elementId: string;
  color?: string;
}

export interface SpeechAction extends ActionBase {
  type: 'speech';
  text: string;
  audioId?: string;
  voice?: string;
  speed?: number;
}

export interface WbOpenAction extends ActionBase {
  type: 'wb_open';
}

export interface WbDrawTextAction extends ActionBase {
  type: 'wb_draw_text';
  elementId?: string;
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
}

export interface WbDrawShapeAction extends ActionBase {
  type: 'wb_draw_shape';
  elementId?: string;
  shape: 'rectangle' | 'circle' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
}

export interface WbDrawChartAction extends ActionBase {
  type: 'wb_draw_chart';
  elementId?: string;
  chartType: 'bar' | 'column' | 'line' | 'pie' | 'ring' | 'area' | 'radar' | 'scatter';
  x: number;
  y: number;
  width: number;
  height: number;
  data: {
    labels: string[];
    legends: string[];
    series: number[][];
  };
  themeColors?: string[];
}

export interface WbDrawLatexAction extends ActionBase {
  type: 'wb_draw_latex';
  elementId?: string;
  latex: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface WbDrawTableAction extends ActionBase {
  type: 'wb_draw_table';
  elementId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: string[][];
  outline?: { width: number; style: string; color: string };
  theme?: { color: string };
}

export interface WbDrawLineAction extends ActionBase {
  type: 'wb_draw_line';
  elementId?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed';
  points?: ['', 'arrow'] | ['arrow', ''] | ['arrow', 'arrow'] | ['', ''];
}

export interface WbClearAction extends ActionBase {
  type: 'wb_clear';
}

export interface WbDeleteAction extends ActionBase {
  type: 'wb_delete';
  elementId: string;
}

export interface WbCloseAction extends ActionBase {
  type: 'wb_close';
}

export type Action =
  | SpotlightAction
  | LaserAction
  | SpeechAction
  | WbOpenAction
  | WbDrawTextAction
  | WbDrawShapeAction
  | WbDrawChartAction
  | WbDrawLatexAction
  | WbDrawTableAction
  | WbDrawLineAction
  | WbClearAction
  | WbDeleteAction
  | WbCloseAction;

export type ActionType = Action['type'];

export const FIRE_AND_FORGET_ACTIONS: ActionType[] = ['spotlight', 'laser'];
export const SLIDE_ONLY_ACTIONS: ActionType[] = ['spotlight', 'laser'];
export const SYNC_ACTIONS: ActionType[] = [
  'speech', 'wb_open', 'wb_draw_text', 'wb_draw_shape', 'wb_draw_chart',
  'wb_draw_latex', 'wb_draw_table', 'wb_draw_line', 'wb_clear', 'wb_delete', 'wb_close',
];

export interface PercentageGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

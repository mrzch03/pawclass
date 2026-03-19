/**
 * Event emitter — POSTs session events to ClawBox Backend's
 * /api/app-events endpoint for system notification delivery.
 */

import type { SessionEvent } from "../types.js";

export interface EventEmitterConfig {
  backendUrl: string;
  appSecret: string;
  agentImUserId: string;
  targetUserId?: string;
  targetGroupId?: string;
}

export function createEventEmitter(config: EventEmitterConfig) {
  const { backendUrl, appSecret, agentImUserId, targetUserId, targetGroupId } = config;

  return {
    async emit(event: SessionEvent): Promise<void> {
      const url = `${backendUrl}/api/app-events`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-App-Secret": appSecret,
          },
          body: JSON.stringify({
            appId: "clawbox-stage",
            sessionId: event.sessionId,
            agentImUserId,
            targetUserId,
            targetGroupId,
            event: event.type,
            summary: event.summary,
            data: event.data,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[event-emitter] POST failed: ${res.status} ${text}`);
        }
      } catch (e: any) {
        console.error(`[event-emitter] Network error: ${e.message}`);
      }
    },
  };
}

export type EventEmitter = ReturnType<typeof createEventEmitter>;

import webpush from "web-push";

import type { PushSubscription } from "../contracts";
import { UpstreamError } from "../lib/errors";

/**
 * Web Push: a notification on a person's device, delivered by their browser's
 * push service even with the tab closed.
 */

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap on the notification opens. */
  url: string;
  /** A notification with the same tag replaces the one before it on the device. */
  tag: string;
}

export interface PushSender {
  /** False when the push service says the subscription is gone (404 or 410), so it can be forgotten. */
  send(subscription: PushSubscription, message: PushMessage): Promise<boolean>;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  /** A mailto: or https: contact the push services may use. */
  subject: string;
}

const TTL_SECONDS = 12 * 3600;

export function webPushSender(keys: VapidKeys): PushSender {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return {
    async send(subscription, message) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(message), { TTL: TTL_SECONDS, urgency: "high" });
        return true;
      } catch (error) {
        const status = error instanceof webpush.WebPushError ? error.statusCode : 0;
        if (status === 404 || status === 410) return false;
        throw new UpstreamError(status, `the push service refused a notification (${status})`, { cause: error });
      }
    },
  };
}

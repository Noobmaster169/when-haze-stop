import type { PushSubscription } from "../../contracts";
import type { PushMessage, PushSender } from "../push";
import type { StatementChannel, StatementItem, StatementsClient } from "../statements";

/**
 * Statement channels and the push service as tests see them. The items and
 * texts handed in are recorded from the real channels; no test reaches them.
 */

export class FakeStatementsClient implements StatementsClient {
  readonly read: string[] = [];

  constructor(
    readonly channel: StatementChannel,
    private readonly items: StatementItem[],
    private readonly texts: Record<string, string> = {},
  ) {}

  async list(): Promise<StatementItem[]> {
    return this.items;
  }

  async text(item: StatementItem): Promise<string> {
    this.read.push(item.url);
    return this.texts[item.url] ?? item.title;
  }
}

export class FakePushSender implements PushSender {
  readonly sent: { endpoint: string; message: PushMessage }[] = [];

  /** Endpoints the push service says are gone. */
  constructor(private readonly gone: Set<string> = new Set()) {}

  async send(subscription: PushSubscription, message: PushMessage): Promise<boolean> {
    if (this.gone.has(subscription.endpoint)) return false;
    this.sent.push({ endpoint: subscription.endpoint, message });
    return true;
  }
}

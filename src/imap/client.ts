import { ImapFlow, type MailboxLockObject } from "imapflow";
import type { Config } from "../config.ts";

export class ImapClient {
  private client: ImapFlow;
  private connecting: Promise<void> | null = null;

  constructor(config: Config) {
    this.client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls,
      auth: {
        user: config.email,
        pass: config.appPassword,
      },
      logger: false,
    });

    this.client.on("error", () => {
      // connection state is checked via `usable` before the next use; nothing to do here
    });
    this.client.on("close", () => {
      // same as above - reconnect happens lazily on next call
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.usable) return;
    if (!this.connecting) {
      this.connecting = this.client.connect().finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
  }

  /** Runs fn with a connected client, retrying once after a reconnect on connection-class failures. */
  async withClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    await this.ensureConnected();
    try {
      return await fn(this.client);
    } catch (err) {
      if (isConnectionError(err) || !this.client.usable) {
        await this.ensureConnected();
        return await fn(this.client);
      }
      throw err;
    }
  }

  /** Opens a mailbox lock, runs fn, and always releases the lock. */
  async withMailbox<T>(
    path: string,
    fn: (client: ImapFlow, lock: MailboxLockObject) => Promise<T>
  ): Promise<T> {
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(path);
      try {
        return await fn(client, lock);
      } finally {
        lock.release();
      }
    });
  }

  async shutdown(): Promise<void> {
    if (this.client.usable) {
      await this.client.logout().catch(() => this.client.close());
    }
  }
}

function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "NoConnection" ||
    code === "ConnectionTimeout"
  );
}

import nodemailer, { type Transporter } from "nodemailer";
import type { Config } from "../config.ts";

export interface OutgoingAttachment {
  filename: string;
  content: Buffer;
}

export interface OutgoingMail {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  attachments?: OutgoingAttachment[];
}

export class SmtpClient {
  private transporter: Transporter;
  readonly fromAddress: string;

  constructor(config: Config) {
    this.fromAddress = config.email;
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpTls,
      auth: {
        user: config.email,
        pass: config.appPassword,
      },
    });
  }

  /** Sends mail. No retry - sending is non-idempotent and a retry could double-send. */
  async send(mail: OutgoingMail): Promise<string> {
    const info = await this.transporter.sendMail(mail);
    return info.messageId;
  }

  shutdown(): void {
    this.transporter.close();
  }
}

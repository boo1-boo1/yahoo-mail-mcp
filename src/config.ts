import { z } from "zod";

const envSchema = z.object({
  YAHOO_EMAIL: z.string().email(),
  YAHOO_APP_PASSWORD: z.string().min(1),
  IMAP_HOST: z.string().default("imap.mail.yahoo.com"),
  IMAP_PORT: z.coerce.number().int().default(993),
  IMAP_TLS: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
  SMTP_HOST: z.string().default("smtp.mail.yahoo.com"),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_TLS: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
});

export interface Config {
  email: string;
  appPassword: string;
  host: string;
  port: number;
  tls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
}

export function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error(
      "Set YAHOO_EMAIL and YAHOO_APP_PASSWORD (generate an App Password at Yahoo Account Security).",
    );
    process.exit(1);
  }

  const env = parsed.data;
  if (!env.IMAP_TLS) {
    console.error(
      "WARNING: IMAP_TLS=false - connecting without TLS. Credentials and mail content will be sent in plaintext.",
    );
  }
  return {
    email: env.YAHOO_EMAIL,
    appPassword: env.YAHOO_APP_PASSWORD,
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    tls: env.IMAP_TLS,
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpTls: env.SMTP_TLS,
  };
}

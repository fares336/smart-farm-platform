import nodemailer from 'nodemailer';
import { config } from '../config.js';

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!config.smtp.host) return false;
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}

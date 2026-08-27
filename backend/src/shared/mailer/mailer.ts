import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../../config/env.js';

const appName = 'OurWeek';
const smtpSecurePort = 465;

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.SMTP_CONFIGURED) {
    throw new Error('SMTP is not configured');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === smtpSecurePort,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(to: string, code: string) {
  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: `${appName} password reset code`,
    text: [
      `We received a request to reset your ${appName} password.`,
      '',
      `Your reset code is: ${code}`,
      '',
      'Enter this code in the app to choose a new password. The code expires in 30 minutes and can be used only once.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
  });
}

export async function sendWorkspaceInvitationEmail(
  to: string,
  input: { participantName: string; invitationUrl: string },
) {
  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: `${appName} workspace invitation`,
    text: [
      `You have been invited to join ${appName} as ${input.participantName}.`,
      '',
      'Open this invitation in the OurWeek app:',
      input.invitationUrl,
      '',
      'This invitation expires in 7 days and can be used only once.',
      '',
      'If you were not expecting this invitation, you can safely ignore this email.',
    ].join('\n'),
  });
}

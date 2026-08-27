import { ENV } from "./_core/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Dispatches an email notification via Resend, SendGrid, or falls back to logger.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "notifications@ledgerly.app";

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (response.ok) {
        console.log(`[EmailService] Email sent successfully to ${message.to}`);
        return true;
      } else {
        const errText = await response.text();
        console.warn(`[EmailService] Resend API error (${response.status}):`, errText);
      }
    } catch (err) {
      console.warn("[EmailService] Failed to send email via Resend:", err);
    }
  }

  if (ENV.isProduction) {
    console.error("[EmailService] RESEND_API_KEY is not configured; email was not sent.");
    return false;
  }

  // Development fallback: keep local development usable without a mail provider.
  console.log(`[EmailService:DevFallback] To: ${message.to} | Subject: "${message.subject}"`);
  return true;
}

/**
 * Template for Budget Limit Warning Emails
 */
export function buildBudgetAlertEmail(userName: string, category: string, spentFormatted: string, limitFormatted: string, percent: number): EmailMessage {
  return {
    to: "",
    subject: `🚨 Budget Alert: ${percent}% of ${category} budget reached`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">Ledgerly Budget Notification</h2>
        <p>Hello ${userName || "there"},</p>
        <p>You have reached <strong>${percent}%</strong> of your <strong>${category}</strong> budget for this month.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0; color: #475569;">Spent: <strong>${spentFormatted}</strong> / Limit: <strong>${limitFormatted}</strong></p>
        </div>
        <p style="color: #64748b; font-size: 13px;">You received this email because budget notifications are enabled on your account.</p>
      </div>
    `,
    text: `Ledgerly Budget Alert: You have reached ${percent}% of your ${category} budget (${spentFormatted} / ${limitFormatted}).`,
  };
}

/**
 * Template for Group Bill Notifications
 */
export function buildGroupBillAddedEmail(userName: string, groupName: string, billTitle: string, payerName: string, shareFormatted: string): EmailMessage {
  return {
    to: "",
    subject: `💸 New Bill Added in "${groupName}": ${billTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">Ledgerly Shared Expense</h2>
        <p>Hello ${userName || "there"},</p>
        <p><strong>${payerName}</strong> added a new bill to your group <strong>${groupName}</strong>:</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>${billTitle}</strong></p>
          <p style="margin: 0; color: #0284c7;">Your allocated share: <strong>${shareFormatted}</strong></p>
        </div>
        <p style="color: #64748b; font-size: 13px;">Log in to Ledgerly to view updated settlement balances.</p>
      </div>
    `,
    text: `New Bill in ${groupName}: ${billTitle} paid by ${payerName}. Your share: ${shareFormatted}.`,
  };
}

/**
 * One-time password-reset message. The token is never included in logs or
 * persisted in plaintext; it is only placed in the recipient's reset link.
 */
export function buildPasswordResetEmail(userName: string, resetUrl: string): EmailMessage {
  return {
    to: "",
    subject: "Reset your Ledgerly password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
        <h2 style="margin: 0 0 16px; color: #111827;">Reset your Ledgerly password</h2>
        <p>Hello ${userName || "there"},</p>
        <p>We received a request to reset the password for your Ledgerly account.</p>
        <p><a href="${resetUrl}" style="display:inline-block; padding:12px 18px; background:#111827; color:#ffffff; text-decoration:none;">Create a new password</a></p>
        <p>This link expires in 30 minutes and can be used only once. If you did not request this, you can safely ignore this email.</p>
        <p style="font-size:13px;color:#6b7280;">For your security, never share this link with anyone.</p>
      </div>
    `,
    text: `Hello ${userName || "there"},\n\nReset your Ledgerly password here:\n${resetUrl}\n\nThis link expires in 30 minutes and can be used only once. If you did not request this, ignore this email.`,
  };
}

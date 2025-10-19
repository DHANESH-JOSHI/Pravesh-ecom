import config from "@/config";
import { logger } from "@/config/logger";
import { Resend } from "resend";

const resend = new Resend(config.RESEND_API_KEY);
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
) => {
  const { error } = await resend.emails.send({
    from: `Pravesh <mail@${config.RESEND_DOMAIN}>`,
    to,
    subject,
    text,
  });
  if (error) {
    logger.error(`[EMAIL] Failed to send email to ${to}. Error: ${error.message}`)
  }
}


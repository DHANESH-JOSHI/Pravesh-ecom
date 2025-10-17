import config from "@/config";
import { ApiError } from "@/interface";
import status from "http-status";
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
    throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to send email to ${to}. Error: ${error.message}`, "EMAIL")
  }
}


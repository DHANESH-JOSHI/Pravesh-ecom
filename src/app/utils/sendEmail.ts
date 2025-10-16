import config from "@/config";
import { Resend } from "resend";

const resend = new Resend(config.RESEND_API_KEY);
export const sendEmail = async (
    to: string,
    subject: string,
    text: string,
): Promise<void> => {
    await resend.emails.send({
        from: `Pravesh <mail@${config.RESEND_DOMAIN}>`,
        to,
        subject,
        text,
    });
}


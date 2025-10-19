import axios from "axios";
import config from "@/config";
import { logger } from "@/config/logger";

const client = axios.create({
  baseURL: "https://api.authkey.io",
  params: {
    country_code: "+91",
    sender: config.SMS_SENDER_ID,
    authkey: config.SMS_AUTH_KEY,
  },
});

export const sendSMS = async (message: string, phone: string): Promise<void> => {
  try {
    const res = await client.get("/request", {
      params: {
        sms: message,
        mobile: phone,
      },
    });
    if (res.status !== 200) {
      logger.error(`[SMS] Failed to send SMS to ${phone}. Message: ${res.data.Message}`);
    }
  } catch (error: any) {
    logger.error(`[SMS] Failed to send SMS to ${phone}. Error: ${error.message}`);
  }
}
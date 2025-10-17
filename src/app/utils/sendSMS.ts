import axios from "axios";
import config from "@/config";
import { ApiError } from "@/interface";
import status from "http-status";

const client = axios.create({
  baseURL: "https://api.authkey.io",
  params: {
    country_code: "+91",
    sender: config.SMS_SENDER_ID,
    authkey: config.SMS_AUTH_KEY,
  },
});

export const sendSMS = async (message: string, phone: string): Promise<void> => {
  const res = await client.get("/request", {
    params: {
      sms: message,
      mobile: phone,
    },
  });
  if (res.status !== 200) {
    throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to send SMS to ${phone}. Message: ${res.data.Message}`, "SMS");
  }
}
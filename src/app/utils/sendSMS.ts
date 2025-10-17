import axios from "axios";
import config from "@/config";

const client = axios.create({
  baseURL: "https://api.authkey.io",
  params: {
    country_code: "+91",
    sender: config.SMS_SENDER_ID,
    authkey: config.SMS_AUTH_KEY,
  },
});

export const sendSMS = async (message: string, phone: string): Promise<void> => {
  await client.get("/request", {
    params: {
      sms: message,
      mobile: phone,
    },
  });
}
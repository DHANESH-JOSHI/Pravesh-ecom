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

export const sendText = async (message: string, phone: string): Promise<void> => {
    try {
        const response = await client.get("/request", {
            params: {
                sms: message,
                mobile: phone,
            },
        });
        console.log(response.data);
    } catch (error) {
        throw error;
    }
}
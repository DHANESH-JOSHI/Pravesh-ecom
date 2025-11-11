"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const client = axios_1.default.create({
    baseURL: "https://api.authkey.io",
    params: {
        country_code: "+91",
        sender: config_1.default.SMS_SENDER_ID,
        authkey: config_1.default.SMS_AUTH_KEY,
    },
});
const sendSMS = async (message, phone) => {
    try {
        const res = await client.get("/request", {
            params: {
                sms: message,
                mobile: phone,
            },
        });
        if (res.status !== 200) {
            logger_1.logger.error(`[SMS] Failed to send SMS to ${phone}. Message: ${res.data.Message}`);
        }
    }
    catch (error) {
        logger_1.logger.error(`[SMS] Failed to send SMS to ${phone}. Error: ${error.message}`);
    }
};
exports.sendSMS = sendSMS;
//# sourceMappingURL=sendSMS.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const resend_1 = require("resend");
const resend = new resend_1.Resend(config_1.default.RESEND_API_KEY);
const sendEmail = async (to, subject, text) => {
    const { error } = await resend.emails.send({
        from: `Pravesh <mail@${config_1.default.RESEND_DOMAIN}>`,
        to,
        subject,
        text,
    });
    if (error) {
        logger_1.logger.error(`[EMAIL] Failed to send email to ${to}. Error: ${error.message}`);
    }
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=sendEmail.js.map
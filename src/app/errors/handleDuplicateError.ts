import { ApiError } from "@/interface";
import status from "http-status";

export const handleDuplicateError = (err: any) => {
  const match = err.message.match(/"([^"]*)"/);

  const extractedMessage = match && match[1];

  const message = `${extractedMessage} is already exists`;

  const statusCode = status.BAD_REQUEST;

  return new ApiError(
    statusCode,
    message,
  );
};
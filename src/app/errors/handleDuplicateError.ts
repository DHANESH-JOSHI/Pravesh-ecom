import { ApiError } from "@/interface";

export const handleDuplicateError = (err: any) => {
  // check match
  const match = err.message.match(/"([^"]*)"/);

  const extractedMessage = match && match[1];

  const message = `${extractedMessage} is already exists`;

  const statusCode = 400;

  return new ApiError(
    statusCode,
    message,
  );
};
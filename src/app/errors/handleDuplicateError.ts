import { TErrorSources, TGenericErrorResponse } from "@/interface";
export const handleDuplicateError = (err: any): TGenericErrorResponse => {
  // check match
  const match = err.message.match(/"([^"]*)"/);

  const extractedMessage = match && match[1];

  const errorSources: TErrorSources = [
    {
      path: "",
      message: `${extractedMessage} is already exists`,
    },
  ];

  const statusCode = 400;

  return {
    statusCode,
    message: "Invalid ID",
    errorSources,
  };
};
import { ApiError } from "@/interface";
import status from "http-status";
import { ZodError } from "zod";
export const handleZodError = (err: ZodError) => {
  const errors = err.issues.map((issue) => `${issue.path.length ? issue.path.join('/'): 'body'} ::${issue.message}`).join(' || ');
  return new ApiError(status.BAD_REQUEST, errors);
};

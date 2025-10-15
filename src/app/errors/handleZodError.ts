import { ApiError } from "@/interface";
import { ZodError } from "zod";
export const handleZodError = (err: ZodError) => {
  const errors = err.issues.map((issue) => `${issue.path.length ? issue.path.join('/'): 'body'} ::${issue.message}`).join(' || ');
  return new ApiError(400, errors);
};

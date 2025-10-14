import { ZodError } from "zod";
import { appError } from ".";
export const handleZodError = (err: ZodError) => {
  const errors = err.issues.map((issue) => `${issue.path.length ? issue.path.join('/'): 'body'} ::${issue.message}`).join(' || ');
  return new appError(errors, 400);
};

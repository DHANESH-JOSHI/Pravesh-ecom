import { ZodError } from "zod";
import { appError } from ".";
export const handleZodError = (err: ZodError) => {
  const errors = (err as any).errors.map((e: any) => ({ path: e.path.join('. '), message: e.message }));
  const message = 'Invalid input data. ';
  return new appError(message + JSON.stringify(errors), 400);
};

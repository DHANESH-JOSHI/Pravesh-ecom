import { appError } from ".";
export const handleCastError = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new appError(message, 400);
};

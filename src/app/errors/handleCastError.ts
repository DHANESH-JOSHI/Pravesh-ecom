import { ApiError } from "@/interface";

export const handleCastError = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new ApiError(400, message);
};

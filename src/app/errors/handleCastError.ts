import { ApiError } from "@/interface";
import status from "http-status";

export const handleCastError = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new ApiError(status.BAD_REQUEST, message);
};

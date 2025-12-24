import { Request } from "express";

export type ClientType = "frontend" | "dashboard";

const getDashboardOrigins = (): string[] => {
  const envOrigins = process.env.DASHBOARD_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(",").map(origin => origin.trim().toLowerCase());
  }
  return [];
};

export const getClientType = (req: Request): ClientType => {
  const clientTypeHeader = req.headers["x-client-type"] as string;
  if (clientTypeHeader === "frontend" || clientTypeHeader === "dashboard") {
    return clientTypeHeader as ClientType;
  }

  const origin = req.headers.origin || req.headers.referer || "";

  if (typeof origin === "string" && origin.length > 0) {
    const originLower = origin.toLowerCase();

    const dashboardOrigins = getDashboardOrigins();
    if (dashboardOrigins.length > 0) {
      for (const dashboardOrigin of dashboardOrigins) {
        if (originLower.includes(dashboardOrigin) || originLower === dashboardOrigin) {
          return "dashboard";
        }
      }
    }

    if (
      originLower.includes("dashboard") ||
      originLower.includes("admin") ||
      originLower.includes("/dashboard") ||
      originLower.match(/dashboard[.-]/) ||
      originLower.match(/admin[.-]/)
    ) {
      return "dashboard";
    }
  }

  return "frontend";
};

export const getCookieNames = (clientType: ClientType) => {
  if (clientType === "dashboard") {
    return {
      accessToken: "dashboard_accessToken",
      refreshToken: "dashboard_refreshToken",
    };
  }
  return {
    accessToken: "frontend_accessToken",
    refreshToken: "frontend_refreshToken",
  };
};

export const getCookieNamesFromRequest = (req: Request) => {
  const clientType = getClientType(req);
  return getCookieNames(clientType);
};


import type { CookieOptions } from "express";
import type { Request } from "express";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList[0]?.trim().toLowerCase() === "https";
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: SESSION_MAX_AGE_MS,
  };
}

import { RequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/tokens";
import { User } from "../models/User";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new AppError(401, "Authentication required"));
  try {
    const payload = verifyAccessToken(header.slice(7));
    // Role and status come from the DB so changes apply immediately
    const user = await User.findById(payload.sub)
      .select("firmId role isActive name")
      .lean();
    if (!user || !user.isActive)
      return next(new AppError(401, "Session expired"));
    req.auth = {
      userId: user._id.toString(),
      firmId: user.firmId.toString(),
      role: user.role,
      name: user.name,
    };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
};

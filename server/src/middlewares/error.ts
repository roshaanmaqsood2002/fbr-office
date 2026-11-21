import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { isProd } from "../config/env";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: err.issues[0]?.message ?? "Validation failed",
      errors: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ message: err.message, code: err.code });
  }
  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ message: "A record with these details already exists" });
  }

  if (err?.name === "CastError")
    return res.status(404).json({ message: "Record not found" });

  if (err?.name === "MulterError")
    return res.status(400).json({
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large (max 2 MB)"
          : "Invalid upload",
    });

  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ message: err.message, code: err.code, details: err.details });
  }
  console.error(err);
  res.status(500).json({
    message: isProd ? "Internal server error" : String(err?.message ?? err),
  });
};

import { RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

export const validate =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body); // throws ZodError, handled in error middleware
    next();
  };
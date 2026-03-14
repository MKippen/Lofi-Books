import type express from 'express';

export function asyncHandler(
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => Promise<unknown>,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

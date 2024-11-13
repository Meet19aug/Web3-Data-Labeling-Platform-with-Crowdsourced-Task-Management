import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '.';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void | Promise<void> {
    const authHeader = req.headers["authorization"] ?? "";

    try {
        const decoded = jwt.verify(authHeader, JWT_SECRET);
        console.log(decoded);

        // @ts-ignore
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;
            return next();
        } else {
            res.status(403).json({
                message: "You are not logged in"
            });
        }
    } catch (e) {
        res.status(403).json({
            message: "You are not logged in"
        });
        return;
    }
}
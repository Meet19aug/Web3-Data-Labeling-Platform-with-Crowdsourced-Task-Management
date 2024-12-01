import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, WORKER_JWT_SECRET } from './config';



export function authMiddleware(req: Request, res: Response, next: NextFunction): void | Promise<void> {
    const authHeader = req.headers["authorization"] ?? "";

    try {
        const decoded = jwt.verify(authHeader, JWT_SECRET);

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

export function workermiddleware(req: Request, res: Response, next: NextFunction): void | Promise<void> {
    const authHeader = req.headers["authorization"] ?? "";

    try {
        const decoded = jwt.verify(authHeader, WORKER_JWT_SECRET);
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
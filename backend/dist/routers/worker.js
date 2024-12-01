"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const middleware_1 = require("../middleware");
const config_1 = require("../config");
const db_1 = require("../db");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const TOTAL_SUBMISSIONS = 100;
router.post("/payout", middleware_1.workermiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: userId,
        }
    });
    if (!worker) {
        res.status(403).json({
            message: "Worker not found",
        });
        return;
    }
    const address = worker === null || worker === void 0 ? void 0 : worker.address;
    //logic to create a txns
    // solana.web3.transfer(address, worker.pending_amount);
    // We should lock here to prevent double requests.
    const txnId = "0x12123123412341";
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: userId,
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount,
                },
                locked_amount: {
                    increment: worker.pending_amount,
                },
            }
        });
        yield tx.payouts.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: txnId,
            },
        });
    }));
    // send the txt to the solana blaockchain.
    res.json({
        message: "Payout initiated",
        txnId,
        amount: worker.pending_amount,
    });
}));
router.get("/balance", middleware_1.workermiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId),
        }
    });
    res.json({
        pendingAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
        lockedAmount: worker === null || worker === void 0 ? void 0 : worker.locked_amount,
    });
}));
router.post("/submission", middleware_1.workermiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parsedBody = types_1.createSubmissionInput.safeParse(body);
    if (parsedBody.success) {
        const task = yield (0, db_1.getNextTask)(userId);
        if (!task || (task === null || task === void 0 ? void 0 : task.id) !== Number(parsedBody.data.taskId)) {
            res.status(411).json({
                message: "Invalid task id",
            });
            return;
        }
        const amount = Number(task.amount) / TOTAL_SUBMISSIONS;
        const submission = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const submission = yield tx.submission.create({
                data: {
                    options_id: Number(parsedBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parsedBody.data.taskId),
                    amount,
                },
            });
            yield tx.worker.update({
                where: {
                    id: userId,
                },
                data: {
                    pending_amount: {
                        increment: Number(amount),
                    },
                },
            });
        }));
        const nextTask = yield (0, db_1.getNextTask)(userId);
        res.json({ nextTask, amount });
    }
}));
router.get("/nextTask", middleware_1.workermiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const task = yield (0, db_1.getNextTask)(userId);
    if (!task) {
        res.status(411).json({
            message: "No task available",
        });
    }
    else {
        res.status(411).json({ task });
    }
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hardcodedWalletAddress = "zzzfdsa";
    const existingUser = yield prismaClient.worker.findFirst({
        where: {
            address: hardcodedWalletAddress,
        },
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({ userId: existingUser.id }, config_1.WORKER_JWT_SECRET);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.worker.create({
            data: {
                address: hardcodedWalletAddress,
                locked_amount: 0,
                pending_amount: 0,
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, config_1.WORKER_JWT_SECRET);
        res.json({ token });
    }
}));
exports.default = router;

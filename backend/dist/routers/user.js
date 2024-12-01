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
const client_1 = require("@prisma/client");
const express_1 = require("express");
const client_s3_1 = require("@aws-sdk/client-s3");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middleware");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types");
const config_1 = require("../config");
const prismaClient = new client_1.PrismaClient();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const DEFAULT_TITLE = "Select the most suitable thumbnail";
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId,
        secretAccessKey
    },
    region: region
});
const router = (0, express_1.Router)();
router.get("/presignedUrl", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
        Bucket: 'decentralize-data-labeling',
        Key: `decentralize-data/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
            ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Expires: 3600
    });
    console.log({ url, fields });
    res.json({
        preSignedUrl: url,
        fields
    });
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hardcodedWalletAddress = "asdfghjklzz";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: hardcodedWalletAddress,
        },
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({ userId: existingUser.id }, config_1.JWT_SECRET);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: hardcodedWalletAddress,
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, config_1.JWT_SECRET);
        res.json({ token });
    }
}));
router.get("/task", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const taskId = req.query.taskId;
        // @ts-ignore
        const userId = req.userId;
        const taskDetails = yield prismaClient.task.findFirst({
            where: {
                user_id: Number(userId),
                id: Number(taskId),
            },
            include: {
                options: true,
            },
        });
        if (!taskDetails) {
            res.status(411).json({
                message: "You don't have access to this task",
            });
            return;
        }
        // Fetch all responses related to the task.
        const responses = yield prismaClient.submission.findMany({
            where: {
                task_id: Number(taskId),
            },
            include: {
                options: true,
            },
        });
        const result = {};
        // Initialize count for each option in task details.
        taskDetails.options.forEach((option) => {
            result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url,
                },
            };
        });
        // Increment count for each response's option.
        responses.forEach((r) => {
            if (result[r.options_id]) {
                result[r.options_id].count++;
            }
        });
        // Send final response.
        res.json({
            result,
            taskDetails,
        });
        return;
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal Server Error",
        });
        return;
    }
}));
router.post("/task", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const userId = req.userId;
        // Validate input data from the user.
        const body = req.body;
        const parseData = types_1.createTaskInput.safeParse(body);
        if (!parseData.success) {
            res.status(411).json({ message: "You have sent the wrong input." });
            return; // Explicit return to ensure function exits after response
        }
        // Execute transaction for task creation and options.
        const response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const task = yield tx.task.create({
                data: {
                    title: (_a = parseData.data.title) !== null && _a !== void 0 ? _a : DEFAULT_TITLE,
                    amount: 1 * config_1.TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId,
                },
            });
            yield tx.options.createMany({
                data: parseData.data.options.map((x) => ({
                    image_url: x.imageUrl,
                    task_id: task.id,
                })),
            });
            return task;
        }));
        res.json({ id: response.id });
        return; // Explicit return to ensure function exits after response
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
        return; // Explicit return to ensure function exits after response
    }
}));
exports.default = router;

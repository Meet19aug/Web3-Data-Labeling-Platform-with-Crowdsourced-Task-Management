import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "..";
import { authMiddleware } from "../middleware";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types";
import { parse } from "dotenv";

const prismaClient = new PrismaClient();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
const region = process.env.AWS_REGION!;

const DEFAULT_TITLE = "Select the most suitable thumbnail";
const s3Client = new S3Client({
    credentials: {
        accessKeyId,
        secretAccessKey
    },
    region: region
});

const router = Router();



router.get("/presignedUrl", authMiddleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;

    const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: 'decentralize-data-labeling',
        Key: `decentralize-data/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
          ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Expires: 3600
    })

    console.log({url, fields})
    res.json({
        preSignedUrl: url,
        fields
    })
    
})

router.post("/signin", async(req, res) => {
    const hardcodedWalletAddress = "asdfghjklzz";
    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: hardcodedWalletAddress,
        },
    })    

    if(existingUser) {
        const token = jwt.sign({ userId : existingUser.id }, JWT_SECRET);
        res.json({ token });
    }else{
        const user = await prismaClient.user.create({
            data: {
                address: hardcodedWalletAddress,
            },
        });
        const token = jwt.sign({ userId : user.id }, JWT_SECRET);
        res.json({ token });
    }
});

router.get("/task", authMiddleware, async (req, res): Promise<void> => {
    try {
        // @ts-ignore
        const taskId: string = req.query.taskId;
        // @ts-ignore
        const userId: string = req.userId;

        const taskDetails = await prismaClient.task.findFirst({
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
        const responses = await prismaClient.submission.findMany({
            where: {
                task_id: Number(taskId),
            },
            include: {
                options: true,
            },
        });

        const result: Record<string, {
            count: number;
            option: { imageUrl: string };
        }> = {};

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
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal Server Error",
        });
        return;
    }
});



router.post("/task", authMiddleware, async (req, res): Promise<void> => {
    try {
        // @ts-ignore
        const userId = req.userId;

        // Validate input data from the user.
        const body = req.body;
        const parseData = createTaskInput.safeParse(body);

        if (!parseData.success) {
            res.status(411).json({ message: "You have sent the wrong input." });
            return; // Explicit return to ensure function exits after response
        }

        // Execute transaction for task creation and options.
        const response = await prismaClient.$transaction(async (tx) => {
            const task = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount: "1",
                    signature: parseData.data.signature,
                    user_id: userId,
                },
            });

            await tx.options.createMany({
                data: parseData.data.options.map((x) => ({
                    image_url: x.imageUrl,
                    task_id: task.id,
                })),
            });

            return task;
        });

        res.json({ id: response.id });
        return; // Explicit return to ensure function exits after response
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
        return; // Explicit return to ensure function exits after response
    }
});


export default router;
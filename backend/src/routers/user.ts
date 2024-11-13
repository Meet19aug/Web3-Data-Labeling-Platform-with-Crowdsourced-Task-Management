import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "..";
import { authMiddleware } from "../middleware";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const prismaClient = new PrismaClient();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
const region = process.env.AWS_REGION!;

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

export default router;
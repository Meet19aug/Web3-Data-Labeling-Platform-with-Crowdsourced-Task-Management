import { Router } from "express";
import jwt, { sign } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { workermiddleware } from "../middleware";
import { TOTAL_DECIMALS, WORKER_JWT_SECRET } from "../config";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";

const router = Router();
const prismaClient = new PrismaClient();
const TOTAL_SUBMISSIONS = 100;


router.post("/payout", workermiddleware, async (req,res) => {
  //@ts-ignore
  const userId = req.userId;
  const worker = await prismaClient.worker.findFirst({
    where: {
      id: userId,
    }
  });

  if(!worker) {
    res.status(403).json({
      message: "Worker not found",
    });
    return;
  }

  const address = worker?.address;

  //logic to create a txns
  // solana.web3.transfer(address, worker.pending_amount);

  // We should lock here to prevent double requests.
  const txnId = "0x12123123412341"
  await prismaClient.$transaction(async tx => { 
    await tx.worker.update({
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

    await tx.payouts.create({
      data: {
        user_id: Number(userId),
        amount: worker.pending_amount,
        status: "Processing",
        signature: txnId,
      },
    });

  });

  // send the txt to the solana blaockchain.
  res.json({
    message: "Payout initiated",
    txnId,
    amount: worker.pending_amount,
  });

})

router.get("/balance", workermiddleware, async (req,res) => {
  //@ts-ignore
  const userId: string = req.userId;
  const worker = await prismaClient.worker.findFirst({
    where: {
      id: Number(userId),
    }
  })
  res.json({
    pendingAmount: worker?.pending_amount,
    lockedAmount: worker?.locked_amount,
  });
})

router.post("/submission", workermiddleware, async (req,res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);

  if(parsedBody.success) {
    const task =await getNextTask(userId);
    if(!task || task?.id !== Number(parsedBody.data.taskId)) {
      res.status(411).json({
        message: "Invalid task id",
      });
      return;
    }

    const amount = Number(task.amount) / TOTAL_SUBMISSIONS

    const submission = await prismaClient.$transaction(async tx => {
      const submission = await tx.submission.create({
        data: {
          options_id: Number(parsedBody.data.selection),
          worker_id: userId,
          task_id: Number(parsedBody.data.taskId),
          amount,
        }, 
      }); 

      await tx.worker.update({
        where: {
          id: userId,
        },
        data: {
          pending_amount: {
            increment: Number(amount),
          },
        },
      })
    })

    const nextTask = await getNextTask(userId);
    res.json({nextTask, amount});
  }
 
  




});

router.get("/nextTask", workermiddleware, async (req,res) => {
  //@ts-ignore
  const userId = req.userId;

  const task = await getNextTask(userId);

  if(!task) {
    res.status(411).json({
      message: "No task available",
    });
  }else{
    res.status(411).json({task})
  }
})

router.post("/signin", async(req, res) => {
  const hardcodedWalletAddress = "zzzfdsa";
  const existingUser = await prismaClient.worker.findFirst({
      where: {
          address: hardcodedWalletAddress,
      },
  })    

  if(existingUser) {
      const token = jwt.sign({ userId : existingUser.id }, WORKER_JWT_SECRET);
      res.json({ token });
  }else{
      const user = await prismaClient.worker.create({
          data: {
              address: hardcodedWalletAddress,
              locked_amount:0,
              pending_amount:0,
          },
      });
      const token = jwt.sign({ userId : user.id }, WORKER_JWT_SECRET);
      res.json({ token });
  }
});

export default router;
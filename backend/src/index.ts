import express from "express";
import userRouter from "./routers/user"; // Add this line to import userRouter
import workerRouter from "./routers/worker"; // Add this line to import userRouter

const app = express();

app.use(express.json()); // expacting json data from user so we need to parse it

app.use("/v1/user",userRouter);
app.use("/v1/worker",workerRouter);
export const JWT_SECRET = "mysecretkey";

app.listen(3000, () => {
  console.log("Server is running on port 3000");
})
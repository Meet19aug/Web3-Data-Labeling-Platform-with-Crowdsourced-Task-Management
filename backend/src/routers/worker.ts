import { Router } from "express";

const router = Router();
router.post("/signin", (req, res) => {
  res.send("Sign in");
});

export default router;
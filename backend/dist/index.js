"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = __importDefault(require("./routers/user")); // Add this line to import userRouter
const worker_1 = __importDefault(require("./routers/worker")); // Add this line to import userRouter
const app = (0, express_1.default)();
app.use("/v1/user", user_1.default);
app.use("/v1/worker", worker_1.default);
exports.JWT_SECRET = "mysecretkey";
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

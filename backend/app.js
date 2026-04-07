import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import usersRouter from "./src/routers/usersRouter.js";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;

app.use("/users", usersRouter);


app.get("/", (req, res) => {
  res.send("API is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

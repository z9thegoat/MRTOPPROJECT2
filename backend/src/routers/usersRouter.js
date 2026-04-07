import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import {
  createUser,
  getRoleNamebyUserId,
  getUserByEmail,
  getAllUsers,
  deleteUser,
  updateUserIp,
} from "../controllers/usersControllers.js";

const JWT_SECRET = process.env.JWT_SECRET;
const usersRouter = Router();

// -------------------- HELPER: GET REAL CLIENT IP --------------------
export const getClientIp = (req) => {
  // If behind a proxy, x-forwarded-for contains real client IP
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

  // fallback for direct connections (local testing)
  return req.socket.remoteAddress.replace("::ffff:", "");
};

// -------------------- CHECK ROUTE --------------------
usersRouter.get("/check", async (req, res) => {
  res.send("usersRouter working");
});

// -------------------- REGISTER --------------------
usersRouter.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Missing required fields" });

  const clientIp = getClientIp(req);

  try {
    // 1️⃣ Create the user
    const result = await createUser({ email, password });
    const userId = result.insertId;

    // 2️⃣ Store the IP in the database
    await updateUserIp(userId, clientIp);

    // 3️⃣ Generate JWT token immediately after registration
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({
      message: "Registration successful",
      token,
      ip: clientIp,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, code: error.code });
  }
});

// -------------------- LOGIN --------------------
usersRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    // 1️⃣ Get user by email
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2️⃣ Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(403).json({ message: "Unauthorized" });

    // 3️⃣ Generate JWT token
    const token = jwt.sign({ id: user.user_id }, JWT_SECRET, { expiresIn: "1h" });

    // 4️⃣ Get real client IP and update DB
    const clientIp = getClientIp(req);
    await updateUserIp(user.user_id, clientIp);

    return res.status(200).json({
      message: "Login successful",
      token,
      ip: clientIp,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -------------------- JWT MIDDLEWARE --------------------
const jwtMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    req.jwtexpired = true;
    req.user_id = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      req.jwtexpired = true;
      req.user_id = null;
    } else {
      req.jwtexpired = false;
      req.user_id = payload.id;
    }
    next();
  });
};

// -------------------- VERIFY ROUTE --------------------
usersRouter.get("/verify", jwtMiddleware, async (req, res) => {
  if (req.jwtexpired) return res.status(403).json({ message: "Unauthorized" });
  try {
    const role = await getRoleNamebyUserId(req.user_id);
    res.status(200).json({ message: "Success", role: role || "Unknown Role" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch role" });
  }
});

// -------------------- GET EMAIL BY ID --------------------
usersRouter.get("/getEmailById/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const email = await getEmailById(userId);
    res.json(email);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------- GET ALL USERS --------------------
usersRouter.get("/getAllUsers", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------- DELETE USER --------------------
usersRouter.delete("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId))
      return res.status(400).json({ message: "Invalid user ID" });

    await deleteUser(userId);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

// -------------------- GET ROLE BY USER ID --------------------
usersRouter.get("/getRoleNameByUserId", async (req, res) => {
  const userId = Number(req.query.userId);
  if (isNaN(userId))
    return res.status(400).json({ message: "Invalid user ID" });

  try {
    const role = await getRoleNamebyUserId(userId);
    res.json({ role: role || "Unknown Role" });
  } catch (err) {
    console.error("Router error:", err);
    res.status(500).json({ message: "Failed to fetch role" });
  }
});

export default usersRouter;
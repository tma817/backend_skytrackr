//Authentication service logic will be implemented here.
//This may include functions for user login, registration, token management, etc.

import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async (username, email, password) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User already exists");
  }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    return newUser;
};

export const loginUser = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });
    return { user, token };
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

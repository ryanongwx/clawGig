import { Router } from "express";
import { signup } from "../handlers/agents.js";

export const agentsRouter = Router();

agentsRouter.post("/signup", signup);

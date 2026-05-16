import { Router } from "express";
import * as notificationController from "../controllers/notificationController.js";

const router = Router();

router.get("/notifications", notificationController.getNotifications);
router.post("/logs", notificationController.createLog);

export default router;

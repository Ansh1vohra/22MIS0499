import * as notificationService from "../services/notificationService.js";
import { Log } from "../../logging_middleware/index.js";

export async function getNotifications(req, res) {
  try {
    const { limit, page, notification_type, priority } = req.query;
    
    // Log the request using the middleware
    // Log the request safely
    Log("backend", "info", "controller", `Fetching notifications (limit=${limit}, page=${page})`, {
      token: process.env.LOG_AUTH_TOKEN
    }).catch(err => console.error("Logging failed:", err.message));

    const data = await notificationService.fetchNotificationsFromRemote({
      limit,
      page,
      notification_type
    });

    // If requested, apply priority sorting
    if (priority === 'true') {
      data.notifications = notificationService.sortPriorityNotifications(data.notifications, parseInt(limit) || 10);
    }

    res.json(data);
  } catch (error) {
    // Log the error safely
    Log("backend", "error", "controller", error.message, {
      token: process.env.LOG_AUTH_TOKEN
    }).catch(err => console.error("Error logging failed:", err.message));
    res.status(500).json({ message: error.message });
  }
}

export async function createLog(req, res) {
  try {
    const logData = req.body;
    
    // Forward the log to the remote service
    const result = await notificationService.postLogToRemote(logData);
    
    res.json(result);
  } catch (error) {
    console.error("Failed to forward log:", error.message);
    res.status(500).json({ message: error.message });
  }
}

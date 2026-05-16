import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Log } from "../logging_middleware/index.js";

const NOTIFICATIONS_API_URL =
  "http://4.224.186.213/evaluation-service/notifications";

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const TOP_N = 10;
const OUTPUT_FILE = "priority-notifications-output.json";

function loadEnvFile(path) {
  const envPath = resolve(path);

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getAuthToken() {
  return (
    process.env.AFFORDMED_ACCESS_TOKEN ||
    process.env.LOG_AUTH_TOKEN ||
    process.env.VITE_LOG_AUTH_TOKEN
  );
}

async function safeLog(level, packageName, message) {
  try {
    await Log("backend", level, packageName, message, {
      token: getAuthToken(),
    });
  } catch {
    // Logging must not stop the assignment script from producing the answer.
  }
}

function parseTimestamp(timestamp) {
  const parsed = new Date(timestamp.replace(" ", "T") + "Z");

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid notification timestamp: ${timestamp}`);
  }

  return parsed;
}

function scoreNotification(notification) {
  const typeWeight = TYPE_WEIGHTS[notification.Type] ?? 0;
  const timestamp = parseTimestamp(notification.Timestamp);

  return {
    typeWeight,
    recencyMs: timestamp.getTime(),
    score: typeWeight * 1_000_000_000_000_000 + timestamp.getTime(),
  };
}

function comparePriority(left, right) {
  const leftScore = scoreNotification(left);
  const rightScore = scoreNotification(right);

  if (rightScore.score !== leftScore.score) {
    return rightScore.score - leftScore.score;
  }

  return left.ID.localeCompare(right.ID);
}

export function findTopPriorityNotifications(notifications, limit = TOP_N) {
  return [...notifications].sort(comparePriority).slice(0, limit).map((item) => {
    const priority = scoreNotification(item);

    return {
      ID: item.ID,
      Type: item.Type,
      Message: item.Message,
      Timestamp: item.Timestamp,
      PriorityScore: priority.score,
      TypeWeight: priority.typeWeight,
    };
  });
}

async function fetchNotifications() {
  const token = getAuthToken();

  if (!token) {
    throw new Error(
      "Missing API token. Add AFFORDMED_ACCESS_TOKEN or LOG_AUTH_TOKEN to backend/.env."
    );
  }

  await safeLog("info", "api", "fetching notifications for stage 6 priority ranking");

  const response = await fetch(NOTIFICATIONS_API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    await safeLog("error", "api", `notifications API failed with ${response.status}`);
    throw new Error(`Notifications API failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload.notifications)) {
    await safeLog("error", "api", "notifications API returned invalid payload");
    throw new Error("Invalid API response: notifications must be an array.");
  }

  await safeLog("info", "service", "notifications fetched successfully");

  return payload.notifications;
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile("backend/.env");

  const notifications = await fetchNotifications();
  const topNotifications = findTopPriorityNotifications(notifications, TOP_N);
  const output = {
    generatedAt: new Date().toISOString(),
    count: topNotifications.length,
    topNotifications,
  };

  await safeLog("info", "service", "top 10 priority notifications computed");

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

  console.table(
    topNotifications.map((notification, index) => ({
      Rank: index + 1,
      Type: notification.Type,
      Message: notification.Message,
      Timestamp: notification.Timestamp,
      Weight: notification.TypeWeight,
    }))
  );

  console.log(JSON.stringify(output, null, 2));
  console.log(`Saved output to ${OUTPUT_FILE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error) => {
    await safeLog("error", "service", error.message);
    console.error(error.message);
    process.exitCode = 1;
  });
}

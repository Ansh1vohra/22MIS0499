import { Log } from "../../logging_middleware/index.js";

const REMOTE_API_BASE = "http://4.224.186.213/evaluation-service";

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function getAuthToken() {
  return process.env.AFFORDMED_TOKEN;
}

function parseTimestamp(timestamp) {
  return new Date(timestamp.replace(" ", "T") + "Z");
}

function getPriorityScore(notification) {
  const typeWeight = TYPE_WEIGHTS[notification.Type] ?? 0;
  const timestamp = parseTimestamp(notification.Timestamp);
  return typeWeight * 1_000_000_000_000_000 + timestamp.getTime();
}
export async function fetchNotificationsFromRemote(params = {}) {
  const token = getAuthToken();
  const url = new URL(`${REMOTE_API_BASE}/notifications`);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Remote API returned ${response.status}`);
  }

  return await response.json();
}

export async function postLogToRemote(logData) {
  const token = getAuthToken();
  
  const response = await fetch(`${REMOTE_API_BASE}/logs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(logData),
  });

  if (!response.ok) {
    throw new Error(`Remote logging API returned ${response.status}`);
  }

  return await response.json();
}

export function sortPriorityNotifications(notifications, limit = 10) {
  return [...notifications]
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
    .slice(0, limit);
}

const LOG_API_URL = "http://4.224.186.213/evaluation-service/logs";

const VALID_STACKS = new Set(["backend", "frontend"]);
const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);

const BACKEND_PACKAGES = new Set([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
]);

const FRONTEND_PACKAGES = new Set([
  "api",
  "component",
  "hook",
  "page",
  "state",
  "style",
]);

const SHARED_PACKAGES = new Set(["auth", "config", "middleware", "utils"]);

function getEnvToken() {
  if (typeof process !== "undefined" && process.env) {
    return process.env.LOG_AUTH_TOKEN || process.env.VITE_LOG_AUTH_TOKEN;
  }

  return undefined;
}

function isValidPackage(stack, packageName) {
  if (SHARED_PACKAGES.has(packageName)) {
    return true;
  }

  if (stack === "backend") {
    return BACKEND_PACKAGES.has(packageName);
  }

  return FRONTEND_PACKAGES.has(packageName);
}

function validateLogInput(stack, level, packageName, message) {
  if (!VALID_STACKS.has(stack)) {
    throw new Error(`Invalid stack "${stack}". Expected "backend" or "frontend".`);
  }

  if (!VALID_LEVELS.has(level)) {
    throw new Error(`Invalid level "${level}".`);
  }

  if (!isValidPackage(stack, packageName)) {
    throw new Error(`Invalid package "${packageName}" for stack "${stack}".`);
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    throw new Error("Log message must be a non-empty string.");
  }
}

export async function Log(stack, level, packageName, message, options = {}) {
  validateLogInput(stack, level, packageName, message);

  const token = options.token || getEnvToken();

  if (!token) {
    throw new Error("Missing logging auth token. Set LOG_AUTH_TOKEN or pass options.token.");
  }

  const response = await fetch(LOG_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stack,
      level,
      package: packageName,
      message,
    }),
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    payload = { message: await response.text() };
  }

  if (!response.ok) {
    const reason = payload?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to create log: ${reason}`);
  }

  return payload;
}

export const logConfig = {
  LOG_API_URL,
  VALID_STACKS,
  VALID_LEVELS,
  BACKEND_PACKAGES,
  FRONTEND_PACKAGES,
  SHARED_PACKAGES,
};

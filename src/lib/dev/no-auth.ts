export function isDevNoAuthMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_NO_AUTH === "true";
}


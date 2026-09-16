export const getBrowserLaunchOptions = (env = process.env) =>
  env.CHROME_BIN ? { executablePath: env.CHROME_BIN } : {};

export const getCaptureMetadata = (review, now = new Date()) => ({
  version: review.appVersion,
  capturedAt: now.toISOString().slice(0, 10),
});

import { networkInterfaces } from "node:os";
import { defineConfig, devices } from "@playwright/test";

// A non-loopback origin exercises the HTTP restrictions that localhost bypasses.
const address = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .find(
    (entry) =>
      entry.family === "IPv4" &&
      !entry.internal &&
      /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(entry.address),
  )?.address;

if (!address)
  throw new Error(
    "LANテストにはプライベートIPv4アドレスが必要です。Wi-Fiなどのローカルネットワークへ接続して再実行してください。",
  );

const port = 3100;

export default defineConfig({
  testDir: "./e2e-lan",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://${address}:${port}`,
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--no-proxy-server"],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
  },
  projects: [
    { name: "desktop-lan", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-lan", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

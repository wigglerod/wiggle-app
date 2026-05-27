import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'

// Load .env.local first (overrides), then .env, so SUPABASE_SERVICE_ROLE_KEY resolves.
if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
if (existsSync('.env')) loadEnv({ path: '.env' })

const BASE_URL = process.env.WHEEL_BASE_URL || 'https://wiggle-app-dusky.vercel.app'

export default defineConfig({
  testDir: './tests/wheels',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})

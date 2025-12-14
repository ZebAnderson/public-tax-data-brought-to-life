import 'dotenv/config';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  return value ?? defaultValue;
}


export type PublicEnvironment = "local" | "staging" | "production";

export const publicEnvironment = (
  process.env.NEXT_PUBLIC_APP_ENV ?? "local"
) as PublicEnvironment;

export function assertStagingPublicConfiguration(): void {
  if (publicEnvironment !== "staging") {
    return;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const expectedProjectRef = process.env.NEXT_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF;
  const paddleEnvironment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  if (apiBaseUrl !== "https://thinkdeeperprod-staging.up.railway.app") {
    throw new Error("Staging API configuration is invalid.");
  }
  if (!expectedProjectRef || !supabaseUrl) {
    throw new Error("Staging Supabase project identity is not configured.");
  }
  const projectHost = new URL(supabaseUrl).hostname;
  if (projectHost !== `${expectedProjectRef}.supabase.co`) {
    throw new Error("Staging Supabase project identity does not match.");
  }
  const paddleConfigured = Boolean(paddleEnvironment || paddleToken);
  if (
    paddleConfigured &&
    (paddleEnvironment !== "sandbox" || !paddleToken?.startsWith("test_"))
  ) {
    throw new Error("Staging Paddle configuration must use sandbox.");
  }
}

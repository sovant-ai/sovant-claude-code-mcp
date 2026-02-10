/**
 * Sovant client wrapper for Claude Code MCP plugin
 *
 * Initializes and provides access to the Sovant SDK client.
 * Handles API key validation and error handling.
 */

import { Sovant, SovantError } from "@sovant/sdk";

let client: Sovant | null = null;

/**
 * Get or initialize the Sovant client
 * @throws Error if SOVANT_API_KEY is not set
 */
export function getSovantClient(): Sovant {
  if (client) return client;

  const apiKey = process.env.SOVANT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SOVANT_API_KEY environment variable is not set.\n" +
        "Please set it in your shell or Claude Code configuration:\n" +
        "  export SOVANT_API_KEY=sk_live_your_key_here\n" +
        "Get your API key at https://sovant.ai/dashboard/settings/api-keys",
    );
  }

  client = new Sovant({
    apiKey,
    baseUrl: process.env.SOVANT_BASE_URL, // Optional override for dev
  });

  return client;
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return !!process.env.SOVANT_API_KEY;
}

/**
 * Format Sovant errors for user display
 */
export function formatSovantError(error: unknown): string {
  if (error instanceof SovantError) {
    if (error.status === 401) {
      return "Authentication failed. Please check your SOVANT_API_KEY is valid.";
    }
    if (error.status === 429) {
      return "Rate limit exceeded. Please try again in a moment.";
    }
    if (error.status === 404) {
      return `Resource not found: ${error.message}`;
    }
    return `Sovant API error: ${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
}

export { SovantError };

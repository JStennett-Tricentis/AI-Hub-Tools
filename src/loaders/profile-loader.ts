// Profile Loader - Loads profile configurations from JSON files
// Port of ProfileLoader.cs

import { promises as fs } from "fs";
import path from "path";
import type { ProfileConfiguration } from "../core/models/types.js";

/**
 * Resolve the default profiles directory relative to the package root.
 * Uses import.meta.url to find the package root regardless of cwd.
 */
function getDefaultProfilesDir(): string {
  return path.join(process.cwd(), "data", "profiles");
}

/**
 * Load a profile configuration from a JSON file.
 *
 * Looks for `{profileName}.json` in the profiles directory.
 * Returns undefined if the file is not found.
 *
 * @param profileName - The name of the profile to load (without .json extension)
 * @param profilesDir - Optional directory to load profiles from (defaults to data/profiles)
 * @returns The parsed ProfileConfiguration, or undefined if not found
 */
export async function loadProfile(
  profileName: string,
  profilesDir?: string,
): Promise<ProfileConfiguration | undefined> {
  const dir = profilesDir ?? getDefaultProfilesDir();
  const filePath = path.join(dir, `${profileName}.json`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const profile = JSON.parse(content) as ProfileConfiguration;
    return profile;
  } catch (error) {
    // Return undefined if file not found
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    // Re-throw other errors (parse errors, permission errors, etc.)
    throw error;
  }
}

/**
 * Type guard for Node.js system errors with a `code` property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

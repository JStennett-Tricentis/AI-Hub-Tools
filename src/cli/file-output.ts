// File Output Service - Handles saving generated requests to files
// Port of FileOutputService.cs + PathValidator.cs

import { promises as fs } from "fs";
import os from "os";
import path from "path";

/**
 * Service for saving generated request JSON to files.
 * Includes path validation to prevent writing outside allowed directories.
 *
 * Port of FileOutputService.cs + PathValidator.cs.
 */
export class FileOutputService {
  /**
   * Save JSON content to a file.
   *
   * @param json - The JSON string to write
   * @param outputPath - The output file path (filename or full path)
   * @param endpointType - The endpoint type (used for default directory naming)
   * @param noTimestamp - If true, skip adding timestamp to the filename
   * @returns The resolved absolute path of the written file
   */
  async saveToFile(
    json: string,
    outputPath: string,
    endpointType: string,
    noTimestamp: boolean,
  ): Promise<string> {
    const resolvedPath = this.resolveOutputPath(outputPath, endpointType, noTimestamp);
    this.validateOutputPath(resolvedPath);

    // Ensure the parent directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, json, "utf-8");
    return resolvedPath;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Resolve the output path. If only a filename is provided (no directory separators),
   * places the file in a GeneratedRequests/ directory under the current working directory.
   * Adds a timestamp to the filename unless noTimestamp is true.
   */
  private resolveOutputPath(
    outputPath: string,
    _endpointType: string,
    noTimestamp: boolean,
  ): string {
    let filename: string;
    let dir: string;

    // Check if the path includes directory components
    const hasDirectory = outputPath.includes(path.sep) || outputPath.includes("/");

    if (hasDirectory) {
      // User provided a full or relative path
      dir = path.dirname(outputPath);
      filename = path.basename(outputPath);
    } else {
      // Just a filename - put in GeneratedRequests/
      dir = path.join(process.cwd(), "GeneratedRequests");
      filename = outputPath;
    }

    // Add timestamp to filename unless suppressed
    if (!noTimestamp) {
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      const timestamp = this.formatTimestamp(new Date());
      filename = `${name}_${timestamp}${ext || ".json"}`;
    }

    // Ensure .json extension if no extension is present
    if (!path.extname(filename)) {
      filename += ".json";
    }

    return path.resolve(dir, filename);
  }

  /**
   * Validate that the output path is within allowed directories.
   * Allowed directories: current working directory or system temp directory.
   * Throws an error if the path would write outside these boundaries.
   */
  private validateOutputPath(outputPath: string): void {
    const canonicalPath = path.resolve(outputPath);
    const cwd = path.resolve(process.cwd());
    const tmpDir = path.resolve(os.tmpdir());

    const isWithinCwd = canonicalPath.startsWith(cwd + path.sep) || canonicalPath === cwd;
    const isWithinTmp = canonicalPath.startsWith(tmpDir + path.sep) || canonicalPath === tmpDir;

    if (!isWithinCwd && !isWithinTmp) {
      throw new Error(
        `Output path "${outputPath}" is outside allowed directories. ` +
        `Files can only be written within the current directory or temp directory.`,
      );
    }
  }

  /**
   * Format a Date as yyyy-MM-ddTHH-mm-ss for use in filenames.
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  }
}

// Clipboard Service - Simple wrapper around clipboardy package
// Port of clipboard functionality from the C# CLI

import clipboard from "clipboardy";

const MAX_CLIPBOARD_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Copy text content to the system clipboard.
 * Throws if the content exceeds the maximum clipboard size (10MB).
 *
 * @param text - The text to copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (text.length > MAX_CLIPBOARD_SIZE) {
    throw new Error(
      `Content too large for clipboard (${text.length} bytes, max ${MAX_CLIPBOARD_SIZE})`,
    );
  }
  await clipboard.write(text);
}

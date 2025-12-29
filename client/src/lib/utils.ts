import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Opens a URL in a new tab, safely handling data URLs by converting them to blob URLs.
 * Modern browsers block navigating to data URLs for security reasons.
 */
export function openUrlInNewTab(url: string): void {
  if (!url) return;
  
  try {
    if (url.startsWith('data:')) {
      // Parse the data URL and convert to blob
      const matches = url.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          console.error('Unable to open file. Please allow popups.');
          URL.revokeObjectURL(blobUrl);
        }
        return;
      }
    }
    // Regular URL - open directly
    window.open(url, '_blank');
  } catch (error) {
    console.error('Failed to open URL:', error);
  }
}

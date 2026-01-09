/**
 * Folder Upload Utility
 * Handles recursive file extraction from dropped folders or directory picker
 */

export interface FileWithPath {
  file: File;
  relativePath: string;
}

/**
 * Recursively reads all files from a FileSystemDirectoryEntry
 */
async function readDirectoryRecursive(
  entry: FileSystemDirectoryEntry,
  path: string = ''
): Promise<FileWithPath[]> {
  const files: FileWithPath[] = [];
  const reader = entry.createReader();
  
  // Read all entries in batches (readEntries returns max ~100 entries at a time)
  const readAllEntries = async (): Promise<FileSystemEntry[]> => {
    const entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    
    do {
      batch = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      entries.push(...batch);
    } while (batch.length > 0);
    
    return entries;
  };

  const entries = await readAllEntries();
  
  for (const childEntry of entries) {
    const childPath = path ? `${path}/${childEntry.name}` : childEntry.name;
    
    if (childEntry.isFile) {
      const fileEntry = childEntry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      files.push({ file, relativePath: childPath });
    } else if (childEntry.isDirectory) {
      const dirEntry = childEntry as FileSystemDirectoryEntry;
      const subFiles = await readDirectoryRecursive(dirEntry, childPath);
      files.push(...subFiles);
    }
  }
  
  return files;
}

/**
 * Extract files from a DataTransferItemList (from drag-and-drop)
 * Supports both individual files and folders
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<FileWithPath[]> {
  const files: FileWithPath[] = [];
  const items = Array.from(dataTransfer.items);
  
  for (const item of items) {
    if (item.kind !== 'file') continue;
    
    // Try to get as entry first (for folder support)
    const entry = item.webkitGetAsEntry?.();
    
    if (entry) {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });
        files.push({ file, relativePath: file.name });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const subFiles = await readDirectoryRecursive(dirEntry, entry.name);
        files.push(...subFiles);
      }
    } else {
      // Fallback to regular file
      const file = item.getAsFile();
      if (file) {
        files.push({ file, relativePath: file.name });
      }
    }
  }
  
  return files;
}

/**
 * Extract files from a FileList (from input element)
 * Handles both regular file selection and webkitdirectory
 */
export function extractFilesFromFileList(fileList: FileList): FileWithPath[] {
  const files: FileWithPath[] = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    // webkitRelativePath is set when using webkitdirectory
    const relativePath = (file as any).webkitRelativePath || file.name;
    files.push({ file, relativePath });
  }
  
  return files;
}

/**
 * Upload files with progress tracking
 */
export interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  failed: string[];
}

export interface UploadResult {
  id: string;
  filename: string;
  url: string;
  content: string;
  size: number;
  type: string;
  relativePath?: string;
  uploadedAt: string;
}

export async function uploadFilesWithProgress(
  files: FileWithPath[],
  onProgress?: (progress: UploadProgress) => void,
  concurrency: number = 3
): Promise<{ results: UploadResult[]; failed: string[] }> {
  const results: UploadResult[] = [];
  const failed: string[] = [];
  let completed = 0;
  
  // Process files in batches for controlled concurrency
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async ({ file, relativePath }) => {
      try {
        onProgress?.({
          total: files.length,
          completed,
          current: relativePath,
          failed,
        });
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('relativePath', relativePath);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        results.push({ ...result, relativePath });
        completed++;
      } catch (error) {
        console.error(`Failed to upload ${relativePath}:`, error);
        failed.push(relativePath);
        completed++;
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  onProgress?.({
    total: files.length,
    completed,
    current: '',
    failed,
  });
  
  return { results, failed };
}

/**
 * Filter files by allowed extensions
 */
export function filterAllowedFiles(files: FileWithPath[]): {
  allowed: FileWithPath[];
  rejected: FileWithPath[];
} {
  const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.odt', '.ods', '.odp',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico', '.heic', '.heif',
    '.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv', '.m4v', '.mpeg', '.mpg',
    '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.json', '.xml', '.html', '.css', '.js', '.ts', '.md'
  ];
  
  const allowed: FileWithPath[] = [];
  const rejected: FileWithPath[] = [];
  
  for (const fileWithPath of files) {
    const ext = '.' + fileWithPath.file.name.split('.').pop()?.toLowerCase();
    if (allowedExtensions.includes(ext)) {
      allowed.push(fileWithPath);
    } else {
      rejected.push(fileWithPath);
    }
  }
  
  return { allowed, rejected };
}

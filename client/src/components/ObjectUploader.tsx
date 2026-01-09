import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { X, Upload, FileIcon, CheckCircle, AlertCircle, Loader2, RefreshCw, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { triggerSessionExpired } from "@/lib/api";
import { extractFilesFromDataTransfer, extractFilesFromFileList } from "@/lib/folderUpload";

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

interface UploadedFile {
  id: string;
  filename: string;
  objectPath: string;
  size: number;
  type: string;
  relativePath?: string;
}

interface PendingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  objectPath?: string;
  relativePath?: string;
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  accept?: string;
  onComplete?: (files: UploadedFile[]) => void;
  onError?: (error: Error) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  children: ReactNode;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function ObjectUploader({
  maxNumberOfFiles = 100,
  maxFileSize = 500 * 1024 * 1024, // 500MB default
  allowedFileTypes,
  accept,
  onComplete,
  onError,
  buttonClassName,
  buttonVariant = "outline",
  buttonSize = "default",
  disabled = false,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addFiles(Array.from(files));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [maxNumberOfFiles, maxFileSize, allowedFileTypes]);

  const addFilesWithPaths = useCallback((filesWithPaths: Array<{ file: File; relativePath?: string }>) => {
    const currentCount = pendingFiles.length;
    const availableSlots = maxNumberOfFiles - currentCount;
    
    if (availableSlots <= 0) {
      toast.error(`Maximum of ${maxNumberOfFiles} files allowed`);
      return;
    }

    const filesToAdd = filesWithPaths.slice(0, availableSlots);
    const newPendingFiles: PendingFile[] = [];

    for (const { file, relativePath } of filesToAdd) {
      if (file.size > maxFileSize) {
        toast.error(`${file.name} exceeds ${formatFileSize(maxFileSize)} limit`);
        continue;
      }

      if (allowedFileTypes && allowedFileTypes.length > 0) {
        const isAllowed = allowedFileTypes.some(type => {
          if (type.includes('/*')) {
            return file.type.startsWith(type.replace('/*', ''));
          }
          return file.type === type || file.name.toLowerCase().endsWith(type.replace('.', '').toLowerCase());
        });
        if (!isAllowed) {
          toast.error(`${file.name} is not an allowed file type`);
          continue;
        }
      }

      newPendingFiles.push({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
        relativePath,
      });
    }

    if (newPendingFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newPendingFiles]);
    }
  }, [pendingFiles.length, maxNumberOfFiles, maxFileSize, allowedFileTypes]);

  const addFiles = useCallback((files: File[]) => {
    addFilesWithPaths(files.map(file => ({ file, relativePath: file.name })));
  }, [addFilesWithPaths]);

  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const getUploadErrorMessage = (status: number, defaultMessage: string): string => {
    switch (status) {
      case 401:
        return "Your session has expired. Please log in again to upload files.";
      case 403:
        return "You don't have permission to upload files. Please contact an administrator.";
      case 413:
        return "The file is too large. Please try a smaller file.";
      case 500:
      case 502:
      case 503:
        return "The server is temporarily unavailable. Please try again in a moment.";
      default:
        return defaultMessage;
    }
  };

  const isRetryableError = (status: number): boolean => {
    return status === 408 || status === 429 || status >= 500;
  };

  const uploadFileWithRetry = async (
    pendingFile: PendingFile, 
    maxRetries: number = 3
  ): Promise<{ uploadURL: string; objectPath: string } | null> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setPendingFiles(prev => prev.map(f => 
            f.id === pendingFile.id ? { ...f, progress: attempt * 10, error: undefined } : f
          ));
        }

        const urlResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: pendingFile.file.name,
            relativePath: pendingFile.relativePath,
          }),
        });

        if (urlResponse.ok) {
          return await urlResponse.json();
        }

        if (urlResponse.status === 401) {
          triggerSessionExpired();
          throw new NonRetryableError("Your session has expired. Please log in again.");
        }

        const errorMessage = getUploadErrorMessage(urlResponse.status, 'Failed to prepare upload');
        
        if (!isRetryableError(urlResponse.status)) {
          throw new NonRetryableError(errorMessage);
        }

        lastError = new Error(errorMessage);
      } catch (error: any) {
        if (error instanceof NonRetryableError) {
          throw error;
        }
        
        lastError = error;
      }
      
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        toast.info(`Retrying upload... (attempt ${attempt + 2}/${maxRetries})`, {
          duration: waitTime - 200,
          id: `retry-${pendingFile.id}`,
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError || new Error("Failed to upload after multiple attempts. Please try again.");
  };

  const uploadWithFallback = async (pendingFile: PendingFile): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('file', pendingFile.file);
    if (pendingFile.relativePath) {
      formData.append('relativePath', pendingFile.relativePath);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setPendingFiles(prev => prev.map(f => 
            f.id === pendingFile.id ? { ...f, progress, status: 'uploading', error: undefined } : f
          ));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            // Use the data URL returned by the server (base64 encoded)
            const objectPath = result.url || result.content || `/uploads/${result.filename}`;
            
            setPendingFiles(prev => prev.map(f => 
              f.id === pendingFile.id ? { ...f, progress: 100, status: 'success', objectPath, error: undefined } : f
            ));

            resolve({
              id: result.id || pendingFile.id,
              filename: pendingFile.file.name,
              objectPath,
              size: pendingFile.file.size,
              type: pendingFile.file.type,
              relativePath: pendingFile.relativePath,
            });
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else if (xhr.status === 401) {
          triggerSessionExpired();
          reject(new Error("Your session has expired. Please log in again."));
        } else {
          reject(new Error(getUploadErrorMessage(xhr.status, `Upload failed (${xhr.status})`)));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error. Please check your internet connection and try again.'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out. Please try again with a stable connection.'));
      });

      xhr.timeout = 600000;
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  const uploadFile = async (pendingFile: PendingFile): Promise<UploadedFile | null> => {
    try {
      let result: { uploadURL: string; objectPath: string } | null = null;
      let useObjectStorage = true;

      try {
        result = await uploadFileWithRetry(pendingFile);
      } catch (error: any) {
        if (error.message?.includes('temporarily unavailable') || 
            error.message?.includes('500') ||
            error.message?.includes('Failed to sign object URL')) {
          console.log('Object storage unavailable, falling back to base64 upload');
          useObjectStorage = false;
        } else {
          throw error;
        }
      }
      
      if (!useObjectStorage || !result) {
        return await uploadWithFallback(pendingFile);
      }
      
      const { uploadURL, objectPath } = result;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setPendingFiles(prev => prev.map(f => 
              f.id === pendingFile.id ? { ...f, progress, status: 'uploading', error: undefined } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(getUploadErrorMessage(xhr.status, `Upload failed (${xhr.status})`)));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error. Please check your internet connection and try again.'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out. Please try again with a stable connection.'));
        });

        xhr.timeout = 600000;
        xhr.open('PUT', uploadURL);
        xhr.setRequestHeader('Content-Type', pendingFile.file.type || 'application/octet-stream');
        xhr.send(pendingFile.file);
      });

      const confirmResponse = await fetch('/api/objects/confirm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectPath,
          filename: pendingFile.file.name,
          size: pendingFile.file.size,
          type: pendingFile.file.type,
          relativePath: pendingFile.relativePath,
        }),
      });

      if (!confirmResponse.ok) {
        if (confirmResponse.status === 401) {
          triggerSessionExpired();
          throw new Error("Your session has expired. Please log in again.");
        }
        throw new Error(getUploadErrorMessage(confirmResponse.status, 'Failed to complete upload'));
      }

      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { ...f, progress: 100, status: 'success', objectPath, error: undefined } : f
      ));

      return {
        id: pendingFile.id,
        filename: pendingFile.file.name,
        objectPath,
        size: pendingFile.file.size,
        type: pendingFile.file.type,
        relativePath: pendingFile.relativePath,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed. Please try again.';
      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { ...f, status: 'error', error: errorMessage } : f
      ));
      return null;
    }
  };

  const uploadWithConcurrency = async (
    files: PendingFile[], 
    concurrency: number = 4
  ): Promise<UploadedFile[]> => {
    const uploadedFiles: UploadedFile[] = [];
    const queue = [...files];
    let activeCount = 0;
    let resolveAll: () => void;
    const allDone = new Promise<void>(resolve => { resolveAll = resolve; });
    
    const checkCompletion = () => {
      if (queue.length > 0) {
        processNext();
      } else if (activeCount === 0) {
        resolveAll();
      }
    };
    
    const processNext = () => {
      while (activeCount < concurrency && queue.length > 0) {
        const file = queue.shift()!;
        activeCount++;
        
        setPendingFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'uploading', progress: 0, error: undefined } : f
        ));
        
        uploadFile(file)
          .then(result => {
            if (result) {
              uploadedFiles.push(result);
            }
          })
          .catch(() => {
            // Error already handled in uploadFile, just continue
          })
          .finally(() => {
            activeCount--;
            checkCompletion();
          });
      }
      
      if (queue.length === 0 && activeCount === 0) {
        resolveAll();
      }
    };
    
    processNext();
    await allDone;
    return uploadedFiles;
  };

  const handleUpload = async () => {
    const filesToUpload = pendingFiles.filter(f => f.status === 'pending' || f.status === 'error');
    if (filesToUpload.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setIsUploading(true);
    
    if (filesToUpload.length > 5) {
      toast.info(`Uploading ${filesToUpload.length} files with parallel processing...`, { duration: 3000 });
    }
    
    const uploadedFiles = await uploadWithConcurrency(filesToUpload, 4);

    setIsUploading(false);

    const errorCount = pendingFiles.filter(f => f.status === 'error').length;
    
    if (uploadedFiles.length > 0) {
      onComplete?.(uploadedFiles);
      if (errorCount > 0) {
        toast.success(`${uploadedFiles.length} file(s) uploaded. ${errorCount} failed - you can retry them.`);
      } else {
        toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
        setTimeout(() => {
          setShowModal(false);
          setPendingFiles([]);
        }, 1000);
      }
    } else {
      toast.error('Upload failed. Please check the errors and try again.');
      onError?.(new Error('All uploads failed'));
    }
  };

  const retryFailedFile = async (fileId: string) => {
    const file = pendingFiles.find(f => f.id === fileId);
    if (!file || file.status !== 'error') return;

    setIsUploading(true);
    setPendingFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'uploading', progress: 0, error: undefined } : f
    ));

    const result = await uploadFile(file);
    setIsUploading(false);

    if (result) {
      onComplete?.([result]);
      toast.success(`${file.file.name} uploaded successfully`);
    }
  };

  const retryAllFailed = async () => {
    const failedFiles = pendingFiles.filter(f => f.status === 'error');
    if (failedFiles.length === 0) return;

    setIsUploading(true);
    
    const uploadedFiles = await uploadWithConcurrency(failedFiles, 4);

    setIsUploading(false);

    if (uploadedFiles.length > 0) {
      onComplete?.(uploadedFiles);
      toast.success(`${uploadedFiles.length} file(s) uploaded on retry`);
    }
  };

  const [isProcessingDrop, setIsProcessingDrop] = useState(false);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsProcessingDrop(true);
    
    try {
      // Use folder extraction to recursively get files from dropped folders
      const filesWithPaths = await extractFilesFromDataTransfer(e.dataTransfer);
      if (filesWithPaths.length > 0) {
        addFilesWithPaths(filesWithPaths);
        const folderCount = filesWithPaths.filter(f => f.relativePath.includes('/')).length;
        if (folderCount > 0) {
          toast.success(`Found ${filesWithPaths.length} files from folders`);
        } else if (filesWithPaths.length > 1) {
          toast.success(`Added ${filesWithPaths.length} files`);
        }
      } else {
        toast.error('No files found in the dropped item');
      }
    } catch (err) {
      console.error('Error processing drop:', err);
      toast.error('Error processing dropped files. Please try again or use the Browse button.');
      // Fallback to regular files
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        addFiles(files);
      }
    } finally {
      setIsProcessingDrop(false);
    }
  }, [addFilesWithPaths, addFiles]);

  const handleClose = () => {
    if (!isUploading) {
      setShowModal(false);
      setPendingFiles([]);
    }
  };

  const pendingCount = pendingFiles.filter(f => f.status === 'pending').length;
  const uploadingCount = pendingFiles.filter(f => f.status === 'uploading').length;
  const successCount = pendingFiles.filter(f => f.status === 'success').length;
  const errorCount = pendingFiles.filter(f => f.status === 'error').length;

  return (
    <>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        variant={buttonVariant}
        size={buttonSize}
        disabled={disabled}
        type="button"
        data-testid="button-object-upload"
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload files up to {formatFileSize(maxFileSize)} each. Maximum {maxNumberOfFiles} files.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            } ${isProcessingDrop ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {isProcessingDrop ? 'Processing files...' : 'Drag and drop files or folders here'}
            </p>
            <p className="text-xs text-muted-foreground/70 mb-2">
              Tip: When using "Browse Folder", navigate inside the folder to select its contents
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-upload"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-ignore - webkitdirectory is a valid attribute for folder selection
              webkitdirectory=""
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const filesWithPaths = extractFilesFromFileList(files);
                  addFilesWithPaths(filesWithPaths);
                  if (filesWithPaths.length > 1) {
                    toast.success(`Selected ${filesWithPaths.length} files from folder`);
                  }
                }
                e.target.value = '';
              }}
              className="hidden"
              data-testid="input-folder-upload"
            />
            <div className="flex gap-2 justify-center">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isProcessingDrop || pendingFiles.length >= maxNumberOfFiles}
                data-testid="button-browse-files"
              >
                <FileIcon className="w-4 h-4 mr-1" />
                Browse Files
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                disabled={isUploading || isProcessingDrop || pendingFiles.length >= maxNumberOfFiles}
                data-testid="button-browse-folder"
              >
                <FolderOpen className="w-4 h-4 mr-1" />
                Browse Folder
              </Button>
            </div>
          </div>

          {pendingFiles.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pendingFiles.map((pf) => (
                <div 
                  key={pf.id} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  data-testid={`file-item-${pf.id}`}
                >
                  <div className="flex-shrink-0">
                    {pf.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : pf.status === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    ) : pf.status === 'uploading' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={pf.relativePath || pf.file.name}>{pf.relativePath || pf.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(pf.file.size)}</p>
                    {pf.status === 'uploading' && (
                      <Progress value={pf.progress} className="h-1 mt-1" />
                    )}
                    {pf.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">{pf.error}</p>
                    )}
                  </div>
                  {pf.status === 'pending' && !isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => removeFile(pf.id)}
                      data-testid={`button-remove-file-${pf.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {pf.status === 'error' && !isUploading && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => retryFailedFile(pf.id)}
                        title="Retry upload"
                        data-testid={`button-retry-file-${pf.id}`}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(pf.id)}
                        data-testid={`button-remove-failed-file-${pf.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {pendingFiles.length} file(s) selected
              {successCount > 0 && ` • ${successCount} uploaded`}
              {errorCount > 0 && <span className="text-destructive"> • {errorCount} failed</span>}
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isUploading}
                data-testid="button-cancel-upload"
              >
                {successCount > 0 && pendingCount === 0 && errorCount === 0 ? 'Done' : 'Cancel'}
              </Button>
              {errorCount > 0 && !isUploading && (
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={retryAllFailed}
                  disabled={isUploading}
                  data-testid="button-retry-all-failed"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry {errorCount} Failed
                </Button>
              )}
              {pendingCount > 0 && (
                <Button 
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading || pendingCount === 0}
                  data-testid="button-start-upload"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {pendingCount} File{pendingCount > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { UploadedFile };

import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { X, Upload, FileIcon, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  filename: string;
  objectPath: string;
  size: number;
  type: string;
}

interface PendingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  objectPath?: string;
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
  maxNumberOfFiles = 10,
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
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addFiles(Array.from(files));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [maxNumberOfFiles, maxFileSize, allowedFileTypes]);

  const addFiles = useCallback((files: File[]) => {
    const currentCount = pendingFiles.length;
    const availableSlots = maxNumberOfFiles - currentCount;
    
    if (availableSlots <= 0) {
      toast.error(`Maximum of ${maxNumberOfFiles} files allowed`);
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    const newPendingFiles: PendingFile[] = [];

    for (const file of filesToAdd) {
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
      });
    }

    if (newPendingFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newPendingFiles]);
    }
  }, [pendingFiles.length, maxNumberOfFiles, maxFileSize, allowedFileTypes]);

  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const uploadFile = async (pendingFile: PendingFile): Promise<UploadedFile | null> => {
    try {
      // Get presigned URL
      const urlResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: pendingFile.file.name }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, objectPath } = await urlResponse.json();

      // Upload file using XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setPendingFiles(prev => prev.map(f => 
              f.id === pendingFile.id ? { ...f, progress, status: 'uploading' } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadURL);
        xhr.setRequestHeader('Content-Type', pendingFile.file.type || 'application/octet-stream');
        xhr.send(pendingFile.file);
      });

      // Confirm upload
      const confirmResponse = await fetch('/api/objects/confirm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectPath,
          filename: pendingFile.file.name,
          size: pendingFile.file.size,
          type: pendingFile.file.type,
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { ...f, progress: 100, status: 'success', objectPath } : f
      ));

      return {
        id: pendingFile.id,
        filename: pendingFile.file.name,
        objectPath,
        size: pendingFile.file.size,
        type: pendingFile.file.type,
      };
    } catch (error: any) {
      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { ...f, status: 'error', error: error.message } : f
      ));
      return null;
    }
  };

  const handleUpload = async () => {
    const filesToUpload = pendingFiles.filter(f => f.status === 'pending');
    if (filesToUpload.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setIsUploading(true);
    const uploadedFiles: UploadedFile[] = [];

    for (const file of filesToUpload) {
      setPendingFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading' } : f
      ));

      const result = await uploadFile(file);
      if (result) {
        uploadedFiles.push(result);
      }
    }

    setIsUploading(false);

    if (uploadedFiles.length > 0) {
      onComplete?.(uploadedFiles);
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
      
      // Close modal and clear files after successful upload
      setTimeout(() => {
        setShowModal(false);
        setPendingFiles([]);
      }, 1000);
    } else {
      onError?.(new Error('All uploads failed'));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleClose = () => {
    if (!isUploading) {
      setShowModal(false);
      setPendingFiles([]);
    }
  };

  const pendingCount = pendingFiles.filter(f => f.status === 'pending').length;
  const uploadingCount = pendingFiles.filter(f => f.status === 'uploading').length;
  const successCount = pendingFiles.filter(f => f.status === 'success').length;

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
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop files here, or click to browse
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
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || pendingFiles.length >= maxNumberOfFiles}
              data-testid="button-browse-files"
            >
              Browse Files
            </Button>
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
                    <p className="text-sm font-medium truncate">{pf.file.name}</p>
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
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {pendingFiles.length} file(s) selected
              {successCount > 0 && ` • ${successCount} uploaded`}
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isUploading}
                data-testid="button-cancel-upload"
              >
                {successCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
              </Button>
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

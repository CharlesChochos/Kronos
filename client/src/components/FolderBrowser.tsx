import { useState, useMemo } from "react";
import { Folder, FolderOpen, FileText, ChevronRight, Download, Trash2, Eye, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface FileItem {
  id: string;
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  relativePath?: string;
}

interface FolderNode {
  name: string;
  path: string;
  files: FileItem[];
  folders: Map<string, FolderNode>;
}

interface FolderBrowserProps {
  files: FileItem[];
  onView?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function buildFolderTree(files: FileItem[]): FolderNode {
  const root: FolderNode = {
    name: "",
    path: "",
    files: [],
    folders: new Map()
  };

  for (const file of files) {
    const relativePath = file.relativePath || file.filename;
    const parts = relativePath.split('/');
    
    if (parts.length === 1) {
      root.files.push(file);
    } else {
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const folderPath = parts.slice(0, i + 1).join('/');
        
        if (!current.folders.has(folderName)) {
          current.folders.set(folderName, {
            name: folderName,
            path: folderPath,
            files: [],
            folders: new Map()
          });
        }
        current = current.folders.get(folderName)!;
      }
      current.files.push(file);
    }
  }

  return root;
}

function countFilesInFolder(folder: FolderNode): number {
  let count = folder.files.length;
  Array.from(folder.folders.values()).forEach((subFolder) => {
    count += countFilesInFolder(subFolder);
  });
  return count;
}

function countFoldersInFolder(folder: FolderNode): number {
  return folder.folders.size;
}

function FolderCard({
  folder,
  onNavigate,
}: {
  folder: FolderNode;
  onNavigate: (folder: FolderNode) => void;
}) {
  const totalFiles = countFilesInFolder(folder);
  const subfolderCount = countFoldersInFolder(folder);
  
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-all border border-border/50 hover:border-primary/30 group"
      onClick={() => onNavigate(folder)}
      data-testid={`folder-card-${folder.name}`}
    >
      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
        <Folder className="h-5 w-5 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate" title={folder.name}>{folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {subfolderCount > 0 && `${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}, `}
          {totalFiles} file{totalFiles !== 1 ? 's' : ''}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
  );
}

function FileCard({
  file,
  onView,
  onDownload,
  onDelete,
}: {
  file: FileItem;
  onView?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
}) {
  const fileName = file.relativePath?.split('/').pop() || file.filename;
  const sizeDisplay = file.size != null ? formatFileSize(file.size) : '';
  const dateDisplay = file.uploadedAt ? format(new Date(file.uploadedAt), 'PP') : '';
  const metaDisplay = [sizeDisplay, dateDisplay].filter(Boolean).join(' • ');
  
  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return 'text-red-400';
    if (['doc', 'docx'].includes(ext || '')) return 'text-blue-400';
    if (['xls', 'xlsx'].includes(ext || '')) return 'text-green-400';
    if (['ppt', 'pptx'].includes(ext || '')) return 'text-orange-400';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'text-purple-400';
    return 'text-primary';
  };
  
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-border transition-all group"
      data-testid={`file-card-${file.id}`}
    >
      <div className={cn("w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0")}>
        <FileText className={cn("h-5 w-5", getFileIcon())} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
        {metaDisplay && <p className="text-xs text-muted-foreground">{metaDisplay}</p>}
      </div>
      <div className="flex gap-1">
        {onView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-60 hover:opacity-100"
            onClick={() => onView(file)}
            title="View"
            data-testid={`view-file-${file.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-60 hover:opacity-100"
            onClick={() => onDownload(file)}
            title="Download"
            data-testid={`download-file-${file.id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive opacity-60 hover:opacity-100 hover:text-destructive"
            onClick={() => onDelete(file)}
            title="Delete"
            data-testid={`delete-file-${file.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function FolderBrowser({
  files,
  onView,
  onDownload,
  onDelete,
  className = "",
}: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  const folderTree = useMemo(() => buildFolderTree(files), [files]);

  const currentFolder = useMemo(() => {
    let folder = folderTree;
    for (const pathPart of currentPath) {
      const next = folder.folders.get(pathPart);
      if (next) {
        folder = next;
      } else {
        break;
      }
    }
    return folder;
  }, [folderTree, currentPath]);

  const navigateToFolder = (folder: FolderNode) => {
    if (folder.path) {
      setCurrentPath(folder.path.split('/'));
    } else {
      setCurrentPath([]);
    }
  };

  const navigateToRoot = () => {
    setCurrentPath([]);
  };

  const navigateToPathIndex = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const handleView = (file: FileItem) => {
    if (onView) {
      onView(file);
    } else {
      window.open(file.url, '_blank');
    }
  };

  const handleDownload = (file: FileItem) => {
    if (onDownload) {
      onDownload(file);
    } else {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete && onDelete) {
      onDelete(fileToDelete);
    }
    setFileToDelete(null);
  };

  const hasContent = files.length > 0;
  const hasNestedFolders = folderTree.folders.size > 0;
  const currentFolders = Array.from(currentFolder.folders.values());
  const currentFiles = currentFolder.files;
  const isInSubfolder = currentPath.length > 0;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {(hasNestedFolders || isInSubfolder) && (
        <div className="flex items-center gap-1 mb-4 pb-3 border-b border-border overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateToRoot}
            className={cn(
              "gap-1 shrink-0 h-7 px-2",
              !isInSubfolder && "text-foreground font-medium"
            )}
            data-testid="breadcrumb-root"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Files</span>
          </Button>
          
          {currentPath.map((part, index) => (
            <div key={index} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToPathIndex(index)}
                className={cn(
                  "h-7 px-2 max-w-[120px]",
                  index === currentPath.length - 1 && "text-foreground font-medium"
                )}
                title={part}
                data-testid={`breadcrumb-${index}`}
              >
                <span className="truncate">{part}</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="max-h-[450px]">
        <div className="space-y-2">
          {currentFolders.length > 0 && (
            <div className="space-y-2">
              {currentFolders.map((folder) => (
                <FolderCard
                  key={folder.path}
                  folder={folder}
                  onNavigate={navigateToFolder}
                />
              ))}
            </div>
          )}
          
          {currentFolders.length > 0 && currentFiles.length > 0 && (
            <div className="border-t border-border/50 my-3" />
          )}

          {currentFiles.length > 0 && (
            <div className="space-y-2">
              {currentFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onView={handleView}
                  onDownload={handleDownload}
                  onDelete={onDelete ? () => setFileToDelete(file) : undefined}
                />
              ))}
            </div>
          )}

          {currentFolders.length === 0 && currentFiles.length === 0 && isInSubfolder && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">This folder is empty</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

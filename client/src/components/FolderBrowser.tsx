import { useState, useMemo } from "react";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Download, Trash2, Eye, ArrowLeft } from "lucide-react";
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

function FolderItem({ 
  folder, 
  onNavigate,
  depth = 0 
}: { 
  folder: FolderNode; 
  onNavigate: (folder: FolderNode) => void;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalFiles = countFilesInFolder(folder);
  
  return (
    <div>
      <div 
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onNavigate(folder)}
        data-testid={`folder-item-${folder.name}`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        {isExpanded ? (
          <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
        ) : (
          <Folder className="h-5 w-5 text-amber-500 shrink-0" />
        )}
        <span className="font-medium truncate flex-1">{folder.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {totalFiles} file{totalFiles !== 1 ? 's' : ''}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {isExpanded && (
        <div className="ml-4">
          {Array.from(folder.folders.values()).map((subFolder) => (
            <FolderItem
              key={subFolder.path}
              folder={subFolder}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countFilesInFolder(folder: FolderNode): number {
  let count = folder.files.length;
  Array.from(folder.folders.values()).forEach((subFolder) => {
    count += countFilesInFolder(subFolder);
  });
  return count;
}

function FileItemRow({
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
  
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors group"
      data-testid={`file-item-${file.id}`}
    >
      <FileText className="h-5 w-5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
        {metaDisplay && <p className="text-xs text-muted-foreground">{metaDisplay}</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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
            className="h-8 w-8"
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
            className="h-8 w-8 text-destructive hover:text-destructive"
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
    }
  };

  const navigateUp = () => {
    setCurrentPath(prev => prev.slice(0, -1));
  };

  const navigateToRoot = () => {
    setCurrentPath([]);
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

  const hasNestedContent = folderTree.folders.size > 0;
  const isInSubfolder = currentPath.length > 0;

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {hasNestedContent && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
          {isInSubfolder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateUp}
              className="gap-1"
              data-testid="button-navigate-up"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
            <button 
              onClick={navigateToRoot}
              className="hover:text-foreground transition-colors"
              data-testid="breadcrumb-root"
            >
              Root
            </button>
            {currentPath.map((part, index) => (
              <span key={index} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  className="hover:text-foreground transition-colors truncate max-w-[100px]"
                  title={part}
                  data-testid={`breadcrumb-${index}`}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-1">
          {!isInSubfolder && Array.from(currentFolder.folders.values()).map((folder) => (
            <FolderItem
              key={folder.path}
              folder={folder}
              onNavigate={navigateToFolder}
            />
          ))}
          
          {isInSubfolder && Array.from(currentFolder.folders.values()).map((folder) => (
            <div
              key={folder.path}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors"
              onClick={() => navigateToFolder(folder)}
              data-testid={`subfolder-${folder.name}`}
            >
              <Folder className="h-5 w-5 text-amber-500 shrink-0" />
              <span className="font-medium flex-1 truncate">{folder.name}</span>
              <span className="text-xs text-muted-foreground">
                {countFilesInFolder(folder)} files
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}

          {currentFolder.files.map((file) => (
            <FileItemRow
              key={file.id}
              file={file}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={onDelete ? () => setFileToDelete(file) : undefined}
            />
          ))}
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

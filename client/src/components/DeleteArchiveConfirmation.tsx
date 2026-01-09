import { Archive, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteArchiveConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: "deal" | "opportunity" | "asset";
  itemName?: string;
  onArchive: () => void;
  onDelete: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
}

const ITEM_LABELS: Record<string, string> = {
  deal: "deal",
  opportunity: "opportunity",
  asset: "asset",
};

export function DeleteArchiveConfirmation({
  open,
  onOpenChange,
  itemType,
  itemName,
  onArchive,
  onDelete,
  isArchiving = false,
  isDeleting = false,
}: DeleteArchiveConfirmationProps) {
  const itemLabel = ITEM_LABELS[itemType] || itemType;
  const title = itemName ? `Delete "${itemName}"?` : `Delete ${itemLabel}?`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Trash2 className="w-5 h-5 text-destructive flex-shrink-0" />
            <span>{title}</span>
          </AlertDialogTitle>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <Archive className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500 text-sm">Archive (Recommended)</p>
                <p className="text-sm text-foreground/80 mt-1">
                  Preserves all documents, notes, and data. You can restore it anytime from the archived items.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive text-sm">Delete Permanently</p>
                <p className="text-sm text-foreground/80 mt-1">
                  This action cannot be undone. All associated data including team members, investors, and documents will be removed.
                </p>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="sm:mr-auto" data-testid="button-cancel-delete">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
            onClick={onArchive}
            disabled={isArchiving || isDeleting}
            data-testid="button-archive-instead"
          >
            <Archive className="w-4 h-4 mr-2" />
            {isArchiving ? "Archiving..." : "Archive"}
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isArchiving || isDeleting}
            data-testid="button-permanent-delete"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import React from "react";
import GridLayout, { Layout, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { cn } from "@/lib/utils";

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface DraggableGridLayoutProps {
  children: React.ReactNode[];
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
  cols?: number;
  rowHeight?: number;
  className?: string;
  isDraggable?: boolean;
  isResizable?: boolean;
  margin?: [number, number];
  containerPadding?: [number, number];
  compactType?: "vertical" | "horizontal" | null;
}

export default function DraggableGridLayout({
  children,
  layout,
  onLayoutChange,
  cols = 12,
  rowHeight = 30,
  className = "",
  isDraggable = true,
  isResizable = true,
  margin = [16, 16],
  containerPadding = [0, 0],
  compactType = "vertical",
}: DraggableGridLayoutProps) {
  return (
    <ResponsiveGridLayout
      className={cn("layout", className)}
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      onLayoutChange={onLayoutChange}
      isDraggable={isDraggable}
      isResizable={isResizable}
      margin={margin}
      containerPadding={containerPadding}
      compactType={compactType}
      useCSSTransforms={true}
      draggableHandle=".drag-handle"
      resizeHandles={["se", "sw", "ne", "nw", "e", "w", "n", "s"]}
    >
      {children}
    </ResponsiveGridLayout>
  );
}

export function DragHandle({ className = "" }: { className?: string }) {
  return (
    <div 
      className={cn(
        "drag-handle cursor-move opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted/50 rounded",
        className
      )}
    >
      <svg 
        className="w-4 h-4 text-muted-foreground"
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
      </svg>
    </div>
  );
}

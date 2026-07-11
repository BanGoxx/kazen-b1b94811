import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Base "pill" utility comes from styles.css; tones map to semantic tokens only.
const pillVariants = cva("pill border transition-colors", {
  variants: {
    tone: {
      neutral: "border-border bg-muted text-muted-foreground",
      primary: "border-primary/30 bg-primary/12 text-primary",
      accent: "border-accent/30 bg-accent/12 text-accent",
      success: "border-chart-2/30 bg-chart-2/12 text-chart-2",
      warning: "border-chart-4/30 bg-chart-4/15 text-chart-4",
      danger: "border-destructive/30 bg-destructive/12 text-destructive",
      outline: "border-border bg-transparent text-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {}

export function Pill({ className, tone, ...props }: PillProps) {
  return <span className={cn(pillVariants({ tone }), className)} {...props} />;
}

export { pillVariants };

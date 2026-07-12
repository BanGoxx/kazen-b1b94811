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
      success: "border-success/30 bg-success/12 text-success",
      warning: "border-warning/35 bg-warning/15 text-warning",
      info: "border-info/30 bg-info/12 text-info",
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

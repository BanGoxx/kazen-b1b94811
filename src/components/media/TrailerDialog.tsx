import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TrailerDialog({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="premium" size="lg" className="gap-2">
          <Play className="h-4 w-4 fill-current" /> Bande-annonce
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full">
          {open ? (
            <iframe
              src={`${url}?autoplay=1`}
              title={`Bande-annonce de ${title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

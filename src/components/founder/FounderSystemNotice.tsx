import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSystemNotice } from "@/lib/use-notifications";

// Owner-only composer. The server RPC enforces the owner role and, in Phase 1,
// delivers the notice to the calling owner only (no mass broadcast yet).
export function FounderSystemNotice() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("/notifications");
  const create = useCreateSystemNotice();

  const submit = () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Titre et message requis.");
      return;
    }
    create.mutate(
      { title: title.trim(), message: message.trim(), destinationUrl: destination.trim() || "/notifications" },
      {
        onSuccess: () => {
          toast.success("Annonce créée (visible dans vos notifications).");
          setTitle("");
          setMessage("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Échec de la création."),
      },
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Annonce KAZEN</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Crée une notification « Annonce KAZEN » de confiance. En Phase 1, elle est
        délivrée à votre propre compte (aperçu) — la diffusion à tous les membres
        arrivera dans une phase ultérieure.
      </p>
      <div className="space-y-3">
        <Input
          placeholder="Titre de l'annonce"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder="Message"
          value={message}
          maxLength={500}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Input
          placeholder="Lien interne (ex. /notifications)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>
      <Button onClick={submit} disabled={create.isPending} variant="aurora" className="gap-2">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        Créer l'annonce
      </Button>
    </section>
  );
}

import { useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { setAcceptsChat } from "@/lib/chat.functions";
import { getMyProfile } from "@/lib/list.functions";
import { useServerFn } from "@tanstack/react-start";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/** Member setting: allow or block new incoming private-chat requests. */
export function ChatPreference() {
  const { user } = useAuth();
  const [accepts, setAccepts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(setAcceptsChat);
  const loadProfile = useServerFn(getMyProfile);

  useEffect(() => {
    let active = true;
    if (!user) return;
    // accepts_chat is owner-only; read it via the owner profile RPC.
    loadProfile()
      .then((data) => {
        if (active && data) setAccepts(data.accepts_chat ?? true);
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, loadProfile]);


  const onToggle = async (next: boolean) => {
    setAccepts(next);
    setSaving(true);
    try {
      await save({ data: { accepts: next } });
    } catch {
      setAccepts(!next);
      toast.error("La préférence n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="chat"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Messages privés</h2>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="accepts-chat" className="text-sm font-medium">
            Autoriser les demandes de discussion
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Lorsque désactivé, les autres membres ne peuvent pas t'envoyer de
            nouvelle demande de conversation privée.
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            id="accepts-chat"
            checked={accepts}
            disabled={saving}
            onCheckedChange={onToggle}
            aria-label="Autoriser les demandes de discussion"
          />
        )}
      </div>
    </section>
  );
}

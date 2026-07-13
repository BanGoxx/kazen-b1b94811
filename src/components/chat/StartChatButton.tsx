import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useChatMutations } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * Reusable entry point to open (or request) a private 1:1 conversation with
 * another member. Identity is derived server-side from auth.uid(); the target
 * id is the only client input and is validated + eligibility-checked by the
 * request_conversation RPC (self-chat, blocks, accepts_chat all enforced there).
 */
export function StartChatButton({
  targetUserId,
  targetName,
  variant = "outline",
  size = "sm",
  className,
  label = "Message",
}: {
  targetUserId: string;
  targetName?: string | null;
  variant?: "outline" | "ghost" | "aurora" | "secondary";
  size?: "sm" | "icon" | "default";
  className?: string;
  label?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requestMut } = useChatMutations();
  const [pending, setPending] = useState(false);

  // Never offer to message yourself.
  if (!user || user.id === targetUserId) return null;

  const handleClick = async () => {
    setPending(true);
    try {
      const res = await requestMut.mutateAsync(targetUserId);
      navigate({ to: "/messages", search: { c: res.id } });
    } catch {
      // error toast handled by mutation; keep a fallback
      if (!requestMut.isError) {
        toast.error("Impossible d'ouvrir la conversation.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={pending}
      onClick={handleClick}
      aria-label={
        targetName ? `Envoyer un message à ${targetName}` : "Envoyer un message"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      {size !== "icon" && <span className="ml-1.5">{label}</span>}
    </Button>
  );
}

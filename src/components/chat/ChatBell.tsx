import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useChatUnreadCount } from "@/lib/chat";

/** Header entry point to private messages, with an unread/request badge. */
export function ChatBell() {
  const { user } = useAuth();
  const count = useChatUnreadCount();
  if (!user) return null;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={
        count > 0 ? `Messages, ${count} non lus` : "Messages privés"
      }
      title="Messages privés"
    >
      <Link to="/messages" search={{ c: undefined }}>
        <MessageCircle className="h-5 w-5" />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Compass,
  Wand2,
  Sparkles,
  Tv,
  Film,
  CalendarDays,
  CalendarClock,
  Search,
  Leaf,
  ListChecks,
  ListMusic,
  LogOut,
  UserRound,
  Heart,
  Menu,
  X,
  ShieldCheck,
  Crown,
  DownloadCloud,

} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KazenLogo } from "@/components/brand/KazenLogo";
import { SearchAutocomplete } from "@/components/media/SearchAutocomplete";
import { RecommendationAssistant } from "@/components/media/RecommendationAssistant";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { signOut, useAuth } from "@/lib/auth";
import { useIsModerator } from "@/lib/use-moderator";
import { useIsOwner } from "@/lib/founder";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Compass;
  /** Only shown to authenticated members (also enforced server-side + RLS). */
  memberOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Découverte", icon: Compass },
  { to: "/pour-vous", label: "Pour vous", icon: Wand2 },
  { to: "/anime", label: "Anime", icon: Sparkles },
  { to: "/series", label: "Séries", icon: Tv },
  { to: "/films", label: "Films", icon: Film },
  { to: "/anime/saison", label: "Saison anime", icon: Leaf },
  { to: "/a-venir", label: "À venir", icon: CalendarClock },
  { to: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/recherche", label: "Recherche", icon: Search },
  { to: "/mes-listes", label: "Mes listes", icon: ListChecks },
  { to: "/listes", label: "Listes partagées", icon: ListMusic },
  { to: "/mes-playlists", label: "Mes playlists", icon: ListMusic },
  { to: "/import", label: "Importer", icon: DownloadCloud, memberOnly: true },

  { to: "/soutien", label: "Soutien", icon: Heart },
];

function AuthMenu() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  if (!ready) return null;

  if (!user) {
    return (
      <Button asChild variant="aurora" size="sm">
        <Link to="/auth" search={{ redirect: undefined }}>
          Se connecter
        </Link>
      </Button>
    );
  }

  const initial = (user.email ?? "N").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="focus-ring flex items-center gap-2 rounded-full"
          aria-label="Menu du compte"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata?.avatar_url as string | undefined} alt="" />
            <AvatarFallback className="aurora-bg text-xs text-white">{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/mes-listes" className="gap-2">
            <ListChecks className="h-4 w-4" /> Mes listes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profil" className="gap-2">
            <UserRound className="h-4 w-4" /> Mon profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/soutien" className="gap-2">
            <Heart className="h-4 w-4" /> Soutien
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  return (
    <Link to="/" className="focus-ring flex items-center gap-2 rounded-lg" aria-label="KAZEN — accueil">
      <KazenLogo size="md" />
      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary">
        Bêta
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isModerator = useIsModerator();
  const isOwner = useIsOwner();
  const { user } = useAuth();
  const base = NAV.filter((item) => !item.memberOnly || Boolean(user));
  // Owner gets the unified "Espace fondateur" (which embeds Modération).
  // Non-owner moderators (future, post-beta) keep the direct Modération link.
  const items = isOwner
    ? [...base, { to: "/fondateur", label: "Espace fondateur", icon: Crown }]
    : isModerator
      ? [...base, { to: "/moderation", label: "Modération", icon: ShieldCheck }]
      : base;
  return (
    <nav aria-label="Navigation principale">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    active ? "aurora-bg text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      {/* Ambient glows */}
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none fixed -top-40 right-0 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.585 0.2 28 / 0.16), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none fixed -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.85 0.055 85 / 0.08), transparent)", animationDelay: "2.5s" }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="glass sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border px-4 py-6 lg:flex">
          <div className="px-2">
            <Brand />
          </div>
          <div className="mt-8 flex-1 overflow-y-auto no-scrollbar">
            <NavLinks />
          </div>
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <button
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            />
            <div className="glass absolute left-0 top-0 h-full w-72 border-r border-sidebar-border px-4 py-6 animate-fade-in">
              <div className="flex items-center justify-between px-2">
                <Brand />
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fermer">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-8">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="lg:hidden">
                <Brand />
              </div>
            </div>
            {/* Fast keyword search — always visible on desktop */}
            <div className="mx-2 hidden max-w-md flex-1 md:block lg:mr-4">
              <SearchAutocomplete
                showExploreButton={false}
                placeholder="Rechercher un anime, une série, un film…"
                inputClassName="h-10"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Recherche">
                <Link to="/recherche">
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
              <RecommendationAssistant
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Ouvrir l'assistant KAZEN" title="Assistant">
                    <Wand2 className="h-5 w-5 text-primary" />
                  </Button>
                }
              />
              <ThemeToggle />
              <AuthMenu />
            </div>

          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>

          <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            <p>
              <span className="brand-wordmark font-display text-sm font-bold">KAZEN</span> — Tes anime, séries et films. Enfin au même endroit.
            </p>
            <p className="mt-1 text-xs">Données : AniList &amp; TMDB.</p>
          </footer>
        </div>
        <AssistantChat />
      </div>
    </div>
  );
}

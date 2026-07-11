import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Compass,
  Sparkles,
  Tv,
  Film,
  CalendarDays,
  CalendarClock,
  Search,
  Leaf,
  ListChecks,
  LogOut,
  UserRound,
  Menu,
  X,
  Hexagon,
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
import { signOut, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Compass;
}

const NAV: NavItem[] = [
  { to: "/", label: "Découverte", icon: Compass },
  { to: "/anime", label: "Anime", icon: Sparkles },
  { to: "/series", label: "Séries", icon: Tv },
  { to: "/films", label: "Films", icon: Film },
  { to: "/anime/saison", label: "Saison anime", icon: Leaf },
  { to: "/a-venir", label: "À venir", icon: CalendarClock },
  { to: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/recherche", label: "Recherche", icon: Search },
  { to: "/mes-listes", label: "Mes listes", icon: ListChecks },
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
    <Link to="/" className="flex items-center gap-2.5" aria-label="KAZEN — accueil">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl aurora-bg shadow-[var(--shadow-glow)]">
        <Hexagon className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight">
        <span className="aurora-text">KAZEN</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Navigation principale">
      <ul className="space-y-1">
        {NAV.map((item) => {
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
        style={{ background: "radial-gradient(closest-side, oklch(0.66 0.24 300 / 0.18), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none fixed -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.78 0.14 200 / 0.14), transparent)", animationDelay: "2.5s" }}
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
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" aria-label="Recherche">
                <Link to="/recherche">
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
              <ThemeToggle />
              <AuthMenu />
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>

          <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            <p>
              <span className="font-display font-bold aurora-text">KAZEN</span> — Découvrez, suivez, organisez.
            </p>
            <p className="mt-1 text-xs">Données : AniList &amp; TMDB.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

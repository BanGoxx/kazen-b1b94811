import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  X,
  Languages,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Aperçu" },
      {
        name: "description",
        content:
          "Suivez vos indicateurs clés, vos revenus et votre activité en un coup d'œil.",
      },
      { property: "og:title", content: "Tableau de bord — Aperçu" },
      {
        property: "og:description",
        content:
          "Suivez vos indicateurs clés, vos revenus et votre activité en un coup d'œil.",
      },
    ],
  }),
  component: Dashboard,
});

type Lang = "fr" | "en";

const t = {
  fr: {
    brand: "Acme Inc",
    nav: {
      overview: "Aperçu",
      customers: "Clients",
      revenue: "Revenus",
      analytics: "Analytique",
    },
    headerTitle: "Aperçu",
    headerSubtitle: "Bon retour, voici ce qui se passe aujourd'hui.",
    keyMetrics: "Indicateurs clés",
    fromLastMonth: " par rapport au mois dernier",
    revenueOverview: "Aperçu des revenus",
    recentActivity: "Activité récente",
    chartAlt:
      "Graphique à barres des revenus mensuels en hausse sur l'année",
    stats: [
      "Revenu total",
      "Utilisateurs actifs",
      "Taux de conversion",
      "Sessions actives",
    ],
    months: [
      "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
      "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
    ],
    activity: [
      { name: "Olivia Martin", action: "a créé un nouveau projet", time: "il y a 2 min" },
      { name: "Jackson Lee", action: "est passé au forfait Pro", time: "il y a 1 h" },
      { name: "Isabella Nguyen", action: "a invité 3 membres d'équipe", time: "il y a 3 h" },
      { name: "William Kim", action: "a clôturé un ticket de support", time: "il y a 5 h" },
      { name: "Sofia Davis", action: "a publié un rapport", time: "il y a 1 j" },
    ],
    toggleLabel: "Passer en anglais",
    langShort: "EN",
    primaryNav: "Navigation principale",
    openMenu: "Ouvrir le menu de navigation",
    closeMenu: "Fermer le menu de navigation",
    menuLabel: "Menu de navigation",
  },
  en: {
    brand: "Acme Inc",
    nav: {
      overview: "Overview",
      customers: "Customers",
      revenue: "Revenue",
      analytics: "Analytics",
    },
    headerTitle: "Overview",
    headerSubtitle: "Welcome back, here's what's happening today.",
    keyMetrics: "Key metrics",
    fromLastMonth: " from last month",
    revenueOverview: "Revenue overview",
    recentActivity: "Recent activity",
    chartAlt: "Bar chart of monthly revenue trending upward across the year",
    stats: [
      "Total Revenue",
      "Active Users",
      "Conversion Rate",
      "Active Sessions",
    ],
    months: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ],
    activity: [
      { name: "Olivia Martin", action: "created a new project", time: "2m ago" },
      { name: "Jackson Lee", action: "upgraded to Pro plan", time: "1h ago" },
      { name: "Isabella Nguyen", action: "invited 3 team members", time: "3h ago" },
      { name: "William Kim", action: "closed a support ticket", time: "5h ago" },
      { name: "Sofia Davis", action: "published a report", time: "1d ago" },
    ],
    toggleLabel: "Switch to French",
    langShort: "FR",
    primaryNav: "Primary navigation",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
    menuLabel: "Navigation menu",
  },
} as const;

const navItems = [
  { key: "overview" as const, icon: LayoutDashboard, active: true },
  { key: "customers" as const, icon: Users, active: false },
  { key: "revenue" as const, icon: DollarSign, active: false },
  { key: "analytics" as const, icon: Activity, active: false },
];

const statsMeta = [
  { value: "48 290 €", change: "+12,5%", trend: "up" as const, icon: DollarSign },
  { value: "2 318", change: "+8,2%", trend: "up" as const, icon: Users },
  { value: "3,42%", change: "-1,1%", trend: "down" as const, icon: TrendingUp },
  { value: "1 024", change: "+4,6%", trend: "up" as const, icon: Activity },
];

const chart = [40, 65, 45, 80, 55, 90, 70, 100, 60, 85, 75, 95];

function NavList({
  lang,
  onNavigate,
}: {
  lang: Lang;
  onNavigate?: () => void;
}) {
  const tr = t[lang];
  return (
    <nav aria-label={tr.primaryNav} className="space-y-1">
      {navItems.map((item) => (
        <a
          key={item.key}
          href="#"
          aria-current={item.active ? "page" : undefined}
          onClick={onNavigate}
          className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
            item.active
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.78_0.13_85/0.3)]"
              : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
        >
          {item.active && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-0 w-1 rounded-full"
              style={{ background: "var(--gradient-gold)" }}
            />
          )}
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{tr.nav[item.key]}</span>
        </a>
      ))}
    </nav>
  );
}

function Brand({ lang }: { lang: Lang }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-lg ring-1 ring-primary/40"
        style={{ backgroundImage: "var(--gradient-gold)", boxShadow: "0 8px 24px -6px oklch(0.78 0.13 85 / 0.5)" }}
      >
        <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="truncate font-display text-lg font-semibold tracking-wide text-sidebar-foreground">
        {t[lang].brand}
      </span>
    </div>
  );
}


function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");
  const tr = t[lang];

  const toggleLang = () => setLang((l) => (l === "fr" ? "en" : "fr"));

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background" lang={lang}>
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.78 0.13 85 / 0.22), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none absolute -bottom-48 -left-40 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.68 0.12 70 / 0.16), transparent)", animationDelay: "2s" }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="glass hidden w-60 shrink-0 border-r border-border/60 px-4 py-6 md:block">
          <div className="mb-8 px-2">
            <Brand lang={lang} />
          </div>
          <NavList lang={lang} />
        </aside>


        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={tr.menuLabel}
              className="absolute inset-y-0 left-0 w-64 border-r border-border bg-sidebar px-4 py-6 shadow-lg animate-fade-in"
            >
              <div className="mb-8 flex items-center justify-between px-2">
                <Brand lang={lang} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={tr.closeMenu}
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <NavList lang={lang} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 md:hidden"
              aria-label={tr.openMenu}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="min-w-0 animate-fade-in">
              <h1 className="gold-text truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {tr.headerTitle}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {tr.headerSubtitle}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-fit justify-self-end gap-2 border-primary/40 text-foreground transition-all hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_oklch(0.78_0.13_85/0.6)]"
              aria-label={tr.toggleLabel}
              onClick={toggleLang}
            >
              <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="font-semibold tracking-wide">{tr.langShort}</span>
            </Button>
          </header>


          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <section aria-label={tr.keyMetrics} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statsMeta.map((stat, i) => (
                <Card
                  key={i}
                  className="card-elevated gold-line glass animate-rise overflow-hidden border-border/60"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {tr.stats[i]}
                    </CardTitle>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/25"
                      style={{ background: "oklch(0.78 0.13 85 / 0.22)" }}
                      aria-hidden="true"
                    >
                      <stat.icon className="h-4 w-4 text-primary" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                      {stat.value}
                    </div>
                    <p
                      className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${
                        stat.trend === "up"
                          ? "text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {stat.change}
                        <span className="font-normal text-muted-foreground">{tr.fromLastMonth}</span>
                      </span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>


            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <Card className="card-elevated glass animate-rise border-border/60 lg:col-span-2" style={{ animationDelay: "280ms" }}>
                <CardHeader>
                  <CardTitle className="font-display text-lg tracking-wide">{tr.revenueOverview}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="flex items-end gap-1.5 sm:gap-2"
                    style={{ height: "14rem" }}
                    role="img"
                    aria-label={tr.chartAlt}
                  >
                    {chart.map((h, i) => (
                      <div
                        key={i}
                        className="bar-grow group relative flex-1 rounded-t-lg transition-all duration-300 hover:-translate-y-1"
                        style={{
                          height: `${h}%`,
                          animationDelay: `${i * 45}ms`,
                          background: "linear-gradient(180deg, oklch(0.88 0.11 92), oklch(0.68 0.12 70))",
                          boxShadow: "0 0 18px -6px oklch(0.78 0.13 85 / 0.6)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 hidden gap-1.5 sm:flex sm:gap-2" aria-hidden="true">
                    {tr.months.map((m, i) => (
                      <span key={i} className="flex-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated glass animate-rise border-border/60" style={{ animationDelay: "350ms" }}>
                <CardHeader>
                  <CardTitle className="font-display text-lg tracking-wide">{tr.recentActivity}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {tr.activity.map((item, i) => (
                      <li key={i} className="group flex items-start gap-3 rounded-lg p-1.5 transition-colors hover:bg-primary/5">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground shadow-md transition-transform group-hover:scale-105"
                          style={{ backgroundImage: "var(--gradient-gold)" }}
                          aria-hidden="true"
                        >
                          {item.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{item.name}</span>{" "}
                            <span className="text-muted-foreground">{item.action}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

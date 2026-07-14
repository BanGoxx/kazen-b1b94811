import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Clock,
  Compass,
  Heart,
  Loader2,
  ListChecks,
  Repeat,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getMyStats } from "@/lib/stats.functions";
import { formatViewingTime, type PersonalStats } from "@/lib/stats";
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from "@/lib/media-types";
import { SafeImage } from "@/components/media/SafeImage";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({
    meta: [
      { title: "Mes statistiques — KAZEN" },
      {
        name: "description",
        content:
          "Vos statistiques de visionnage KAZEN, calculées depuis Ma liste. Données privées, affichées dans l'application uniquement.",
      },
    ],
  }),
  component: StatsPage,
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Impossible de charger vos statistiques pour le moment.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Page introuvable.
      </div>
    </AppShell>
  ),
});

function StatsPage() {
  const fetchStats = useServerFn(getMyStats);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => fetchStats(),
    staleTime: 60_000,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Privé · visible par vous seul
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Mes statistiques
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Calculées à partir de votre « Ma liste ». Ces données restent
            privées et ne sont jamais partagées publiquement.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement de vos statistiques…
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Impossible de charger vos statistiques pour le moment.
          </div>
        ) : !data || data.total === 0 ? (
          <EmptyState />
        ) : (
          <StatsContent stats={data} />
        )}
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Aucune statistique pour l'instant</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Vos statistiques apparaîtront dès que vous ajouterez des titres à
            votre liste et suivrez votre progression.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Compass className="h-4 w-4" /> Découvrir des titres
          </Link>
          <Link
            to="/mes-listes"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <ListChecks className="h-4 w-4" /> Ma liste
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsContent({ stats }: { stats: PersonalStats }) {
  return (
    <div className="space-y-6">
      <OverviewCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusChart stats={stats} />
        <TypeChart stats={stats} />
      </div>

      <MonthlyChart stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <GenreChart stats={stats} />
        <RatingChart stats={stats} />
      </div>

      <ViewingTimeCard stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <TopList
          title="Favoris"
          icon={<Heart className="h-4 w-4" />}
          items={stats.topFavorites}
          renderValue={(v) => (v > 0 ? `${v}/10` : "—")}
          emptyLabel="Aucun favori pour l'instant."
        />
        <TopList
          title="Les plus revus"
          icon={<Repeat className="h-4 w-4" />}
          items={stats.topRewatched}
          renderValue={(v) => `×${v}`}
          emptyLabel="Aucun revisionnage enregistré."
        />
        <TopList
          title="Mieux notés"
          icon={<Star className="h-4 w-4" />}
          items={stats.topRated}
          renderValue={(v) => `${v}/10`}
          emptyLabel="Aucune note attribuée."
        />
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OverviewCards({ stats }: { stats: PersonalStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <Metric
        icon={<ListChecks className="h-4 w-4" />}
        label="Titres suivis"
        value={String(stats.total)}
      />
      <Metric
        icon={<Trophy className="h-4 w-4" />}
        label="Terminés"
        value={String(stats.byStatus.termine)}
        hint={`${Math.round(stats.completionRate * 100)}% d'achèvement`}
      />
      <Metric
        icon={<Star className="h-4 w-4" />}
        label="Note moyenne"
        value={stats.avgRating != null ? `${stats.avgRating.toFixed(1)}/10` : "—"}
        hint={
          stats.ratedCount > 0
            ? `sur ${stats.ratedCount} noté${stats.ratedCount > 1 ? "s" : ""}`
            : "aucune note"
        }
      />
      <Metric
        icon={<Heart className="h-4 w-4" />}
        label="Favoris"
        value={String(stats.favorites)}
      />
      <Metric
        icon={<Clock className="h-4 w-4" />}
        label="Temps estimé"
        value={formatViewingTime(stats.viewingMinutes)}
        hint="estimation"
      />
      <Metric
        icon={<TrendingUp className="h-4 w-4" />}
        label="Découvertes cette année"
        value={String(stats.discoveriesThisYear)}
      />
      <Metric
        icon={<Clock className="h-4 w-4" />}
        label="Durée moy. de visionnage"
        value={
          stats.avgDaysToFinish != null
            ? `${Math.round(stats.avgDaysToFinish)} j`
            : "—"
        }
        hint="entre début et fin"
      />
      <Metric
        icon={<Repeat className="h-4 w-4" />}
        label="En cours"
        value={String(stats.byStatus.en_cours)}
      />
    </div>
  );
}

function StatusChart({ stats }: { stats: PersonalStats }) {
  const data = useMemo(
    () =>
      (Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map(
        (s) => ({
          key: s,
          label: WATCH_STATUS_LABELS[s],
          value: stats.byStatus[s],
        }),
      ),
    [stats],
  );
  const config: ChartConfig = { value: { label: "Titres" } };
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Répartition par statut</CardTitle>
        <CardDescription>Où en êtes-vous sur vos titres.</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={config} className="h-[240px] w-full">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={80}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4} fill="var(--chart-1)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const TYPE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

function TypeChart({ stats }: { stats: PersonalStats }) {
  const data = useMemo(
    () =>
      (Object.keys(stats.byType) as (keyof typeof stats.byType)[])
        .map((t) => ({ key: t, label: MEDIA_TYPE_LABELS[t], value: stats.byType[t] }))
        .filter((d) => d.value > 0),
    [stats],
  );
  const config: ChartConfig = { value: { label: "Titres" } };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Types de médias</CardTitle>
        <CardDescription>Anime, séries et films suivis.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={config} className="h-[240px] w-full">
            <BarChart data={data} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4}>
                {data.map((d, i) => (
                  <Cell key={d.key} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyChart({ stats }: { stats: PersonalStats }) {
  const config: ChartConfig = {
    added: { label: "Ajouts", color: "var(--chart-2)" },
    completed: { label: "Terminés", color: "var(--chart-1)" },
  };
  const hasData = stats.monthly.some((m) => m.added > 0 || m.completed > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activité mensuelle</CardTitle>
        <CardDescription>
          Ajouts et titres terminés sur 12 mois (heure de Paris).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={config} className="h-[260px] w-full">
            <BarChart data={stats.monthly} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="added" radius={3} fill="var(--color-added)" />
              <Bar dataKey="completed" radius={3} fill="var(--color-completed)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function GenreChart({ stats }: { stats: PersonalStats }) {
  const config: ChartConfig = { count: { label: "Titres" } };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Genres les plus suivis</CardTitle>
        <CardDescription>Top des genres de votre liste.</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.genres.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer
            config={config}
            className="w-full"
            style={{ height: Math.max(200, stats.genres.length * 28) }}
          >
            <BarChart
              data={stats.genres}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={4} fill="var(--chart-4)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function RatingChart({ stats }: { stats: PersonalStats }) {
  const config: ChartConfig = { count: { label: "Titres" } };
  const hasData = stats.ratingHistogram.some((r) => r.count > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribution des notes</CardTitle>
        <CardDescription>Vos notes personnelles de 1 à 10.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyChart label="Aucune note attribuée pour l'instant." />
        ) : (
          <ChartContainer config={config} className="h-[240px] w-full">
            <BarChart data={stats.ratingHistogram} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="rating" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={4} fill="var(--chart-5)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ViewingTimeCard({ stats }: { stats: PersonalStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Temps de visionnage estimé
        </CardTitle>
        <CardDescription>
          Estimation basée sur des durées standard — anime ≈ 24 min/épisode,
          séries ≈ 45 min/épisode, films ≈ 110 min. Les épisodes comptés sont
          exacts ; la durée est une estimation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">
          ≈ {formatViewingTime(stats.viewingMinutes)}
        </p>
        {stats.viewingExcludedUnknown > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.viewingExcludedUnknown} titre
            {stats.viewingExcludedUnknown > 1 ? "s" : ""} terminé
            {stats.viewingExcludedUnknown > 1 ? "s" : ""} sans nombre d'épisodes
            connu {stats.viewingExcludedUnknown > 1 ? "sont exclus" : "est exclu"}{" "}
            du total.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TopList({
  title,
  icon,
  items,
  renderValue,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: PersonalStats["topFavorites"];
  renderValue: (value: number) => string;
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="flex items-center gap-3">
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                  {item.posterUrl ? (
                    <SafeImage
                      src={item.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="line-clamp-2 flex-1 text-sm">{item.title}</span>
                <span className="shrink-0 text-sm font-medium text-primary">
                  {renderValue(item.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label = "Pas encore de données." }: { label?: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

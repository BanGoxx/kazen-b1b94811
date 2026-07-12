import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Search as SearchIcon, User, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FicheSection } from "@/components/media/FicheSection";
import { ExpandableText } from "@/components/media/ExpandableText";
import { SafeImage } from "@/components/media/SafeImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ENTITY_KIND_LABELS } from "@/lib/media-types";
import { entityProfileQO } from "@/lib/queries";
import { anilistPublicCharacter, anilistPublicStaff } from "@/lib/anilist-public";

export const Route = createFileRoute("/entite/$kind/$id")({
  loader: async ({ context, params }) => {
    if (params.kind !== "character" && params.kind !== "staff") throw notFound();
    const profile = await context.queryClient.ensureQueryData(
      entityProfileQO(params.kind, params.id),
    );
    return { profile };
  },
  head: ({ loaderData, params }) => {
    const canonical = `https://kazen.lovable.app/entite/${params.kind}/${params.id}`;
    const p = loaderData?.profile;
    if (!p) {
      return {
        meta: [
          { title: "Profil introuvable — KAZEN" },
          { name: "description", content: "Ce profil n'est pas disponible sur KAZEN." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const kindLabel = ENTITY_KIND_LABELS[p.kind];
    const title = `${p.name} — ${kindLabel} — KAZEN`;
    const description = p.description
      ? p.description.length > 155
        ? `${p.description.slice(0, 152).trimEnd()}…`
        : p.description
      : `Découvrez ${p.name} sur KAZEN : œuvres associées et univers lié.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: canonical },
        ...(p.photoUrl ? [{ property: "og:image", content: p.photoUrl }] : []),
        { name: "twitter:card", content: p.photoUrl ? "summary" : "summary" },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: EntityPage,
  pendingComponent: () => (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <Skeleton className="mx-auto aspect-[3/4] w-40 rounded-2xl lg:mx-0 lg:w-full" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-1/2 max-w-xl" />
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Profil introuvable</h1>
        <p className="mt-2 text-muted-foreground">Ce profil n'est pas disponible.</p>
        <Button asChild className="mt-6">
          <Link to="/">Retour à la découverte</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function EntityPage() {
  const { kind, id } = Route.useParams();
  const router = useRouter();
  const { data: serverProfile } = useSuspenseQuery(entityProfileQO(kind, id));
  const needsBrowserProfile =
    (kind === "character" || kind === "staff") &&
    (!serverProfile || (!serverProfile.media.length && !serverProfile.description));
  const browserProfile = useQuery({
    queryKey: ["entity", "anilist-public", kind, id],
    queryFn: () => (kind === "character" ? anilistPublicCharacter(Number(id)) : anilistPublicStaff(Number(id))),
    enabled:
      needsBrowserProfile &&
      typeof window !== "undefined" &&
      Number.isFinite(Number(id)),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const p = browserProfile.data ?? serverProfile;
  const numericId = Number(id);
  const hasValidId = Number.isFinite(numericId) && numericId > 0;
  const kindLabel = ENTITY_KIND_LABELS[kind as keyof typeof ENTITY_KIND_LABELS] ?? "Profil";

  if (!p) {
    // Still fetching the browser-direct fallback: show a calm loading state.
    if (browserProfile.isPending && needsBrowserProfile) {
      return (
        <AppShell>
          <div className="py-24 text-center">
            <h1 className="font-display text-2xl font-bold">Chargement du profil…</h1>
            <p className="mt-2 text-muted-foreground">Connexion à la source de données.</p>
            <div className="mx-auto mt-6 h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        </AppShell>
      );
    }

    // Limited-data fallback: as long as we hold a valid external ID, offer a
    // useful page (type, external reference, search on KAZEN) instead of a dead
    // "introuvable". Only a genuinely invalid ID falls through to not-found.
    if (hasValidId) {
      const anilistUrl = `https://anilist.co/${kind === "staff" ? "staff" : "character"}/${numericId}`;
      return (
        <AppShell>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.history.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour
          </Button>
          <div className="mx-auto max-w-xl py-12 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
              {kind === "staff" ? <Users className="h-7 w-7 text-muted-foreground" /> : <User className="h-7 w-7 text-muted-foreground" />}
            </div>
            <span className="inline-block rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {kindLabel}
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold">Fiche en données limitées</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Les détails complets de ce profil ne sont pas disponibles pour le moment.
              Vous pouvez consulter la source externe ou explorer KAZEN.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline">
                <a href={anilistUrl} target="_blank" rel="noopener noreferrer">
                  <ArrowUpRight className="mr-2 h-4 w-4" /> Référence externe (AniList)
                </a>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/recherche" search={{}}>
                  <SearchIcon className="mr-2 h-4 w-4" /> Rechercher sur KAZEN
                </Link>
              </Button>
            </div>
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-2xl font-bold">Profil introuvable</h1>
          <p className="mt-2 text-muted-foreground">Ce profil n'est pas disponible.</p>
          <Button asChild className="mt-6">
            <Link to="/">Retour à la découverte</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour
      </Button>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Portrait + facts */}
        <div className="space-y-4">
          <div className="mx-auto w-40 overflow-hidden rounded-2xl border border-border bg-card lg:mx-0 lg:w-full">
            {p.photoUrl ? (
              <img
                src={p.photoUrl}
                alt={p.name}
                loading="eager"
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center text-muted-foreground">
                <User className="h-12 w-12" />
              </div>
            )}
          </div>

          {p.facts.length ? (
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {p.facts.map((f) => (
                <div
                  key={f.label}
                  className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur"
                >
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <Button asChild variant="outline" className="w-full justify-start">
            <a href={p.anilistUrl} target="_blank" rel="noopener noreferrer">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Fiche détaillée (AniList)
            </a>
          </Button>
        </div>

        {/* Content */}
        <div className="min-w-0 space-y-8">
          <div className="space-y-2">
            <span className="inline-block rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {ENTITY_KIND_LABELS[p.kind]}
            </span>
            <h1 className="text-balance font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {p.name}
            </h1>
            {p.nameNative && p.nameNative !== p.name ? (
              <p className="text-lg text-muted-foreground">{p.nameNative}</p>
            ) : null}
            <div className="pt-1">
              <Button asChild variant="secondary" size="sm">
                <Link to="/recherche" search={{ q: p.name }}>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Explorer « {p.name} » sur KAZEN
                </Link>
              </Button>
            </div>
          </div>

          {p.description ? (
            <FicheSection title="Présentation" icon={<User className="h-5 w-5" />}>
              <ExpandableText text={p.description} />
            </FicheSection>
          ) : null}

          {p.media.length ? (
            <FicheSection
              title={p.kind === "character" ? "Apparaît dans" : "Œuvres notables"}
              icon={<Users className="h-5 w-5" />}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {p.media.map((m) => {
                  const card = (
                    <>
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
                        <SafeImage
                          src={m.posterUrl}
                          alt={m.title}
                          variant="poster"
                          fallbackLabel={m.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {m.format ? (
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground backdrop-blur">
                            {m.format}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
                        {m.title}
                      </p>
                      {m.role || m.year ? (
                        <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                          {[m.role, m.year].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={m.id}>
                      {m.hasDetail ? (
                        <Link
                          to="/media/$source/$id"
                          params={{ source: "anilist", id: m.id }}
                          className="group block focus-visible:outline-none"
                        >
                          {card}
                        </Link>
                      ) : (
                        <a
                          href={`https://anilist.co/manga/${m.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block focus-visible:outline-none"
                        >
                          {card}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </FicheSection>
          ) : null}

          {p.people.length ? (
            <FicheSection title={p.peopleLabel} icon={<Users className="h-5 w-5" />}>
              <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {p.people.map((person) => (
                  <li key={person.id} className="w-28 shrink-0 snap-start">
                    <Link
                      to="/entite/$kind/$id"
                      params={{ kind: person.kind, id: person.id.slice(1) }}
                      className="focus-ring group block w-full rounded-xl border border-border bg-card/60 p-2 text-center transition-colors hover:border-primary/40"
                    >
                      <div className="mx-auto mb-2 aspect-square w-full overflow-hidden rounded-lg bg-muted">
                        {person.photoUrl ? (
                          <img
                            src={person.photoUrl}
                            alt={person.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <User className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
                        {person.name}
                      </p>
                      {person.role ? (
                        <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                          {person.role}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </FicheSection>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

import { useState } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Crown,
  ShieldCheck,
  Users,
  Inbox,
  Newspaper,
  ScrollText,
  Settings2,
  Loader2,
  Plus,
  Award,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import {
  useBadgeCatalog,
  createBadge,
  updateBadge,
  BADGE_VARIANTS,
} from "@/lib/founder";
import { PublicBadgeChip } from "@/components/founder/PublicBadge";
import {
  founderDiagnostics,
  assignBadgeByEmail,
  listBadgeAssignments,
  removeBadgeAssignment,
  setAssignmentVisibility,
} from "@/lib/founder.functions";

export const Route = createFileRoute("/_authenticated/fondateur")({
  ssr: false,
  head: () => ({ meta: [{ title: "Espace fondateur — KAZEN" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user)
      throw redirect({ to: "/auth", search: { redirect: "/fondateur" } });
    const { data: isOwner } = await supabase.rpc("can_moderate_now", {
      _user_id: data.user.id,
    });
    if (!isOwner) throw redirect({ to: "/" });
  },
  component: FounderConsole,
});

function DiagValue({ value }: { value: number | null }) {
  return (
    <span className="font-display text-2xl font-extrabold">
      {value === null ? "—" : value}
    </span>
  );
}

function FounderConsole() {
  const { user } = useAuth();
  const diagFn = useServerFn(founderDiagnostics);
  const { data: diag } = useQuery({
    queryKey: ["founder-diagnostics"],
    queryFn: () => diagFn(),
  });

  return (
    <AppShell>
      <div className="section-container max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Espace fondateur</h1>
            <p className="text-sm text-muted-foreground">
              Salle de contrôle privée · accès réservé au Fondateur.
            </p>
          </div>
        </header>

        {/* Private diagnostics */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Signalements en attente</p>
            <DiagValue value={diag?.pendingReports ?? null} />
          </div>
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Actions (7 j)</p>
            <DiagValue value={diag?.recentActions ?? null} />
          </div>
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Demandes en attente</p>
            <DiagValue value={diag?.pendingRequests ?? null} />
          </div>
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Badges</p>
            <DiagValue value={diag?.badges ?? null} />
          </div>
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Attributions</p>
            <DiagValue value={diag?.assignments ?? null} />
          </div>
          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Modération bêta</p>
            <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" /> Fondateur
            </span>
          </div>
        </section>

        <Tabs defaultValue="moderation">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="moderation" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Modération
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Users className="h-4 w-4" /> Rôles
            </TabsTrigger>
            <TabsTrigger value="demandes" className="gap-1.5">
              <Inbox className="h-4 w-4" /> Demandes
            </TabsTrigger>
            <TabsTrigger value="articles" className="gap-1.5">
              <Newspaper className="h-4 w-4" /> Articles
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="h-4 w-4" /> Audit
            </TabsTrigger>
            <TabsTrigger value="reglages" className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Réglages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="moderation" className="pt-6">
            <SectionCard
              title="Modération de la communauté"
              desc="Signalements, actions et historique. Accès réservé au Fondateur pendant la bêta."
            >
              <Button asChild variant="aurora" className="gap-2">
                <Link to="/moderation">
                  Ouvrir l'espace de modération <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </SectionCard>
          </TabsContent>

          <TabsContent value="roles" className="pt-6">
            <RolesSection ownerId={user?.id ?? null} />
          </TabsContent>

          <TabsContent value="demandes" className="pt-6">
            <SectionCard
              title="Demandes de titres & de membres"
              desc="Propositions de titres manquants soumises par les membres. Revue réservée au Fondateur."
            >
              <Button asChild variant="aurora" className="gap-2">
                <Link to="/moderation">
                  Ouvrir la revue des demandes <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </SectionCard>
          </TabsContent>

          <TabsContent value="articles" className="pt-6">
            <SectionCard title="Articles éditoriaux" desc="Outils de rédaction KAZEN.">
              <SoonPill />
            </SectionCard>
          </TabsContent>

          <TabsContent value="audit" className="pt-6">
            <SectionCard
              title="Audit"
              desc="Synthèse des actions de modération récentes."
            >
              <p className="text-sm text-muted-foreground">
                {diag
                  ? `${diag.recentActions ?? 0} action(s) de modération sur les 7 derniers jours · ${diag.pendingReports ?? 0} signalement(s) en attente.`
                  : "Chargement…"}
              </p>
              <div className="pt-3">
                <Button asChild variant="ghost" size="sm" className="gap-2">
                  <Link to="/moderation">
                    Historique complet <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="reglages" className="pt-6">
            <SectionCard title="Réglages" desc="Configuration de l'Espace fondateur.">
              <SoonPill />
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-elevated space-y-4 rounded-xl p-6">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function SoonPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
      Bientôt disponible
    </span>
  );
}

function RolesSection({ ownerId }: { ownerId: string | null }) {
  const qc = useQueryClient();
  const { data: badges } = useBadgeCatalog(true);
  const assignFn = useServerFn(assignBadgeByEmail);
  const listFn = useServerFn(listBadgeAssignments);
  const removeFn = useServerFn(removeBadgeAssignment);
  const visFn = useServerFn(setAssignmentVisibility);

  const { data: assignments } = useQuery({
    queryKey: ["badge-assignments"],
    queryFn: () => listFn(),
  });

  // Create-badge form
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [variant, setVariant] = useState("ember");

  const createMut = useMutation({
    mutationFn: () =>
      createBadge({ label: label.trim(), description: desc.trim(), visual_variant: variant }),
    onSuccess: () => {
      toast.success("Badge créé.");
      setLabel("");
      setDesc("");
      qc.invalidateQueries({ queryKey: ["badge-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (b: { id: string; is_active: boolean }) =>
      updateBadge(b.id, { is_active: !b.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badge-catalog"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Assign form
  const [email, setEmail] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const assignMut = useMutation({
    mutationFn: () => assignFn({ data: { email: email.trim(), badgeId } }),
    onSuccess: () => {
      toast.success("Badge attribué.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["badge-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { assignmentId: id } }),
    onSuccess: () => {
      toast.success("Attribution retirée.");
      qc.invalidateQueries({ queryKey: ["badge-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visMut = useMutation({
    mutationFn: (v: { id: string; isVisible: boolean }) =>
      visFn({ data: { assignmentId: v.id, isVisible: v.isVisible } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badge-assignments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Role labels (display-only) */}
      <SectionCard
        title="Libellés de rôles"
        desc="Noms publics des rôles. Purement cosmétiques — ils ne modifient jamais les permissions techniques."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((key) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <div>
                <span className="text-sm font-semibold">{ROLE_LABELS[key].label}</span>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[key].description}</p>
              </div>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                {key}
              </code>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Badge catalog */}
      <SectionCard
        title="Badges publics"
        desc="Marqueurs d'identité publics attribués par le Fondateur. Un badge ne confère jamais de permission."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="badge-label">Nom du badge</Label>
              <Input
                id="badge-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Bêta testeur"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="badge-desc">Description</Label>
              <Textarea
                id="badge-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                placeholder="Merci d'avoir testé KAZEN dès le début."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="badge-variant">Style visuel</Label>
              <select
                id="badge-variant"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {BADGE_VARIANTS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="aurora"
              className="gap-2"
              disabled={!label.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer le badge
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Catalogue
            </p>
            {(badges ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun badge pour le moment.</p>
            )}
            <ul className="space-y-2">
              {(badges ?? []).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  <PublicBadgeChip badge={b} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {b.is_active ? "Actif" : "Masqué"}
                    </span>
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={() =>
                        toggleActive.mutate({ id: b.id, is_active: b.is_active })
                      }
                      aria-label="Activer le badge"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* Assign badges */}
      <SectionCard
        title="Attribuer un badge"
        desc="Attribuez un badge à un membre via son e-mail. Les membres ne peuvent jamais s'auto-attribuer un badge."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="assign-email">E-mail du membre</Label>
            <Input
              id="assign-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="membre@exemple.com"
            />
          </div>
          <div className="min-w-[180px] space-y-1.5">
            <Label htmlFor="assign-badge">Badge</Label>
            <select
              id="assign-badge"
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choisir…</option>
              {(badges ?? [])
                .filter((b) => b.is_active)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
            </select>
          </div>
          <Button
            variant="premium"
            className="gap-2"
            disabled={!email.trim() || !badgeId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            {assignMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            Attribuer
          </Button>
        </div>

        <Separator className="my-4" />

        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Attributions actuelles
        </p>
        {(assignments ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune attribution.</p>
        )}
        <ul className="space-y-2">
          {(assignments ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-semibold">{a.badgeLabel}</span>{" "}
                <span className="text-muted-foreground">→ {a.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    visMut.mutate({ id: a.id, isVisible: !a.isVisible })
                  }
                >
                  {a.isVisible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  {a.isVisible ? "Visible" : "Masqué"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-destructive"
                  onClick={() => removeMut.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

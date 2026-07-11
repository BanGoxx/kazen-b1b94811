import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Loader2, UserRound, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { getMyProfile, updateMyProfile } from "@/lib/list.functions";
import { useMyList } from "@/lib/use-list";
import { signOut, useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";
import { SupporterBadge } from "@/components/premium/SupporterBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [{ title: "Mon profil — KAZEN" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { isSupporter } = usePremium();
  const navigate = useNavigate();
  const updateFn = useServerFn(updateMyProfile);
  const { entries } = useMyList();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
    }
  }, [data]);

  const stats = {
    total: entries.length,
    favoris: entries.filter((e) => e.favorite).length,
    termine: entries.filter((e) => e.status === "termine").length,
    en_cours: entries.filter((e) => e.status === "en_cours").length,
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({ data: { display_name: displayName, bio } });
      await refetch();
      toast.success("Profil mis à jour.");
    } catch {
      toast.error("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <div className="section-container max-w-3xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={data?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="aurora-bg text-white">
                {(displayName || user?.email || "N").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-2xl font-extrabold">
                {displayName || "Mon profil"}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="premium" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Suivis", value: stats.total },
            { label: "En cours", value: stats.en_cours },
            { label: "Terminés", value: stats.termine },
            { label: "Favoris", value: stats.favoris },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card/60 p-4 text-center backdrop-blur"
            >
              <p className="font-display text-2xl font-extrabold aurora-text">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <UserRound className="h-5 w-5" /> Informations
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Nom d'affichage</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Votre pseudo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="resize-none"
                  placeholder="Parlez de vos goûts…"
                />
              </div>
              <Button variant="aurora" onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
              </Button>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PenLine, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useForumCategories, useCreateTopic } from "@/lib/forum";
import { SignInToParticipate } from "@/components/community/forum-ui";

interface NewTopicSearch {
  category?: string;
}

export const Route = createFileRoute("/communaute/nouveau")({
  validateSearch: (search: Record<string, unknown>): NewTopicSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nouveau sujet — Communauté KAZEN" },
      {
        name: "description",
        content: "Lancez une nouvelle discussion dans la communauté KAZEN.",
      },
    ],
  }),
  component: NewTopicPage,
});

function NewTopicPage() {
  const { category: presetSlug } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories } = useForumCategories();
  const createTopic = useCreateTopic();

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const openCategories = (categories ?? []).filter((c) => !c.isLocked);

  useEffect(() => {
    if (categoryId || openCategories.length === 0) return;
    const preset = presetSlug ? openCategories.find((c) => c.slug === presetSlug) : null;
    setCategoryId((preset ?? openCategories[0]).id);
  }, [presetSlug, openCategories, categoryId]);

  async function submit() {
    if (!categoryId || title.trim().length < 3 || body.trim().length < 3) return;
    try {
      const id = await createTopic.mutateAsync({ categoryId, title: title.trim(), body: body.trim() });
      toast.success("Sujet créé");
      navigate({ to: "/communaute/t/$id", params: { id }, search: { page: 0 } });
    } catch (e) {
      toast.error("Impossible de créer le sujet", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        <Link
          to="/communaute"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Communauté
        </Link>

        <header className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PenLine className="h-6 w-6 text-primary" />
            <span className="aurora-text">Nouveau sujet</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Choisissez une rubrique, donnez un titre clair et développez votre message.
          </p>
        </header>

        {!user ? (
          <SignInToParticipate label="Vous devez être connecté pour créer un sujet." />
        ) : (
          <div className="space-y-5 rounded-2xl border border-border bg-card/50 p-5">
            <div className="space-y-2">
              <Label>Rubrique</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une rubrique" />
                </SelectTrigger>
                <SelectContent>
                  {openCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic-title">Titre</Label>
              <Input
                id="topic-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 160))}
                placeholder="Un titre clair et descriptif"
              />
              <p className="text-right text-[11px] text-muted-foreground">{title.length}/160</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic-body">Message</Label>
              <Textarea
                id="topic-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 20000))}
                placeholder="Développez votre sujet…"
                rows={8}
              />
              <p className="text-right text-[11px] text-muted-foreground">{body.length}/20000</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="ghost">
                <Link to="/communaute">Annuler</Link>
              </Button>
              <Button
                variant="aurora"
                disabled={
                  createTopic.isPending ||
                  !categoryId ||
                  title.trim().length < 3 ||
                  body.trim().length < 3
                }
                onClick={submit}
              >
                Publier le sujet
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

import { useState } from "react";
import { User } from "lucide-react";
import type { CreditPerson } from "@/lib/media-types";
import { EntityProfileDialog, type EntityKind } from "./EntityProfileDialog";

/**
 * Cast/crew avatar with graceful fallback: if there is no photo, or the remote
 * photo fails to load, we show the themed <User> glyph instead of a broken
 * image icon — keeping the UI clean when no real image exists.
 */
function CreditAvatar({ person }: { person: CreditPerson }) {
  const [failed, setFailed] = useState(false);
  const showImg = person.photoUrl && !failed;
  return (
    <div className="mx-auto mb-2 aspect-square w-full overflow-hidden rounded-lg bg-muted">
      {showImg ? (
        <img
          src={person.photoUrl as string}
          alt={person.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <User className="h-7 w-7" />
        </div>
      )}
    </div>
  );
}

export function CreditScroller({
  title,
  people,
  kind = "staff",
}: {
  title: string;
  people: CreditPerson[];
  kind?: EntityKind;
}) {
  const [selected, setSelected] = useState<CreditPerson | null>(null);
  const [open, setOpen] = useState(false);

  if (!people.length) return null;

  const handleOpen = (person: CreditPerson) => {
    setSelected(person);
    setOpen(true);
  };

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {people.map((p, i) => (
          <li
            key={`${p.id}-${p.role ?? ""}-${i}`}
            className="w-28 shrink-0 snap-start"
          >
            <button
              type="button"
              onClick={() => handleOpen(p)}
              className="focus-ring group block w-full rounded-xl border border-border bg-card/60 p-2 text-center transition-colors hover:border-primary/40"
              aria-label={`Voir le profil de ${p.name}`}
            >
              <CreditAvatar person={p} />
              <p className="line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
                {p.name}
              </p>
              {p.role ? (
                <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">{p.role}</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <EntityProfileDialog
        person={selected}
        kind={kind}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}

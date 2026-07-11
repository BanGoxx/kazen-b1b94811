# NEXUS MEDIA — Système de design

> Langage visuel « Aurora » : sombre, cinématographique, éditorial et premium.
> Interface 100 % française. Dark mode d'abord, light mode soigné ensuite.
> Style Tailwind CSS uniquement, piloté par des tokens dans `src/styles.css`.

---

## 1. Direction visuelle

**Ton** : sharp, sleek, immersif, très lisible. Une plateforme média haut de gamme,
inspirée des interfaces éditoriales modernes et des apps d'entertainment premium.

**Principes**
- **Le contenu (affiches, backdrops) est le héros.** L'UI se met en retrait :
  surfaces obsidiennes, accents lumineux ponctuels, jamais de dégradés partout.
- **Un seul accent signature** : le dégradé *aurora* (violet → magenta → cyan).
  Utilisé avec parcimonie sur le logo, les CTA principaux et les états actifs.
- **Respiration** : beaucoup d'espace négatif, hiérarchie typographique nette.
- **Mouvement discret** : `fade-in` / `rise` à l'entrée, `hover-lift` au survol.
  Tout est désactivé sous `prefers-reduced-motion`.
- À proscrire : look SaaS générique, style manga enfantin, surcharge de dégradés,
  bordures criardes, ombres lourdes, typographie faible.

---

## 2. Système de couleurs (tokens sémantiques)

Toutes les couleurs sont en `oklch`, définies dans `:root` (sombre) et `.light`.
**Ne jamais écrire `text-white`, `bg-black`, `bg-[#...]`.** Toujours un token.

| Token | Rôle |
| --- | --- |
| `background` / `foreground` | fond de page / texte principal |
| `card` / `card-foreground` | surfaces surélevées (cartes, panneaux) |
| `popover` / `popover-foreground` | menus, dropdowns, tooltips |
| `primary` / `primary-foreground` | violet aurora — CTA, liens, actif |
| `accent` / `accent-foreground` | cyan — accents secondaires |
| `secondary` / `secondary-foreground` | boutons/surfaces neutres |
| `muted` / `muted-foreground` | fonds discrets / texte secondaire |
| `destructive` | erreurs, suppression, abandon |
| `border` / `input` / `ring` | contours / champs / anneau de focus |
| `chart-1…5` | data-viz + tonalités de pills (succès/alerte…) |
| `sidebar-*` | navigation latérale (fond plus sombre que la page) |

**Dégradé signature** : `aurora-bg` (fond) et `aurora-text` (texte clippé).
Réservé aux moments forts, jamais en aplat de fond de page.

---

## 3. Typographie

- **Display / titres** : `Sora` (var `--font-display`) — `font-display`, `tracking -0.02em`.
- **Corps / UI** : `Manrope` (var `--font-body`) — appliqué au `body`.
- Chargées via `<link>` dans `__root.tsx` (jamais `@import` d'URL dans le CSS).

**Échelle**

| Usage | Classes |
| --- | --- |
| Titre de page (H1) | `font-display text-3xl font-extrabold sm:text-4xl` |
| Héros | `font-display text-3xl font-extrabold sm:text-5xl` |
| Titre de section (H2) | `font-display text-xl font-bold sm:text-2xl` |
| Titre de carte | `text-sm font-semibold leading-snug` |
| Corps | `text-sm` / `text-base` |
| Secondaire / helper | `text-sm text-muted-foreground` |
| Méta / pills | `text-xs` / `text-[0.7rem]` |
| Lecture longue (synopsis) | `leading-relaxed max-w-reading` |

---

## 4. Espacement

Échelle Tailwind par défaut (base 4px). Rythme recommandé :
- Padding de page : `py-8` vertical, gouttières via `section-container`.
- Entre sections : `space-y-12`.
- Intérieur de carte : `p-3` (compacte) → `p-6` (large).
- Gaps de grille/carousel : `gap-4`.
- Groupes d'éléments liés : `gap-2` / `gap-3`.

Largeurs max : `max-w-content` (1600px, coquille) · `max-w-reading` (68ch, texte).

---

## 5. Radius & ombres

- **Base** : `--radius: 0.9rem`. Échelle : `rounded-sm`→`rounded-4xl`.
  - Champs & pills : `rounded-lg` / `rounded-full`
  - Cartes : `rounded-xl`
  - Panneaux & héros : `rounded-2xl` / `rounded-3xl`
- **Ombres** (tokens exposés en utilitaires) :
  - `shadow-card` — élévation standard des cartes
  - `shadow-float` — modales, éléments flottants
  - `shadow-glow` — halo aurora sur les CTA/héros
  - `shadow-inset-line` — filet de lumière interne

---

## 6. Grille & mise en page

- **Coquille** : sidebar (`w-64`, `lg:flex`) + colonne principale. Drawer en mobile.
- **Utilitaire** : `section-container` centre + applique les gouttières responsives.
- **Grille média** : `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.
- **Carousels** : `flex overflow-x-auto snap-x` + `no-scrollbar`.
- **Fiche détail** : `lg:grid-cols-[280px_1fr]` (affiche + contenu).

---

## 7. Cartes

Base : `card-elevated rounded-xl border border-border bg-card`.
- Survol : lift `-translate-y-1` + `shadow-float` + `shadow-glow` + bord primary.
- Affiche : ratio `aspect-[2/3]`, `object-cover`, zoom image `group-hover:scale-105`.
- Overlays : pill type + note en haut, dégradé de lisibilité en bas.
Composants : `MediaCard`, `MediaGrid`, `MediaGridSkeleton`, `MediaCarousel`.

---

## 8. Boutons (`components/ui/button.tsx`)

| Variante | Usage |
| --- | --- |
| `aurora` | CTA principal (dégradé + halo) — 1 seul par vue |
| `default` | action primaire standard |
| `premium` | action mise en avant, discrète (bord + verre) |
| `secondary` | action neutre |
| `outline` | action tertiaire sur fond image |
| `ghost` | icônes, barre d'outils |
| `link` | navigation inline |

Tailles : `sm` · `default` (h-10) · `lg` · `icon` · `icon-sm`.
Tous : `focus-visible:ring-2 ring-offset-2`, `active:scale-[0.98]`, cible ≥ 40px.

---

## 9. Formulaires

- Champs : `Input` shadcn, hauteur `h-12` pour les recherches, `rounded-lg`.
- Icône à gauche : `absolute left-3` + `pl-11`.
- Toujours un `aria-label` explicite en français ; placeholder concis.
- Focus : `focus-ring` ou `focus-visible:ring-2 ring-ring`.
- États : erreur via `border-destructive` + texte `text-destructive`.

---

## 10. Badges & pills

- **`Pill`** (`components/ui/pill.tsx`) — base `pill` + tons sémantiques :
  `neutral · primary · accent · success · warning · danger · outline`.
- **`StatusPill`** / **`PriorityPill`** — mappent statuts et priorités aux tons.
- **`PlatformBadge` / `PlatformRow`** — couleur de marque de la plateforme.
- **`RatingBadge`** — note normalisée /10.
- Genres : `Badge variant="secondary"` (fiche) ou `pill` (carte).

Statuts (`WATCH_STATUS_LABELS`) : À voir · En cours · Terminé · En pause · Abandonné.

---

## 11. Navigation

- **Sidebar** (`AppShell`) : `glass` + `border-sidebar-border`, marque en haut.
- **Lien** : `min-h-11`, icône en pastille, actif = `bg-sidebar-accent` + pastille `aurora-bg`.
- `aria-current="page"` sur l'élément actif ; `aria-label` sur la nav.
- **Header** collant : `glass sticky top-0`, recherche + bascule de thème.
- **Mobile** : drawer `role="dialog" aria-modal`, backdrop flou, bouton fermer.

Libellés : Découverte · Anime · Séries · Films · Saison anime · À venir · Calendrier · Recherche.

---

## 12. Onglets

`Tabs` shadcn. Usage : filtrer une même collection (Tendance / Populaires / À venir).
`TabsContent` avec `mt-6`. Libellés courts et explicites en français.

---

## 13. Barre de recherche

- Champ `h-12` avec icône loupe à gauche, `placeholder="Rechercher un titre…"`.
- Déclenchement à partir de 2 caractères (`searchMediaQO`, `enabled`).
- Résultats groupés par type (Anime / Séries / Films) via `SectionHeader` + `MediaGrid`.
- États : invite < 2 car., `MediaGridSkeleton` pendant, `EmptyState` si vide.

---

## 14. Barre de filtres (convention)

- Rangée `flex flex-wrap gap-2` de `Pill tone="outline"` cliquables (toggle).
- Filtre actif : `tone="primary"`. Bouton « Réinitialiser » en `ghost` à droite.
- En mobile : rangée scrollable `overflow-x-auto no-scrollbar`.
- Libellés types : Type · Genre · Plateforme · Année · Statut · Trier par.

---

## 15. Modale / Drawer

- **Modale** : `Dialog` shadcn — `rounded-2xl`, `shadow-float`, fond `popover`.
- **Drawer** : `Sheet` (mobile) ou panneau `glass` transluquide — édition de liste,
  détails rapides, filtres avancés. Toujours `aria-modal` + fermeture au backdrop/Échap.

---

## 16. États vides

`EmptyState` : icône dans une pastille `bg-muted`, message + `hint` optionnel.
Messages en français, orientés action (« Essayez un autre titre… »).

---

## 17. Squelettes de chargement

`Skeleton` shadcn. `MediaGridSkeleton` / squelettes de carousel reproduisent la
mise en page finale (ratio `aspect-[2/3]` + lignes de texte) — pas de spinner.
Le chargement initial passe par le loader + `useSuspenseQuery`.

---

## 18. États hover / active / focus

- **Hover** : `hover-lift` sur les surfaces cliquables, `hover:bg-accent` sur les items.
- **Active** : `active:scale-[0.98]` sur les boutons.
- **Focus** : `focus-ring` (anneau 2px + offset) — visible et contrasté partout.
- Cibles tactiles ≥ 40px, jamais de focus supprimé sans alternative.

---

## 19. Règles dark mode (défaut)

- Fonds obsidiens (`background` très sombre, `sidebar` encore plus).
- Accents lumineux ponctuels ; halos `shadow-glow` sur le violet uniquement.
- Verre (`glass`) pour la profondeur (sidebar, header, drawers).
- Contraste AA minimum garanti par les paires token/foreground.

---

## 20. Règles light mode

- Variante éditoriale : fond `oklch(0.98…)`, cartes blanches, bordures fines.
- Primary/accent légèrement assombris pour rester contrastés sur blanc.
- Halos et verre atténués ; on privilégie l'ombre douce à la lueur.
- Bascule via `.light` sur `<html>` (`ThemeToggle`, persistée `nexus-theme`).

---

## 21. Adaptation mobile

- Desktop-first mais excellent en mobile.
- Sidebar → drawer ; grilles 5 → 2 colonnes ; héros compact `min-h-[24rem]`.
- Rangées mixtes texte + widget : `grid-cols-[minmax(0,1fr)_auto]` → `sm:flex`,
  `min-w-0` sur le texte, `shrink-0` sur les icônes, `truncate` sur les titres.
- Gouttières réduites, carousels scrollables au doigt (`snap-x`).

---

## Conventions de nommage

- **Fichiers composants** : `PascalCase.tsx` (`MediaCard`, `StatusPill`).
- **Primitives UI** génériques : `src/components/ui/*` (shadcn, `kebab` de fichier).
- **Composants métier média** : `src/components/media/*`.
- **Layout** : `src/components/layout/*` (`AppShell`, `ThemeToggle`).
- **Utilitaires CSS** (`@utility`) : `kebab-case` (`aurora-bg`, `card-elevated`,
  `focus-ring`, `section-container`, `hover-lift`, `no-scrollbar`, `pill`).
- **Tokens couleur** : `--<role>` en `:root`/`.light`, exposés `--color-<role>`.
- **Sections de page** : balises sémantiques (`section`, `aside`, `nav`, `main`)
  + `SectionHeader` / `PageHeader` pour les titres.
- **Requêtes de données** : `*QO` (`queryOptions`) dans `src/lib/queries.ts`.

---

## Catalogue de composants réutilisables

| Composant | Fichier | Rôle |
| --- | --- | --- |
| `AppShell` | `layout/AppShell` | coquille : sidebar + header + drawer + footer |
| `ThemeToggle` | `layout/ThemeToggle` | bascule dark/light persistée |
| `PageHeader` | `media/SectionHeader` | titre de page aurora + description |
| `SectionHeader` | `media/SectionHeader` | titre de section + action « Tout voir » |
| `MediaCard` | `media/MediaCard` | carte affiche (type, note, plateformes) |
| `MediaGrid` / `…Skeleton` | `media/MediaGrid` | grille responsive + squelette |
| `MediaCarousel` | `media/MediaCarousel` | rangée horizontale scrollable |
| `DiscoverHero` | `media/DiscoverHero` | héros cinématographique |
| `RatingBadge` | `media/RatingBadge` | note /10 |
| `PlatformBadge` / `PlatformRow` | `media/PlatformBadge` | plateformes de diffusion |
| `StatusPill` / `PriorityPill` | `media/StatusPill` | statut de suivi / priorité |
| `EmptyState` | `media/EmptyState` | état vide/erreur |
| `Pill` | `ui/pill` | pastille générique à tons sémantiques |
| `Button` | `ui/button` | boutons (aurora/premium/…) |
| `Input` `Tabs` `Badge` `Skeleton` | `ui/*` | primitives shadcn |

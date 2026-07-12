# KAZEN — Smoke test production post-publication

KAZEN rich fiches and progressive catalog loading are validated core product behaviors. Do not remove during visual polish.

## AniList production path

- Open `/media/anilist/195600` and confirm the fiche loads Daemons of the Shadow Realm, not the fallback “Fiche introuvable”.
- Open `/media/anilist/178789`, `/media/anilist/154587`, and `/media/anilist/21` and confirm rich sections are visible.
- Confirm the server logs no longer show repeated unhandled AniList failures; if they do, confirm the browser fallback still fills the fiche.

## Rich anime fiche

- Confirm synopsis, alternative titles, information cards, platforms, videos/trailer, episodes, next episode, characters/voices, staff, related works, source/adaptation, universe/franchise links, articles, reviews, personal list, and playlist actions.
- Click a character card: the profile dialog must open.
- From the dialog, open the KAZEN entity profile and confirm “Apparaît dans” works.
- Click a staff card and repeat the same checks.
- Click “Voir l'univers” and confirm the internal universe page opens.
- Click related anime cards and confirm they open internal KAZEN fiches.

## Infinite catalog loading

- Open `/anime` on desktop and mobile.
- Confirm the first page loads real AniList titles.
- Scroll to the bottom and confirm the next page loads automatically.
- Confirm “Voir plus de titres” remains available and works if the observer does not trigger.
- Switch Tendance / Populaires / À venir and confirm pagination continues independently with no duplicate visible cards.

## Other media detail parity

- Open one film fiche and one series fiche from `/films` and `/series`.
- Confirm the existing rich sections, tracking actions, reviews, and platform badges still render.
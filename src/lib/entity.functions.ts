import { createServerFn } from "@tanstack/react-start";
import type { EntityProfile } from "./media-types";

/**
 * Fetch a dedicated KAZEN entity profile (character or staff) from AniList.
 * Returns null when the kind/id is invalid or no real node exists, so the
 * route can fall back cleanly to the lightweight overlay instead of rendering
 * an empty page. Errors never bubble as a broken screen.
 */
export const getEntityProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: string; id: string }) => d)
  .handler(async ({ data }): Promise<EntityProfile | null> => {
    if (data.kind !== "character" && data.kind !== "staff") return null;
    const id = Number(data.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const { anilistCharacter, anilistStaff } = await import("./anilist.server");
      return data.kind === "character"
        ? await anilistCharacter(id)
        : await anilistStaff(id);
    } catch (e) {
      console.error("getEntityProfile", e);
      return null;
    }
  });

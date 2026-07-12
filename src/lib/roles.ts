// KAZEN role display labels (Phase 1 — display-only constant mapping).
//
// IMPORTANT: These are cosmetic public labels only. Technical role IDs
// (the `app_role` enum: owner/admin/moderator/editorial_contributor/
// trusted_member/member) remain the single source of truth for every
// permission check. Renaming a label here NEVER changes any permission.
//
// A future `role_labels` table could make these editable by the Owner at
// runtime; for the beta a stable constant is safer and avoids an extra
// privileged surface. Documented as future work.

export type AppRole =
  | "owner"
  | "admin"
  | "moderator"
  | "editorial_contributor"
  | "trusted_member"
  | "member";

export interface RoleLabel {
  key: AppRole;
  label: string;
  description: string;
  /** Whether the label is meant to be shown publicly. */
  isPublic: boolean;
}

export const ROLE_LABELS: Record<AppRole, RoleLabel> = {
  owner: {
    key: "owner",
    label: "Fondateur",
    description: "Compte fondateur unique de KAZEN.",
    isPublic: true,
  },
  admin: {
    key: "admin",
    label: "Administrateur",
    description: "Gestion avancée de la plateforme.",
    isPublic: true,
  },
  moderator: {
    key: "moderator",
    label: "Modérateur",
    description: "Veille et modération de la communauté.",
    isPublic: true,
  },
  editorial_contributor: {
    key: "editorial_contributor",
    label: "Rédacteur KAZEN",
    description: "Contributions éditoriales et articles.",
    isPublic: true,
  },
  trusted_member: {
    key: "trusted_member",
    label: "Membre de confiance",
    description: "Membre reconnu de la communauté.",
    isPublic: true,
  },
  member: {
    key: "member",
    label: "Membre",
    description: "Membre de la communauté KAZEN.",
    isPublic: true,
  },
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role]?.label ?? role;
}

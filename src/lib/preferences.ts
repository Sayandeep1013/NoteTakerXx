"use client";

import { useNotesStore, type CustomBadge, type DockSide } from "@/store/notes";
import { saveProfile, useSession } from "@/lib/session";
import type { ThemeName } from "@/lib/themes";

export const PREF_KEYS = {
  dockSide: "nxtaker_dock_side",
  coffee: "nxtaker_coffee_visible",
  dotGridEffect: "nxtaker_dot_grid_effect",
  guestBadges: "nxtaker_custom_badges",
} as const;

// User-initiated preference changes. Local persistence happens in
// PreferencesSync; these additionally push the change to the cloud profile.

export function chooseTheme(theme: ThemeName) {
  useNotesStore.getState().setTheme(theme);
  void saveProfile({ theme });
}

export function chooseDockSide(side: DockSide) {
  useNotesStore.getState().setDockSide(side);
  void saveProfile({ dock_side: side });
}

function persistCustomBadges() {
  const badges = useNotesStore.getState().customBadges;
  if (useSession.getState().user) {
    void saveProfile({ custom_badges: badges });
    return;
  }
  try { localStorage.setItem(PREF_KEYS.guestBadges, JSON.stringify(badges)); } catch {}
}

export function addCustomBadge(badge: CustomBadge) {
  useNotesStore.getState().addCustomBadge(badge);
  persistCustomBadges();
}

export function deleteCustomBadge(badgeId: string) {
  useNotesStore.getState().deleteCustomBadge(badgeId);
  persistCustomBadges();
}

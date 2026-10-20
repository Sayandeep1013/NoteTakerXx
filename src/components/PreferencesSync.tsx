"use client";

import { useEffect } from "react";
import { useNotesStore, type CustomBadge } from "@/store/notes";
import { startSession, useSession } from "@/lib/session";
import { PREF_KEYS } from "@/lib/preferences";
import { applyTheme, isThemeName, THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
import { installPaperNoise } from "@/lib/paperNoise";

function readGuestBadges(): CustomBadge[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEYS.guestBadges) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * Restores local preferences, applies the cloud profile once it loads, and
 * mirrors preference changes back to localStorage. Renders nothing.
 */
export default function PreferencesSync() {
  useEffect(() => {
    installPaperNoise();
    const store = useNotesStore.getState();
    try {
      const theme = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeName(theme)) store.setTheme(theme);
      const side = localStorage.getItem(PREF_KEYS.dockSide);
      if (side === "bottom" || side === "left") store.setDockSide(side);
      const coffee = localStorage.getItem(PREF_KEYS.coffee);
      if (coffee !== null) store.setCoffeeVisible(coffee === "true");
      const dotEffect = localStorage.getItem(PREF_KEYS.dotGridEffect);
      if (dotEffect !== null) store.setDotGridEffect(dotEffect !== "false");
    } catch {}
    applyTheme(THEMES[useNotesStore.getState().theme]);

    const unsubStore = useNotesStore.subscribe((s, prev) => {
      try {
        if (s.theme !== prev.theme) {
          applyTheme(THEMES[s.theme]);
          localStorage.setItem(THEME_STORAGE_KEY, s.theme);
        }
        if (s.dockSide !== prev.dockSide) localStorage.setItem(PREF_KEYS.dockSide, s.dockSide);
        if (s.coffeeVisible !== prev.coffeeVisible) localStorage.setItem(PREF_KEYS.coffee, String(s.coffeeVisible));
        if (s.dotGridEffect !== prev.dotGridEffect) localStorage.setItem(PREF_KEYS.dotGridEffect, String(s.dotGridEffect));
      } catch {}
    });

    const applyProfile = () => {
      const { user, profile, profileLoaded } = useSession.getState();
      if (!profileLoaded) return;
      const notes = useNotesStore.getState();
      if (!user) {
        notes.setCustomBadges(readGuestBadges());
        return;
      }
      if (isThemeName(profile?.theme)) notes.setTheme(profile.theme);
      if (profile?.dock_side === "bottom" || profile?.dock_side === "left") notes.setDockSide(profile.dock_side);
      notes.setCustomBadges(Array.isArray(profile?.custom_badges) ? (profile.custom_badges as CustomBadge[]) : []);
    };
    // Only react to a profile *load* (not to our own optimistic saves).
    const unsubSession = useSession.subscribe((s, prev) => {
      if (s.profileLoaded && (!prev.profileLoaded || s.user?.id !== prev.user?.id)) applyProfile();
    });

    startSession();
    applyProfile();
    return () => { unsubStore(); unsubSession(); };
  }, []);

  return null;
}

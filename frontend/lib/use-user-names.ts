"use client";

import { useEffect, useState } from "react";
import { lookupUsers, type PublicProfile } from "@/lib/api";

/** Shared across components so each user id is only fetched once per page load. */
const cache = new Map<string, PublicProfile>();

/**
 * Resolves user ids to public profiles (name, vehicle). Ids that cannot be
 * resolved fall back to a short reference, so the UI never shows a bare UUID.
 */
export function useUserProfiles(ids: Array<string | null | undefined>) {
  const [, setVersion] = useState(0);
  const wanted = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const missingKey = wanted.filter((id) => !cache.has(id)).sort().join(",");

  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    lookupUsers(missingKey.split(","))
      .then((profiles) => {
        profiles.forEach((profile) => cache.set(profile.id, profile));
      })
      .catch(() => {
        // Names are cosmetic; keep the fallback label if the lookup fails.
      })
      .finally(() => {
        if (!cancelled) setVersion((version) => version + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  return {
    profile: (id: string | null | undefined): PublicProfile | null =>
      id ? (cache.get(id) ?? null) : null,
    nameOf: (id: string | null | undefined, selfId?: string, label = "Driver"): string => {
      if (!id) return "";
      if (selfId && id === selfId) return "You";
      return cache.get(id)?.full_name || `${label} #${id.slice(0, 6)}`;
    },
  };
}

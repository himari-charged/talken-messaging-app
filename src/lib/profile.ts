/**
 * Profile (display name, avatar) persistence per address.
 * Stored in localStorage; keyed by wallet address.
 */

const PROFILE_PREFIX = "talken_profile_";

export interface ProfileData {
  displayName: string;
  /** Data URL or URL string for profile image */
  profileImageUrl: string | null;
}

const DEFAULT_PROFILE: ProfileData = {
  displayName: "",
  profileImageUrl: null,
};

function storageKey(address: string): string {
  return `${PROFILE_PREFIX}${address?.toLowerCase() ?? ""}`;
}

export function getProfile(address: string): ProfileData {
  if (!address?.trim()) return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return { ...DEFAULT_PROFILE };
    const data = JSON.parse(raw) as Partial<ProfileData>;
    return {
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      profileImageUrl: typeof data.profileImageUrl === "string" ? data.profileImageUrl : null,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function setProfile(address: string, updates: Partial<ProfileData>): ProfileData {
  if (!address?.trim()) return { ...DEFAULT_PROFILE };
  const current = getProfile(address);
  const next: ProfileData = {
    displayName: updates.displayName !== undefined ? updates.displayName : current.displayName,
    profileImageUrl: updates.profileImageUrl !== undefined ? updates.profileImageUrl : current.profileImageUrl,
  };
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(next));
  } catch {
    // ignore quota or disabled storage
  }
  return next;
}

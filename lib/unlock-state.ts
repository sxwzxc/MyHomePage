const UNLOCK_STORAGE_KEY = 'myhomepage:settings-unlock:v1';
const UNLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

type UnlockSnapshot = {
  unlockedAt: number;
  expiresAt: number;
};

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readUnlockSnapshot(): UnlockSnapshot | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(UNLOCK_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UnlockSnapshot;
    if (
      typeof parsed.unlockedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
    return null;
  }
}

export function isSettingsUnlocked(): boolean {
  const snapshot = readUnlockSnapshot();
  if (!snapshot) {
    return false;
  }

  if (snapshot.expiresAt <= Date.now()) {
    clearSettingsUnlock();
    return false;
  }

  return true;
}

export function saveSettingsUnlock(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const now = Date.now();
  const snapshot: UnlockSnapshot = {
    unlockedAt: now,
    expiresAt: now + UNLOCK_DURATION_MS,
  };

  window.localStorage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSettingsUnlock(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
}

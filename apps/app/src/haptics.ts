import { Capacitor } from '@capacitor/core';

// Lazy import to avoid errors when plugin not available on web
let HapticsModule: typeof import('@capacitor/haptics') | null = null;

async function loadHaptics() {
  if (!HapticsModule) {
    try {
      HapticsModule = await import('@capacitor/haptics');
    } catch {
      HapticsModule = null;
    }
  }
}

// Module-level flag — can be toggled via setHapticsEnabled()
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function impactLight(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.impact({ style: HapticsModule!.ImpactStyle.Light });
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // never throws
  }
}

export function impactMedium(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.impact({ style: HapticsModule!.ImpactStyle.Medium });
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch {
    // never throws
  }
}

export function selectionStart(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.selectionStart();
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(5);
    }
  } catch {
    // never throws
  }
}

export function selectionChanged(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.selectionChanged();
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(5);
    }
  } catch {
    // never throws
  }
}

export function selectionEnd(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.selectionEnd();
        })
        .catch(() => {});
    }
  } catch {
    // never throws
  }
}

export function notificationSuccess(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.notification({ type: HapticsModule!.NotificationType.Success });
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
  } catch {
    // never throws
  }
}

export function notificationWarning(): void {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      loadHaptics()
        .then(() => {
          HapticsModule?.Haptics.notification({ type: HapticsModule!.NotificationType.Warning });
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 30, 20]);
    }
  } catch {
    // never throws
  }
}

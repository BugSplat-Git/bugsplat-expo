import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

interface UseShakeOptions {
  /** g-force deviation from rest (1g) needed to count as a shake. Default 1.2. */
  threshold?: number;
  /** Milliseconds to ignore further shakes after firing. Default 1500. */
  cooldownMs?: number;
  /** Polling interval for the accelerometer. Default 100ms. */
  intervalMs?: number;
  /** Set false to temporarily stop listening (e.g. while a modal is open). */
  enabled?: boolean;
}

/**
 * Fires `onShake` when the device experiences a high-g event. Uses
 * expo-sensors Accelerometer with a magnitude-over-threshold heuristic +
 * cooldown so a single shake doesn't fire multiple times.
 *
 * Note: the iOS Simulator's Device → Shake menu fires UIEventSubtypeMotionShake,
 * not real accelerometer data, so this hook won't trigger there. Test iOS shake
 * on a real device, or shake the virtual device in the Android emulator's
 * Extended Controls → Virtual sensors panel.
 */
export function useShake(onShake: () => void, options: UseShakeOptions = {}): void {
  const { threshold = 1.2, cooldownMs = 1500, intervalMs = 100, enabled = true } = options;
  const lastFireRef = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    Accelerometer.setUpdateInterval(intervalMs);
    const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
      // Accelerometer values are in g-units; magnitude ≈ 1 at rest (gravity).
      // |magnitude - 1| isolates the shake component from gravity.
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (Math.abs(magnitude - 1) < threshold) return;
      const now = Date.now();
      if (now - lastFireRef.current < cooldownMs) return;
      lastFireRef.current = now;
      onShakeRef.current();
    });
    return () => sub.remove();
  }, [enabled, intervalMs, threshold, cooldownMs]);
}

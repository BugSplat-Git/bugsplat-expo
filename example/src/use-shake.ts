import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

interface UseShakeOptions {
  /**
   * g-force deviation from rest (1g) needed to register a single peak.
   * Default 1.5 — moderate because the multi-peak window does the bulk of
   * the false-positive filtering. Raise to demand harder shakes.
   */
  peakThreshold?: number;
  /**
   * How many peaks must occur within `windowMs` to fire onShake. Default 3.
   * A real shake has back-and-forth oscillation (3-5+ peaks); a single fast
   * motion like lowering the phone only produces 1-2 peaks.
   */
  requiredPeaks?: number;
  /** Time window for collecting peaks. Default 600ms. */
  windowMs?: number;
  /**
   * Minimum spacing between counted peaks. Default 60ms — at 10Hz polling,
   * a single peak can span 2 samples, so dedup tightly-spaced readings.
   */
  minPeakSpacingMs?: number;
  /** Milliseconds to ignore further shakes after firing. Default 1500. */
  cooldownMs?: number;
  /** Polling interval for the accelerometer. Default 100ms. */
  intervalMs?: number;
  /** Set false to temporarily stop listening (e.g. while a modal is open). */
  enabled?: boolean;
}

/**
 * Fires `onShake` when the device experiences a *pattern* of high-g events —
 * specifically, `requiredPeaks` (default 3) peaks above `peakThreshold` within
 * a sliding `windowMs` window. The multi-peak requirement is what
 * distinguishes a deliberate shake (rapid back-and-forth oscillation) from
 * incidental single impacts (lowering the phone, setting it down, pocket bump).
 *
 * iOS Simulator's Device → Shake menu sends UIEventSubtypeMotionShake, not
 * accelerometer data, so this hook only works on real iOS devices. Use the
 * Android emulator's Virtual sensors panel for emulator testing.
 */
export function useShake(onShake: () => void, options: UseShakeOptions = {}): void {
  const {
    peakThreshold = 1.5,
    requiredPeaks = 3,
    windowMs = 600,
    minPeakSpacingMs = 60,
    cooldownMs = 1500,
    intervalMs = 100,
    enabled = true,
  } = options;
  const peaksRef = useRef<number[]>([]);
  const lastFireRef = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    Accelerometer.setUpdateInterval(intervalMs);
    const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
      const deviation = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
      if (deviation < peakThreshold) return;
      const now = Date.now();
      // Dedup tightly-spaced samples that belong to the same physical peak.
      const last = peaksRef.current[peaksRef.current.length - 1];
      if (last && now - last < minPeakSpacingMs) return;
      // Drop expired peaks, then record this one.
      peaksRef.current = peaksRef.current.filter((t) => now - t < windowMs);
      peaksRef.current.push(now);
      if (peaksRef.current.length < requiredPeaks) return;
      if (now - lastFireRef.current < cooldownMs) return;
      lastFireRef.current = now;
      peaksRef.current = [];
      onShakeRef.current();
    });
    return () => sub.remove();
  }, [enabled, intervalMs, peakThreshold, requiredPeaks, windowMs, minPeakSpacingMs, cooldownMs]);
}

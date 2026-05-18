import { useEffect, useRef } from 'react';
import RNShake from 'react-native-shake';

/**
 * Fires `onShake` when the device's shake gesture is detected.
 *
 * Backed by react-native-shake — on iOS it listens for
 * UIEventSubtypeMotionShake (works in the iOS Simulator via
 * Device → Shake, Ctrl+⌘+Z); on Android it uses the platform accelerometer
 * with native threshold + debouncing.
 *
 * `enabled: false` temporarily detaches the listener (e.g. while a modal is
 * already open so the user's input shake can't bounce them right back into it).
 */
export function useShake(onShake: () => void, options: { enabled?: boolean } = {}): void {
  const { enabled = true } = options;
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    const sub = RNShake.addListener(() => {
      onShakeRef.current();
    });
    return () => sub.remove();
  }, [enabled]);
}

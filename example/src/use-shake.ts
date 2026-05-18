import { useEffect, useRef } from 'react';

// Defensive load: react-native-shake constructs a NativeEventEmitter at
// module-load time. If the native module isn't autolinked (consumer skipped
// `npx expo prebuild --clean` after install), the constructor throws and
// blows up the whole JS bundle — taking the app down on startup. require +
// try/catch keeps the app alive; the shake feature just no-ops with a warning.
let RNShake: { addListener?: (cb: () => void) => { remove: () => void } } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNShake = require('react-native-shake').default ?? require('react-native-shake');
} catch (e) {
  console.warn(
    '[useShake] react-native-shake failed to load. Did you run `npx expo prebuild --clean` after installing? Shake-to-feedback disabled.',
    e
  );
}

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
    if (!enabled || !RNShake?.addListener) return;
    const sub = RNShake.addListener(() => onShakeRef.current());
    return () => sub.remove();
  }, [enabled]);
}

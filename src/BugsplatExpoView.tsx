import { requireNativeView } from 'expo';
import * as React from 'react';

import { BugsplatExpoViewProps } from './BugsplatExpo.types';

const NativeView: React.ComponentType<BugsplatExpoViewProps> =
  requireNativeView('BugsplatExpo');

export default function BugsplatExpoView(props: BugsplatExpoViewProps) {
  return <NativeView {...props} />;
}

import { NativeModule, requireNativeModule } from 'expo';

import { BugsplatExpoModuleEvents } from './BugsplatExpo.types';

declare class BugsplatExpoModule extends NativeModule<BugsplatExpoModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BugsplatExpoModule>('BugsplatExpo');

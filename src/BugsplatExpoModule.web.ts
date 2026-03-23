import { registerWebModule, NativeModule } from 'expo';

import { BugsplatExpoModuleEvents } from './BugsplatExpo.types';

class BugsplatExpoModule extends NativeModule<BugsplatExpoModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(BugsplatExpoModule, 'BugsplatExpoModule');

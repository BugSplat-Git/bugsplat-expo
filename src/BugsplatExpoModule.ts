import { requireOptionalNativeModule } from 'expo';

export interface BugsplatExpoNativeModule {
  init(
    database: string,
    application: string,
    version: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  setUser(name: string, email: string): void;
  setAttribute(key: string, value: string): void;
  removeAttribute(key: string): void;
  crash(): void;
}

export default requireOptionalNativeModule<BugsplatExpoNativeModule>('BugsplatExpo');

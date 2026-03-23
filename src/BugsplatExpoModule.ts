import { requireNativeModule } from 'expo';

export interface BugsplatExpoNativeModule {
  init(
    database: string,
    application: string,
    version: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  post(
    message: string,
    callstack: string,
    options?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }>;
  setUser(name: string, email: string): void;
  setAttribute(key: string, value: string): void;
  crash(): void;
}

export default requireNativeModule<BugsplatExpoNativeModule>('BugsplatExpo');

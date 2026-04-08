jest.mock('../BugsplatExpoModule', () => ({
  __esModule: true,
  default: null,
}));

const mockBugSplatInstance = {
  post: jest.fn().mockResolvedValue({}),
  setDefaultAppKey: jest.fn(),
  setDefaultUser: jest.fn(),
  setDefaultEmail: jest.fn(),
  setDefaultDescription: jest.fn(),
  setDefaultAttributes: jest.fn(),
};

const mockInitReact = jest.fn().mockReturnValue(
  (initializer: (client: typeof mockBugSplatInstance) => void) => {
    initializer(mockBugSplatInstance);
  }
);

jest.mock('@bugsplat/react', () => ({
  init: mockInitReact,
}));

import { init, post, setUser, setAttribute, removeAttribute, crash } from '../BugsplatExpo';

describe('BugsplatExpo (Expo Go / JS fallback)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('init', () => {
    it('logs a warning about native unavailability', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Native crash reporting is unavailable')
      );
    });

    it('initializes a JS client via @bugsplat/react', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect(mockInitReact).toHaveBeenCalledWith({
        database: 'test-db',
        application: 'MyApp',
        version: '1.0.0',
      });
    });

    it('configures JS client with options', async () => {
      await init('test-db', 'MyApp', '1.0.0', {
        appKey: 'key123',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        description: 'test desc',
      });
      expect(mockBugSplatInstance.setDefaultAppKey).toHaveBeenCalledWith('key123');
      expect(mockBugSplatInstance.setDefaultUser).toHaveBeenCalledWith('Alice');
      expect(mockBugSplatInstance.setDefaultEmail).toHaveBeenCalledWith('alice@example.com');
      expect(mockBugSplatInstance.setDefaultDescription).toHaveBeenCalledWith('test desc');
    });

    it('applies attributes from options during init', async () => {
      await init('test-db', 'MyApp', '1.0.0', {
        attributes: { env: 'production', region: 'us-east' },
      });
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ env: 'production', region: 'us-east' })
      );
    });

    it('applies pre-init setAttribute calls during init', async () => {
      setAttribute('early', 'value');
      await init('test-db', 'MyApp', '1.0.0');
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ early: 'value' })
      );
    });
  });

  describe('post', () => {
    it('returns failure if init was not called', async () => {
      jest.resetModules();
      const { post: isolatedPost } = await import('../BugsplatExpo');
      const result = await isolatedPost(new Error('test'));
      expect(result).toEqual({ success: false, error: expect.any(String) });
    });

    it('posts error via JS client after init', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const error = new Error('test error');
      const result = await post(error);
      expect(result).toEqual({ success: true });
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(error, {
        appKey: undefined,
        user: undefined,
        email: undefined,
        description: undefined,
      });
    });

    it('posts string error by wrapping in Error', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      await post('string error');
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'string error' }),
        expect.any(Object)
      );
    });

    it('passes options to JS client post', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      await post('test', { appKey: 'k', user: 'u', email: 'e', description: 'd' });
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.any(Error),
        { appKey: 'k', user: 'u', email: 'e', description: 'd' }
      );
    });

    it('returns failure when JS client post fails', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      mockBugSplatInstance.post.mockRejectedValueOnce(new Error('network error'));
      const result = await post('test');
      expect(result).toEqual({ success: false, error: 'network error' });
    });

    it('returns failure when JS client post returns error', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      mockBugSplatInstance.post.mockResolvedValueOnce({ error: new Error('server error') });
      const result = await post('test');
      expect(result).toEqual({ success: false, error: 'server error' });
    });
  });

  describe('setUser', () => {
    it('sets user on JS client after init', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setUser('Bob', 'bob@example.com');
      expect(mockBugSplatInstance.setDefaultUser).toHaveBeenCalledWith('Bob');
      expect(mockBugSplatInstance.setDefaultEmail).toHaveBeenCalledWith('bob@example.com');
    });
  });

  describe('setAttribute', () => {
    it('sets attributes on JS client after init', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setAttribute('env', 'staging');
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ env: 'staging' })
      );
    });

    it('accumulates multiple attributes', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setAttribute('env', 'staging');
      setAttribute('build', '42');
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenLastCalledWith(
        expect.objectContaining({ env: 'staging', build: '42' })
      );
    });
  });

  describe('removeAttribute', () => {
    it('removes attribute from JS client after init', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setAttribute('env', 'staging');
      removeAttribute('env');
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ env: 'staging' })
      );
    });
  });

  describe('crash', () => {
    it('logs a warning instead of crashing', () => {
      crash();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('crash() requires native modules')
      );
    });
  });
});

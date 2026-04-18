const mockModule = {
  init: jest.fn().mockResolvedValue(undefined),
  post: jest.fn().mockResolvedValue({ success: true }),
  setUser: jest.fn(),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  crash: jest.fn(),
  hang: jest.fn(),
};

jest.mock('../BugsplatExpoModule', () => ({
  __esModule: true,
  default: mockModule,
}));

const mockBugSplatInstance = {
  post: jest.fn().mockResolvedValue({ error: null, response: {} }),
  postFeedback: jest.fn().mockResolvedValue({
    error: null,
    response: { crash_id: 42, status: 'success', message: 'ok', current_server_time: 0 },
  }),
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

import {
  init,
  post,
  postFeedback,
  setUser,
  setAttribute,
  removeAttribute,
  crash,
  hang,
} from '../BugsplatExpo';

describe('BugsplatExpo (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('calls native init with database, application, version', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect(mockModule.init).toHaveBeenCalledWith(
        'test-db',
        'MyApp',
        '1.0.0',
        undefined
      );
    });

    it('also initializes a JS client so HTTP-only APIs (feedback) work', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect(mockInitReact).toHaveBeenCalledWith({
        database: 'test-db',
        application: 'MyApp',
        version: '1.0.0',
      });
    });

    it('passes options to native init', async () => {
      const options = {
        appKey: 'key123',
        userName: 'Alice',
        userEmail: 'alice@example.com',
      };
      await init('test-db', 'MyApp', '1.0.0', options);
      expect(mockModule.init).toHaveBeenCalledWith(
        'test-db',
        'MyApp',
        '1.0.0',
        options
      );
    });
  });

  describe('post', () => {
    it('posts an Error with message and stack', async () => {
      const error = new Error('something failed');
      const result = await post(error);
      expect(result).toEqual({ success: true });
      expect(mockModule.post).toHaveBeenCalledWith(
        'something failed',
        error.stack,
        undefined
      );
    });

    it('posts a string error', async () => {
      const result = await post('string error');
      expect(result).toEqual({ success: true });
      expect(mockModule.post).toHaveBeenCalledWith(
        'string error',
        'string error',
        undefined
      );
    });

    it('passes options to native post', async () => {
      const options = { user: 'Bob', email: 'bob@example.com' };
      await post('test', options);
      expect(mockModule.post).toHaveBeenCalledWith(
        'test',
        'test',
        options
      );
    });
  });

  describe('setUser', () => {
    it('calls native setUser', () => {
      setUser('Alice', 'alice@example.com');
      expect(mockModule.setUser).toHaveBeenCalledWith(
        'Alice',
        'alice@example.com'
      );
    });

    it('also syncs to JS client so feedback defaults stay in sync', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setUser('Alice', 'alice@example.com');
      expect(mockBugSplatInstance.setDefaultUser).toHaveBeenCalledWith('Alice');
      expect(mockBugSplatInstance.setDefaultEmail).toHaveBeenCalledWith('alice@example.com');
    });
  });

  describe('setAttribute', () => {
    it('calls native setAttribute', () => {
      setAttribute('version', '2.0');
      expect(mockModule.setAttribute).toHaveBeenCalledWith('version', '2.0');
    });

    it('also syncs to JS client', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      setAttribute('env', 'prod');
      expect(mockBugSplatInstance.setDefaultAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ env: 'prod' })
      );
    });
  });

  describe('removeAttribute', () => {
    it('calls native removeAttribute', () => {
      removeAttribute('version');
      expect(mockModule.removeAttribute).toHaveBeenCalledWith('version');
    });
  });

  describe('postFeedback', () => {
    it('fails cleanly if init was not called', async () => {
      jest.resetModules();
      const { postFeedback: isolated } = await import('../BugsplatExpo');
      const result = await isolated('title');
      expect(result).toEqual({ success: false, error: expect.any(String) });
    });

    it('posts feedback via the JS client', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const result = await postFeedback('Login button broken', {
        description: 'Nothing happens when I tap it',
      });
      expect(result).toEqual({ success: true, crashId: 42 });
      expect(mockBugSplatInstance.postFeedback).toHaveBeenCalledWith(
        'Login button broken',
        {
          appKey: undefined,
          user: undefined,
          email: undefined,
          description: 'Nothing happens when I tap it',
        }
      );
    });

    it('passes through user/email/appKey overrides', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      await postFeedback('subject', {
        user: 'u',
        email: 'e',
        appKey: 'k',
        description: 'd',
      });
      expect(mockBugSplatInstance.postFeedback).toHaveBeenCalledWith('subject', {
        appKey: 'k',
        user: 'u',
        email: 'e',
        description: 'd',
      });
    });

    it('returns failure when JS client rejects', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      mockBugSplatInstance.postFeedback.mockRejectedValueOnce(new Error('network error'));
      const result = await postFeedback('subject');
      expect(result).toEqual({ success: false, error: 'network error' });
    });

    it('returns failure when server returns an error', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      mockBugSplatInstance.postFeedback.mockResolvedValueOnce({
        error: new Error('server error'),
        response: null,
      });
      const result = await postFeedback('subject');
      expect(result).toEqual({ success: false, error: 'server error' });
    });
  });

  describe('crash', () => {
    it('calls native crash', () => {
      crash();
      expect(mockModule.crash).toHaveBeenCalled();
    });
  });

  describe('hang', () => {
    it('calls native hang', () => {
      hang();
      expect(mockModule.hang).toHaveBeenCalled();
    });
  });
});

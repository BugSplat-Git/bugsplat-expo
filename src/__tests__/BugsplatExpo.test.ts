jest.mock('expo-blob', () => {});

const mockFileBytes = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ bytes: () => mockFileBytes(uri) })),
}));

const mockExpoFetch = jest.fn();
jest.mock('expo/fetch', () => ({
  fetch: mockExpoFetch,
}));

const mockModule = {
  init: jest.fn().mockResolvedValue(undefined),
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

function postedPart(fn: jest.Mock) {
  const options = fn.mock.calls[0][1];
  return options.attachments[0].data;
}

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

    it('injects expo/fetch into the JS client', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect((mockBugSplatInstance as any)._fetch).toBe(mockExpoFetch);
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
    it('posts an Error via JS client', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const error = new Error('something failed');
      const result = await post(error);
      expect(result).toEqual({ success: true });
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(error, undefined);
    });

    it('posts a string error by wrapping in Error', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      await post('string error');
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'string error' }),
        undefined
      );
    });

    it('passes options to JS client post', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const options = { user: 'Bob', email: 'bob@example.com' };
      await post('test', options);
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.any(Error),
        options
      );
    });

    it('converts a Uint8Array attachment into a named expo/fetch bytes part', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const data = new Uint8Array([1, 2, 3]);
      await post(new Error('x'), { attachments: [{ filename: 'state.bin', data }] });

      const part = postedPart(mockBugSplatInstance.post);
      expect(part).not.toBeInstanceOf(Uint8Array);
      expect(part.name).toBe('state.bin');
      expect(part.type).toBe('application/octet-stream');
      await expect(part.bytes()).resolves.toBe(data);
    });

    it('converts a { uri } file ref into a bytes part read from the file system', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const fileBytes = new Uint8Array([9, 8, 7]);
      mockFileBytes.mockResolvedValue(fileBytes);
      await post(new Error('x'), {
        attachments: [{ filename: 'shot.png', data: { uri: 'file:///cache/shot.png', type: 'image/png' } }],
      });

      const part = postedPart(mockBugSplatInstance.post);
      expect(part).not.toHaveProperty('uri');
      expect(part.name).toBe('shot.png');
      expect(part.type).toBe('image/png');
      await expect(part.bytes()).resolves.toBe(fileBytes);
      expect(mockFileBytes).toHaveBeenCalledWith('file:///cache/shot.png');
    });

    it('names a blob-like attachment that is not a global Blob', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const bytes = new Uint8Array([4, 5]);
      const expoBlob = { type: 'text/plain', size: 2, bytes: async () => bytes };
      await post(new Error('x'), {
        attachments: [{ filename: 'log.txt', data: expoBlob as unknown as Blob }],
      });

      const part = postedPart(mockBugSplatInstance.post);
      expect(part.name).toBe('log.txt');
      expect(part.type).toBe('text/plain');
      await expect(part.bytes()).resolves.toBe(bytes);
    });

    it('passes a global Blob attachment through unchanged', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const attachments = [{ filename: 'componentStack.txt', data: new Blob(['stack']) }];
      await post(new Error('x'), { attachments });
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ attachments })
      );
    });

    it('forwards attributes to JS client post', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      const attributes = { route: 'home', channel: 'beta' };
      await post(new Error('x'), { attributes });
      expect(mockBugSplatInstance.post).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ attributes })
      );
    });

    it('returns failure if init was not called', async () => {
      jest.resetModules();
      const { post: isolatedPost } = await import('../BugsplatExpo');
      const result = await isolatedPost(new Error('test'));
      expect(result).toEqual({ success: false, error: expect.any(String) });
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
        { description: 'Nothing happens when I tap it' }
      );
    });

    it('converts { uri } file refs into expo/fetch bytes parts', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      await postFeedback('Bug', {
        attachments: [{ filename: 'shot.png', data: { uri: 'file:///cache/shot.png', type: 'image/png' } }],
      });

      const part = postedPart(mockBugSplatInstance.postFeedback);
      expect(part).not.toHaveProperty('uri');
      expect(part.name).toBe('shot.png');
      expect(part.type).toBe('image/png');
      expect(typeof part.bytes).toBe('function');
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

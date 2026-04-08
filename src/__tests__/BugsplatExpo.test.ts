const mockModule = {
  init: jest.fn().mockResolvedValue(undefined),
  post: jest.fn().mockResolvedValue({ success: true }),
  setUser: jest.fn(),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  crash: jest.fn(),
};

jest.mock('../BugsplatExpoModule', () => ({
  __esModule: true,
  default: mockModule,
}));

const mockInitReact = jest.fn();
jest.mock('@bugsplat/react', () => ({
  init: mockInitReact,
}));

import { init, post, setUser, setAttribute, removeAttribute, crash } from '../BugsplatExpo';

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

    it('does not use JS fallback', async () => {
      await init('test-db', 'MyApp', '1.0.0');
      expect(mockInitReact).not.toHaveBeenCalled();
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
  });

  describe('setAttribute', () => {
    it('calls native setAttribute', () => {
      setAttribute('version', '2.0');
      expect(mockModule.setAttribute).toHaveBeenCalledWith('version', '2.0');
    });
  });

  describe('removeAttribute', () => {
    it('calls native removeAttribute', () => {
      removeAttribute('version');
      expect(mockModule.removeAttribute).toHaveBeenCalledWith('version');
    });
  });

  describe('crash', () => {
    it('calls native crash', () => {
      crash();
      expect(mockModule.crash).toHaveBeenCalled();
    });
  });
});

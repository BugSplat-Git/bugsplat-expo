import React from "react";

const mockPost = jest.fn().mockResolvedValue({ success: true });

jest.mock("../BugsplatExpo", () => ({
  post: mockPost,
}));

import { NativeErrorBoundary } from "../NativeErrorBoundary";

describe("NativeErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDerivedStateFromError", () => {
    it("returns state with hasError true and the error", () => {
      const error = new Error("test error");
      const state = NativeErrorBoundary.getDerivedStateFromError(error);
      expect(state).toEqual({ hasError: true, error });
    });
  });

  describe("componentDidCatch", () => {
    it("posts the error to BugSplat with component stack", () => {
      const instance = new NativeErrorBoundary({ children: null });
      const error = new Error("render error");
      const errorInfo = { componentStack: "\n    at Foo\n    at Bar", digest: undefined };

      instance.componentDidCatch(error, errorInfo as React.ErrorInfo);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(error, {
        description: "Component stack: \n    at Foo\n    at Bar",
      });
    });

    it("does not throw when post rejects", async () => {
      mockPost.mockRejectedValueOnce(new Error("network error"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const instance = new NativeErrorBoundary({ children: null });
      const error = new Error("render error");
      const errorInfo = { componentStack: "\n    at Foo", digest: undefined };

      instance.componentDidCatch(error, errorInfo as React.ErrorInfo);

      // Flush the microtask queue so the .catch handler runs
      await new Promise((resolve) => process.nextTick(resolve));

      expect(warnSpy).toHaveBeenCalledWith(
        "BugSplat post failed:",
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });
  });

  describe("resetErrorBoundary", () => {
    it("resets hasError and error in state", () => {
      const instance = new NativeErrorBoundary({ children: null });
      // Simulate error state
      instance.state = { hasError: true, error: new Error("oops") };

      // Mock setState to capture the call
      const setStateSpy = jest.fn();
      instance.setState = setStateSpy;

      instance.resetErrorBoundary();

      expect(setStateSpy).toHaveBeenCalledWith({
        hasError: false,
        error: null,
      });
    });
  });

  describe("render", () => {
    it("renders children when there is no error", () => {
      const child = React.createElement("span", null, "hello");
      const instance = new NativeErrorBoundary({ children: child });
      instance.state = { hasError: false, error: null };

      const result = instance.render();
      expect(result).toBe(child);
    });

    it("returns null when there is an error and no fallback", () => {
      const child = React.createElement("span", null, "hello");
      const instance = new NativeErrorBoundary({ children: child });
      instance.state = { hasError: true, error: new Error("oops") };

      const result = instance.render();
      expect(result).toBeNull();
    });

    it("renders ReactNode fallback when provided", () => {
      const fallback = React.createElement("div", null, "error occurred");
      const child = React.createElement("span", null, "hello");
      const instance = new NativeErrorBoundary({
        children: child,
        fallback,
      });
      instance.state = { hasError: true, error: new Error("oops") };

      const result = instance.render();
      expect(result).toBe(fallback);
    });

    it("calls function fallback with error and resetErrorBoundary", () => {
      const error = new Error("oops");
      const fallbackFn = jest.fn().mockReturnValue(
        React.createElement("div", null, "error")
      );
      const child = React.createElement("span", null, "hello");
      const instance = new NativeErrorBoundary({
        children: child,
        fallback: fallbackFn,
      });
      instance.state = { hasError: true, error };

      const result = instance.render();

      expect(fallbackFn).toHaveBeenCalledTimes(1);
      expect(fallbackFn).toHaveBeenCalledWith({
        error,
        resetErrorBoundary: instance.resetErrorBoundary,
      });
      expect(result).toEqual(React.createElement("div", null, "error"));
    });
  });
});

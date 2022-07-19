/**
 * Get a deconstructed promise.
 *
 * @returns An object with a Promise, and the "reject" and "resolve" functions
 * for that Promise.
 * @template T - The type returned by the Promise.
 */
export function getDeconstructedPromise<T>(): {
  promise: Promise<T>;
  reject: (error?: Error) => void;
  resolve: (result: T) => void;
} {
  // Non-null assertion operator used because TypeScript doesn't understand
  // that these are guaranteed to be assigned.
  let resolve!: (result: T) => void;
  let reject!: (error?: Error) => void;
  const promise = new Promise<T>(
    (_resolve: (result: T) => void, _reject: (error?: Error) => void) => {
      resolve = _resolve;
      reject = _reject;
    },
  );
  return { promise, reject, resolve };
}

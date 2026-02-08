/**
 * Internal assertion helper.
 *
 * Intended for library-internal invariants (not user-facing parse errors).
 */
export const assert: (
  condition: unknown,
  message?: string,
) => asserts condition = (
  condition,
  message = "Assertion failed",
): asserts condition => {
  if (!condition) {
    throw new Error(message);
  }
};

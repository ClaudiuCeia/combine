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

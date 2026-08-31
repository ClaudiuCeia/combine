export type ValidCase<T> = Readonly<{
  name: string;
  input: string;
  expected: T;
}>;

const makeExpressionCase = (
  name: string,
  count: number,
): ValidCase<number> => {
  const parts: string[] = [];
  let expected = 0;

  for (let index = 0; index < count; index++) {
    const first = index % 10 + 1;
    parts.push(`(${first} + 2 * 3 - 4 / (2 + 2))`);
    expected += first + 5;
  }

  return { name, input: parts.join(" + "), expected };
};

export const expressionCases: readonly ValidCase<number>[] = [
  makeExpressionCase("small", 3),
  makeExpressionCase("medium", 64),
  makeExpressionCase("large", 512),
];

export const validExpressionExamples: readonly ValidCase<number>[] = [
  { name: "left-associative subtraction", input: "8 - 3 - 2", expected: 3 },
  { name: "left-associative division", input: "8 / 4 / 2", expected: 1 },
  { name: "operator precedence", input: "2 + 3 * 4", expected: 14 },
  { name: "multidigit integer", input: "10 + 25", expected: 35 },
  { name: "all whitespace", input: "\t 2\r\n+ 3 ", expected: 5 },
];

export const invalidExpressionExamples: readonly string[] = [
  "",
  "+1",
  "-1 + 2",
  "1 +",
  "(1 + 2",
  "()",
  "1 2",
  "1 + 2 trailing",
  "1 + * 2",
  "1.5 + 2",
];

export const lateInvalidExpression = `${expressionCases[1]!.input} + )`;

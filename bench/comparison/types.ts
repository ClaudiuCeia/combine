export const parseFailure = Symbol("parse failure");

export type ParseOutput<T> = T | typeof parseFailure;

export type BenchmarkAdapter = Readonly<{
  name: string;
  parseExpression: (input: string) => ParseOutput<number>;
}>;

export type AdapterFactory = Readonly<{
  name: string;
  create: () => BenchmarkAdapter;
}>;

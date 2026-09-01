# Guides

Start with the [root README](../README.md) for installation and a complete first
parser. The rest of the documentation is split by job:

- [API reference](./api.md) - runners, results, primitives, combinators, lexer,
  spans, errors, language helpers, and tracing
- [Grammar guide](./guide.md) - UTF-16 offsets, recursion, `defineLanguage`,
  error design, lexer use, tracing, and migrations
- [Streaming guide](./streaming.md) - pending results, append-only sessions,
  async sources, repeated values, buffering, and custom parsers
- [Recognizer guide](./nondeterministic.md) - multiple matches at one input
  position and explicit cursor advancement

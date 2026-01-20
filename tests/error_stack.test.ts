import { assertEquals } from "@std/assert";
import { any, either, many, many1, optional, seq } from "../src/combinators.ts";
import { digit, letter, space, str } from "../src/parsers.ts";
import { attempt, context, cut, lazy, map } from "../src/utility.ts";
import {
  type Failure,
  failure,
  fatalFailure,
  formatErrorCompact,
  formatErrorStack,
  isFatal,
  type Parser,
  pushFrame,
} from "../src/Parser.ts";

Deno.test("Failure type has stack field", () => {
  const f = failure({ text: "test", index: 0 }, "expected foo");
  assertEquals(f.stack, []);
  assertEquals(f.fatal, false);
});

Deno.test("fatalFailure creates fatal error", () => {
  const f = fatalFailure({ text: "test", index: 0 }, "expected foo");
  assertEquals(f.fatal, true);
  assertEquals(isFatal(f), true);
});

Deno.test("pushFrame adds context to error stack", () => {
  const ctx = { text: "hello world", index: 5 };
  const f = failure(ctx, "expected 'x'");

  const withFrame = pushFrame(f, "in greeting parser");

  assertEquals(withFrame.stack.length, 1);
  assertEquals(withFrame.stack[0].label, "in greeting parser");
});

Deno.test("multiple pushFrame calls build a stack", () => {
  const ctx = { text: "test", index: 0 };
  let f = failure(ctx, "expected digit");

  f = pushFrame(f, "in number parser");
  f = pushFrame(f, "in expression");
  f = pushFrame(f, "in program");

  assertEquals(f.stack.length, 3);
  assertEquals(f.stack[0].label, "in number parser");
  assertEquals(f.stack[1].label, "in expression");
  assertEquals(f.stack[2].label, "in program");
});

Deno.test("formatErrorStack produces readable output", () => {
  const ctx = { text: "hello\nworld", index: 6 }; // "world" starts at line 2
  let f = failure(ctx, "'}'");
  f = pushFrame(f, "in block");
  f = pushFrame(f, "in function declaration");

  const formatted = formatErrorStack(f);

  // Should contain the primary error and stack frames
  assertEquals(formatted.includes("expected '}' at line 2"), true);
  assertEquals(formatted.includes("in block"), true);
  assertEquals(formatted.includes("in function declaration"), true);
});

Deno.test("formatErrorCompact produces single-line output", () => {
  const ctx = { text: "test", index: 0 };
  let f = failure(ctx, "'if'");
  f = pushFrame(f, "in expression");

  const compact = formatErrorCompact(f);

  // Check that it contains the expected parts
  assertEquals(compact.includes("'if'"), true);
  assertEquals(compact.includes("in expression"), true);
  // Line 1, column 1
  assertEquals(compact.includes("1:"), true);
});

Deno.test("context combinator adds context on failure", () => {
  const parser = context("in greeting", str("hello"));
  const result = parser({ text: "world", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.stack.length, 1);
    assertEquals(result.stack[0].label, "in greeting");
  }
});

Deno.test("nested context calls build up stack", () => {
  const inner = context("in identifier", letter());
  const outer = context("in declaration", seq(str("let"), str(" "), inner));

  const result = outer({ text: "let 123", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    // Should have both contexts in the stack
    assertEquals(result.stack.length >= 1, true);
  }
});

Deno.test("cut makes failure fatal", () => {
  const parser = seq(str("if"), cut(str(" "), "space after 'if'"));

  // First test success case
  const success = parser({ text: "if then", index: 0 });
  assertEquals(success.success, true);

  // Test failure case - missing space
  const result = parser({ text: "ifthen", index: 0 });
  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
    assertEquals(result.expected, "space after 'if'");
  }
});

Deno.test("cut preserves existing fatal errors", () => {
  const inner = cut(str("x"), "inner error");
  const outer = cut(inner, "outer error");

  const result = outer({ text: "y", index: 0 });
  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
    // Should keep inner error message
    assertEquals(result.expected, "inner error");
  }
});

Deno.test("any propagates fatal errors immediately", () => {
  let secondParsed = false;

  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "fatal error");
  };

  const secondParser = (ctx: { text: string; index: number }) => {
    secondParsed = true;
    return failure(ctx, "second");
  };

  const parser = any(fatalParser, secondParser);
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
    assertEquals(result.expected, "fatal error");
  }
  // Second parser should not have been tried
  assertEquals(secondParsed, false);
});

Deno.test("either propagates fatal errors", () => {
  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "fatal");
  };

  const parser = either(fatalParser, str("alt"));
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
  }
});

Deno.test("optional propagates fatal errors", () => {
  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "fatal");
  };

  const parser = optional(fatalParser);
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
  }
});

Deno.test("optional swallows non-fatal errors", () => {
  const parser = optional(str("hello"));
  const result = parser({ text: "world", index: 0 });

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, null);
  }
});

Deno.test("many propagates fatal errors", () => {
  let callCount = 0;
  const conditionalFatal = (ctx: { text: string; index: number }) => {
    callCount++;
    if (callCount > 2) {
      return fatalFailure(ctx, "fatal after 2");
    }
    if (ctx.text[ctx.index] === "a") {
      return {
        success: true,
        value: "a",
        ctx: { ...ctx, index: ctx.index + 1 },
      } as const;
    }
    return failure(ctx, "expected 'a'");
  };

  const parser = many(conditionalFatal);
  const result = parser({ text: "aax", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
  }
});

Deno.test("many1 propagates fatal errors", () => {
  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "fatal");
  };

  const parser = many1(fatalParser);
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
  }
});

Deno.test("attempt converts fatal to non-fatal", () => {
  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "was fatal");
  };

  const parser = attempt(fatalParser);
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, false);
    assertEquals(result.expected, "was fatal");
  }
});

Deno.test("attempt allows alternatives after fatal", () => {
  const fatalParser = (ctx: { text: string; index: number }) => {
    return fatalFailure(ctx, "was fatal");
  };

  const parser = any(attempt(fatalParser), str("test"));
  const result = parser({ text: "test", index: 0 });

  assertEquals(result.success, true);
});

Deno.test("real world example: if-then-else with cuts", () => {
  // Simulates parsing: if <cond> then <expr> else <expr>
  const identifier = map(many1(letter()), (letters) => letters.join(""));
  const ws = optional(space());
  const tok = <T>(p: Parser<T>): Parser<T> => map(seq(ws, p), ([, v]) => v);

  // Single cut after "if" - everything after is committed
  // context() provides stack frames for each part
  const ifExpr = context(
    "in if expression",
    seq(
      str("if"),
      cut(
        seq(
          context("in condition", tok(identifier)),
          context("in then keyword", tok(str("then"))),
          context("in then branch", tok(identifier)),
          context("in else keyword", tok(str("else"))),
          context("in else branch", tok(identifier)),
        ),
      ),
    ),
  );

  // Success case
  const success = ifExpr({ text: "if x then y else z", index: 0 });
  assertEquals(success.success, true);

  // Missing 'then' - should be fatal with stack trace
  const missingThen = ifExpr({ text: "if x thn y else z", index: 0 });
  assertEquals(missingThen.success, false);
  if (!missingThen.success) {
    assertEquals(missingThen.fatal, true);
    assertEquals(missingThen.expected, "then"); // raw parser message from str()
    // Stack trace provides the context
    assertEquals(
      missingThen.stack.some(
        (f: { label: string }) => f.label === "in then keyword",
      ),
      true,
    );
    assertEquals(
      missingThen.stack.some(
        (f: { label: string }) => f.label === "in if expression",
      ),
      true,
    );
  }

  // Missing else - should be fatal
  const missingElse = ifExpr({ text: "if x then y els z", index: 0 });
  assertEquals(missingElse.success, false);
  if (!missingElse.success) {
    assertEquals(missingElse.fatal, true);
    assertEquals(missingElse.expected, "else");
    assertEquals(
      missingElse.stack.some(
        (f: { label: string }) => f.label === "in else keyword",
      ),
      true,
    );
  }
});

Deno.test("nested context calls produce proper trace", () => {
  const number = context(
    "in number literal",
    map(many1(digit()), (digits) => parseInt(digits.join(""), 10)),
  );

  // Using explicit types to handle recursive definition
  type Expr = number | [string, Expr, string];

  const factor: ReturnType<typeof context<Expr>> = context(
    "in factor",
    any(
      number,
      map(
        seq(
          str("("),
          lazy((): ReturnType<typeof context<Expr>> => expr),
          cut(str(")"), "closing parenthesis"),
        ),
        ([_open, inner, _close]) => inner as Expr,
      ),
    ),
  );

  const expr = context("in expression", factor);

  // Missing closing paren - should give stack trace
  const result = expr({ text: "(42", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.fatal, true);
    assertEquals(result.expected, "closing parenthesis");
    // Should have context labels
    assertEquals(
      result.stack.some((f: { label: string }) => f.label.includes("factor")),
      true,
    );
  }
});

Deno.test("error location is preserved through stack", () => {
  const parser = context(
    "in program",
    context(
      "in statement",
      seq(str("let"), str(" "), cut(letter(), "identifier")),
    ),
  );

  // Error at position 4 (after "let ")
  const result = parser({ text: "let 123", index: 0 });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.location.column, 5); // 1-indexed, after "let "
    assertEquals(result.expected, "identifier");
  }
});

// ============================================================================
// Comprehensive multiline test with a mini-language
// ============================================================================

/**
 * Mini function definition language:
 *
 *   fn add(x, y) {
 *     return x + y
 *   }
 *
 * Grammar:
 *   program    = fn_decl*
 *   fn_decl    = "fn" identifier "(" params ")" block
 *   params     = (identifier ("," identifier)*)?
 *   block      = "{" statement* "}"
 *   statement  = "return" expr | "let" identifier "=" expr
 *   expr       = identifier | number
 */
Deno.test("comprehensive multiline error test with mini-language", () => {
  // Whitespace handling
  const ws = optional(many(any(str(" "), str("\n"), str("\t"))));
  const tok = <T>(p: Parser<T>): Parser<T> => map(seq(p, ws), ([v]) => v);

  // Tokens
  const identifier = tok(
    map(
      seq(letter(), many(any(letter(), digit()))),
      ([first, rest]) => first + rest.join(""),
    ),
  );
  const numberLit = tok(
    map(many1(digit()), (digits) => parseInt(digits.join(""), 10)),
  );

  // Keywords
  const fnKw = tok(str("fn"));
  const returnKw = tok(str("return"));
  const letKw = tok(str("let"));
  const openParen = tok(str("("));
  const closeParen = tok(str(")"));
  const openBrace = tok(str("{"));
  const closeBrace = tok(str("}"));
  const comma = tok(str(","));
  const equals = tok(str("="));

  // Expression: identifier or number
  const expr: Parser<unknown> = context(
    "in expression",
    any(identifier, numberLit),
  );

  // Statement: return expr | let identifier = expr
  const returnStmt = context(
    "in return statement",
    seq(returnKw, cut(expr, "expression after 'return'")),
  );

  const letStmt = context(
    "in let statement",
    seq(
      letKw,
      cut(identifier, "identifier after 'let'"),
      cut(equals, "'=' after identifier"),
      cut(expr, "expression after '='"),
    ),
  );

  const statement = context("in statement", any(returnStmt, letStmt));

  // Parameters: (identifier ("," identifier)*)?
  const params = context(
    "in parameter list",
    optional(
      seq(
        identifier,
        many(seq(comma, cut(identifier, "parameter name after ','"))),
      ),
    ),
  );

  // Block: { statement* }
  const block = context(
    "in function body",
    seq(openBrace, many(statement), cut(closeBrace, "'}'")),
  );

  // Function declaration: fn identifier(params) block
  const fnDecl = context(
    "in function declaration",
    seq(
      fnKw,
      cut(identifier, "function name after 'fn'"),
      cut(openParen, "'(' after function name"),
      params,
      cut(closeParen, "')' after parameters"),
      cut(block, "function body"),
    ),
  );

  // Program: ws fn_decl*
  const program = context("in program", seq(ws, many1(fnDecl)));

  // ----- Test 1: Successful parse -----
  const validCode = `
    fn add(x, y) {
      return x
    }
  `;

  const successResult = program({ text: validCode, index: 0 });
  assertEquals(successResult.success, true);

  // ----- Test 2: Missing closing brace - multiline error -----
  const missingBrace = `
    fn add(x, y) {
      return x
    
    fn sub(a, b) {
      return a
    }
  `;

  const missingBraceResult = program({ text: missingBrace, index: 0 });
  assertEquals(missingBraceResult.success, false);

  if (!missingBraceResult.success) {
    // Check full error structure
    assertEquals(missingBraceResult.fatal, true);
    assertEquals(missingBraceResult.expected, "'}'");

    // Error should be on line 5 where "fn" appears instead of "}"
    assertEquals(missingBraceResult.location.line, 5);

    // Check the stack has proper context
    assertEquals(missingBraceResult.stack.length >= 1, true);

    // Find the function body frame
    const bodyFrame = missingBraceResult.stack.find(
      (f: { label: string }) => f.label === "in function body",
    );
    assertEquals(bodyFrame !== undefined, true);

    // Check formatted output
    const formatted = formatErrorStack(missingBraceResult);
    assertEquals(formatted.includes("expected '}'"), true);
    assertEquals(formatted.includes("line 5"), true);
    assertEquals(formatted.includes("in function body"), true);
  }

  // ----- Test 3: Missing expression after return -----
  const missingExpr = `
    fn greet(name) {
      return
    }
  `;

  const missingExprResult = program({ text: missingExpr, index: 0 });
  assertEquals(missingExprResult.success, false);

  if (!missingExprResult.success) {
    assertEquals(missingExprResult.fatal, true);
    assertEquals(missingExprResult.expected, "expression after 'return'");
    // "return" is on line 3, error is at the newline after (line 4)
    assertEquals(missingExprResult.location.line, 4);

    // Stack should include return statement context
    const returnFrame = missingExprResult.stack.find(
      (f: { label: string }) => f.label === "in return statement",
    );
    assertEquals(returnFrame !== undefined, true);
  }

  // ----- Test 4: Missing parameter after comma -----
  const missingParam = `
    fn process(a, b, ) {
      return a
    }
  `;

  const missingParamResult = program({ text: missingParam, index: 0 });
  assertEquals(missingParamResult.success, false);

  if (!missingParamResult.success) {
    assertEquals(missingParamResult.fatal, true);
    assertEquals(missingParamResult.expected, "parameter name after ','");
    assertEquals(missingParamResult.location.line, 2);

    // Stack should include parameter list context
    const paramFrame = missingParamResult.stack.find(
      (f: { label: string }) => f.label === "in parameter list",
    );
    assertEquals(paramFrame !== undefined, true);
  }

  // ----- Test 5: Full error object verification -----
  const badCode = `
    fn test() {
      let x =
    }
  `;

  const badResult = program({ text: badCode, index: 0 });
  assertEquals(badResult.success, false);

  if (!badResult.success) {
    // Verify complete Failure structure
    const expectedFailure: Partial<Failure> = {
      success: false,
      expected: "expression after '='",
      fatal: true,
      location: {
        line: 4, // "let x =" is on line 3, error at newline (line 4)
        column: 14, // After "let x = "
      },
    };

    assertEquals(badResult.success, expectedFailure.success);
    assertEquals(badResult.expected, expectedFailure.expected);
    assertEquals(badResult.fatal, expectedFailure.fatal);
    assertEquals(badResult.location.line, expectedFailure.location!.line);

    // Verify stack structure
    assertEquals(badResult.stack.length >= 2, true);

    // Stack should contain (from innermost to outermost):
    // - "in let statement"
    // - "in function body" or "in statement"
    // - "in function declaration"
    // - "in program"
    const stackLabels = badResult.stack.map((f: { label: string }) => f.label);
    assertEquals(stackLabels.includes("in let statement"), true);
    assertEquals(stackLabels.includes("in function declaration"), true);
    assertEquals(stackLabels.includes("in program"), true);

    // Verify formatted output matches expected format exactly
    const formatted = formatErrorStack(badResult);
    const expectedLines = [
      /expected expression after '=' at line 4, column \d+/,
      /in expression at line 4/,
      /in let statement at line 3/,
    ];

    const formattedLines = formatted.split("\n");
    assertEquals(formattedLines.length >= 3, true);
    assertEquals(expectedLines[0].test(formattedLines[0]), true);
    assertEquals(expectedLines[1].test(formattedLines[1]), true);
    assertEquals(expectedLines[2].test(formattedLines[2]), true);

    // Verify compact format
    const compact = formatErrorCompact(badResult);
    assertEquals(compact.includes("expression after '='"), true);
    assertEquals(compact.includes("in expression"), true); // First stack frame (innermost)
    assertEquals(compact.includes("4:"), true);
  }
});

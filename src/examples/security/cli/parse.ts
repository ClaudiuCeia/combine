import { prettyPrintAST } from "../AST/printNode.ts";
import { program } from "../parser/program.ts";

const args = Deno.args;

if (args.length === 0) {
  Deno.exit(1);
}

const parsetree = program()({ text: args[0], index: 0 });
if (parsetree.success) {
  console.log(JSON.stringify(prettyPrintAST(parsetree.value), undefined, 2));
  Deno.exit(0);
}

console.log(JSON.stringify(parsetree, undefined, 2));
Deno.exit(1);

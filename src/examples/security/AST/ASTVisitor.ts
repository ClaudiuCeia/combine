import { AllowRule } from "./AllowRule.ts";

export interface ASTNodeVisitor {
    visit(node: AllowRule): unknown;
    visit(node: AllowRule): unknown;
}
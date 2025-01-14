import * as babel from "@babel/core";
import assert from "assert";
import { uniqueIdentifier } from "../util/randomIdentifier";

export const ADVICE_VAR = "$$ADVICE";

export default async function instrument(
  code: string,
  sourceUrl: string
): Promise<string> {
  return (
    await babel.transformAsync(code, {
      plugins: [transform],
      sourceType: "unambiguous",
      minified: true,
    })
  )?.code!;

  /**
   * This transformation adds join points to observe the execution `enter`-ing
   * and `leave`-ing the body of functions.
   * Also, it adds join points to intercept the evaluation of `yield`, `yield*`,
   * and `await` expressions and the iterator of `for await...of` statements to
   * enable call flow tracking on ES6+ code. The corresponding advice methods
   * should simulate the original behavior of those operations.
   */
  function transform(): babel.PluginItem {
    const { types: t } = babel;

    const ARG = t.identifier(uniqueIdentifier(code));
    const CID = t.identifier(uniqueIdentifier(code));
    const RET = t.identifier(uniqueIdentifier(code));
    const EXC = t.identifier(uniqueIdentifier(code));
    const CATCHARG = t.identifier("e");

    return {
      visitor: {
        Function(path) {
          const { node } = path;

          const { loc: functionLoc } = node;
          assert(functionLoc);
          const sourceLocExpression = t.arrayExpression([
            t.stringLiteral(sourceUrl),
            t.numericLiteral(functionLoc.start.index),
            t.numericLiteral(functionLoc.end.index),
          ]);

          if (t.isArrowFunctionExpression(node)) {
            const { body, params } = node;
            node.params = [t.restElement(ARG)];
            node.body = t.blockStatement([
              t.variableDeclaration("var", [
                t.variableDeclarator(t.arrayPattern(params), ARG),
              ]),
              ...instrumentFunctionBody(
                t.isExpression(body)
                  ? t.blockStatement([t.returnStatement(body)])
                  : body,
                ARG
              ).body,
            ]);
          } else {
            const { body } = node;
            node.body = instrumentFunctionBody(body, t.identifier("arguments"));
          }

          function instrumentFunctionBody(
            node: babel.types.BlockStatement,
            argIdentifier: babel.types.Identifier
          ): babel.types.BlockStatement {
            return t.blockStatement([
              t.variableDeclaration("var", [
                t.variableDeclarator(CID),
                t.variableDeclarator(RET),
                t.variableDeclarator(EXC),
              ]),
              t.expressionStatement(
                t.assignmentExpression(
                  "=",
                  CID,
                  adviceCall("enter", [sourceLocExpression, argIdentifier])
                )
              ),
              t.tryStatement(
                node,
                t.catchClause(
                  CATCHARG,
                  t.blockStatement([
                    t.expressionStatement(
                      t.assignmentExpression(
                        "=",
                        EXC,
                        t.objectExpression([
                          t.objectProperty(CATCHARG, CATCHARG),
                        ])
                      )
                    ),
                    t.throwStatement(CATCHARG),
                  ])
                ),
                t.blockStatement([
                  t.expressionStatement(adviceCall("leave", [CID, RET, EXC])),
                ])
              ),
            ]);
          }
        },

        ReturnStatement(path) {
          const { node } = path;
          const { argument } = node;
          if (!argument) return;
          node.argument = t.assignmentExpression("=", RET, argument);
        },

        YieldExpression(path) {
          const { node } = path;
          const { argument, delegate } = node;
          node.argument = adviceCall(
            delegate ? "yieldDelegate" : "yield",
            argument ? [argument] : []
          );
          node.delegate = true;
        },

        AwaitExpression(path) {
          const { node } = path;
          const { argument } = node;
          node.argument = adviceCall("await", [argument]);
        },

        ForOfStatement(path) {
          const { node } = path;
          const { await: isAwait, right } = node;
          if (!isAwait) return;
          node.right = adviceCall("forAwaitOf", [right]);
        },
      },
    };

    function adviceCall(name: string, args: babel.types.Expression[]) {
      return t.callExpression(
        t.memberExpression(t.identifier(ADVICE_VAR), t.identifier(name)),
        args
      );
    }
  }
}

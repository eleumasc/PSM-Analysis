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

          // process `var` declarations for hoisting

          const varDecls = Object.values(path.scope.bindings)
            .filter((binding) => binding.kind === "var")
            .map((binding) => t.variableDeclarator(binding.identifier));

          path.traverse({
            VariableDeclaration(path) {
              const { node } = path;
              if (node.kind !== "var") return;
              if (path.canHaveVariableDeclarationOrExpression()) {
                if (path.parentPath.isForStatement()) {
                  path.replaceWith(
                    t.sequenceExpression(
                      node.declarations
                        .filter((decl) => decl.init)
                        .map((decl) =>
                          t.assignmentExpression("=", decl.id, decl.init!)
                        )
                    )
                  );
                } else {
                  assert(node.declarations.length === 1);
                  const [declaration] = node.declarations;
                  path.replaceWith(declaration.id);
                }
              } else {
                path.replaceWith(
                  t.expressionStatement(
                    t.sequenceExpression(
                      node.declarations
                        .filter((decl) => decl.init)
                        .map((decl) =>
                          t.assignmentExpression("=", decl.id, decl.init!)
                        )
                    )
                  )
                );
              }
            },

            Function(path) {
              path.skip();
            },
          });

          // instrument function body

          const { loc: functionLoc } = node;
          assert(functionLoc);
          const sourceLocExpression = t.arrayExpression([
            t.valueToNode(sourceUrl),
            t.valueToNode(functionLoc.start.index),
            t.valueToNode(functionLoc.end.index),
          ]);

          const instrumentedFunctionBody = (
            node: babel.types.BlockStatement,
            argIdentifier: babel.types.Identifier
          ): babel.types.BlockStatement => {
            return t.blockStatement([
              ...(varDecls.length > 0
                ? [t.variableDeclaration("var", varDecls)]
                : []),
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
          };

          if (t.isArrowFunctionExpression(node)) {
            const { body, params } = node;
            node.params = [t.restElement(ARG)];
            node.body = t.blockStatement([
              t.variableDeclaration("var", [
                t.variableDeclarator(t.arrayPattern(params), ARG),
              ]),
              ...instrumentedFunctionBody(
                t.isExpression(body)
                  ? t.blockStatement([t.returnStatement(body)])
                  : body,
                ARG
              ).body,
            ]);
          } else {
            const { body } = node;
            node.body = instrumentedFunctionBody(
              body,
              t.identifier("arguments")
            );
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
          const argumentPath = path.get("argument");
          node.argument = adviceCall("await", [argument]);
          path.replaceWith(t.callExpression(node, []));
          path.skip();
          path.requeue(argumentPath);
        },

        ForOfStatement(path) {
          const { node } = path;
          const { await: isAwait, left, right } = node;
          if (!isAwait) return;
          if (t.isVariableDeclaration(left)) {
            assert(left.declarations.length === 1);
            const [declaration] = left.declarations;
            declaration.id = t.arrayPattern([declaration.id]);
          } else {
            node.left = t.arrayPattern([left]);
          }
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

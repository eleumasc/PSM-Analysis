import * as babel from "@babel/core";

export const ADVICE_VAR = "$$ADVICE";

export default async function instrument(
  code: string,
  sourceUrl: string
): Promise<string> {
  return (
    await babel.transformAsync(code, {
      plugins: [transform],
      sourceType: "unambiguous",
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

    return {
      visitor: {
        Function(path) {
          const { node } = path;
          const { loc } = node;
          if (t.isArrowFunctionExpression(node)) {
            const { body, params } = node;
            const argsId = path.scope.generateUidIdentifier("args");
            node.params = [t.restElement(argsId)];
            node.body = t.blockStatement([
              t.variableDeclaration("var", [
                t.variableDeclarator(t.arrayPattern(params), argsId),
              ]),
              ...instrumentFunctionBody(
                t.isExpression(body)
                  ? t.blockStatement([t.returnStatement(body)])
                  : body,
                argsId,
                loc!
              ).body,
            ]);
          } else {
            const { body } = node;
            node.body = instrumentFunctionBody(
              body,
              t.identifier("arguments"),
              loc!
            );
          }
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
          const { await, right } = node;
          if (!await) return;
          node.right = adviceCall("forAwaitOf", [right]);
        },
      },
    };

    function instrumentFunctionBody(
      node: babel.types.BlockStatement,
      argsId: babel.types.Identifier,
      functionLoc: babel.types.SourceLocation
    ) {
      return t.blockStatement([
        t.expressionStatement(
          adviceCall("enter", [
            t.arrayExpression([
              t.stringLiteral(sourceUrl),
              t.numericLiteral(functionLoc.start.index),
              t.numericLiteral(functionLoc.end.index),
            ]),
            argsId,
          ])
        ),
        t.tryStatement(
          node,
          null,
          t.blockStatement([t.expressionStatement(adviceCall("leave", []))])
        ),
      ]);
    }

    function adviceCall(name: string, args: babel.types.Expression[]) {
      return t.callExpression(
        t.memberExpression(t.identifier(ADVICE_VAR), t.identifier(name)),
        args
      );
    }
  }
}

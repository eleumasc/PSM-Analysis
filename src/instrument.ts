import * as babel from "@babel/core";

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
          node.argument = metaCall(
            delegate ? "yieldDelegate" : "yield",
            argument ? [argument] : []
          );
          node.delegate = true;
        },

        AwaitExpression(path) {
          const { node } = path;
          const { argument } = node;
          node.argument = metaCall("await", [argument]);
        },

        ForOfStatement(path) {
          const { node } = path;
          const { await, right } = node;
          if (!await) return;
          node.right = metaCall("forAwaitOf", [right]);
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
          metaCall("enter", [
            t.buildUndefinedNode(), // t.thisExpression(),
            argsId,
            t.arrayExpression([
              t.stringLiteral(sourceUrl),
              t.numericLiteral(functionLoc.start.index),
              t.numericLiteral(functionLoc.end.index),
            ]),
          ])
        ),
        t.tryStatement(
          node,
          null,
          t.blockStatement([t.expressionStatement(metaCall("leave", []))])
        ),
      ]);
    }

    function metaCall(name: string, args: babel.types.Expression[]) {
      return t.callExpression(
        t.memberExpression(t.identifier("$$__META"), t.identifier(name)),
        args
      );
    }
  }
}

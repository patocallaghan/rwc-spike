import swc from "@swc/core";
import V from "@swc/core/Visitor.js";
const Visitor = V.default;

let imports = [];
class ImportAnalyzer extends Visitor {
  visitCallExpression(e) {
    let callee;
    if (e.callee.type === 'MemberExpression' && e.callee.object.callee.value === 'import') {
      callee = e.callee.object;
    } else if (e.callee.type === 'Identifier' && e.callee.value === 'import' ) {
      callee = e;
    }
    if (callee) {
      // it's a syntax error to have anything other than exactly one
      // argument, so we can just assume this exists
      let argument = callee.arguments[0];

      switch (argument.expression.type) {
        case 'StringLiteral':
          imports.push({
            isDynamic: true,
            specifier: argument.expression.value,
          });
          break;
        case 'TemplateLiteral':
          let expression = argument.expression;
          if (expression.quasis.length === 1) {
            imports.push({
              isDynamic: true,
              specifier: expression.quasis[0].cooked.value,
            });
          } else {
            imports.push({
              cookedQuasis: expression.quasis.map(templateElement => templateElement.cooked.value),
              expressionNameHints: [...expression.expressions].map(inferNameHint),
            });
          }
          break;
        default:
          throw new Error('import() is only allowed to contain string literals or template string literals');
      }
    }
    return e;
  }

  visitImportDeclaration(e) {
    imports.push({
      isDynamic: false,
      specifier: e.source.value,
    });
    return e;
  }

  visitExportNamedDeclaration(e) {
    if (e.source) {
      imports.push({
        isDynamic: false,
        specifier: e.source.value,
      });
    }

    return e;
  }
}

const ast = swc.parseSync(
  `import test from 'some-test';
   import { something } from 'what-now';
   import('react').then(module => module.default);
   import('foo').then(module => module.default);
   import(\`react-dom\`).then(module => module.default);
   import(\`bar-\${baz}\`).then(module => module.default);
   let highchart = import('highcharts');
`, {
    dynamicImport: true
});
const out = swc.transformSync(
  ast,
  {
    plugin: m => new ImportAnalyzer().visitProgram(m)
  }
);

function inferNameHint(exp) {
  if (exp.type === 'Identifier') {
    return exp.value;
  }
}

console.log(imports);
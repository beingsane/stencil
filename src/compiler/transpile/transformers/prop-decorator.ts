import { catchError } from '../../util';
import { ModuleFileMeta, Diagnostic, PropMeta, PropOptions } from '../../interfaces';
import { TYPE_NUMBER, TYPE_BOOLEAN } from '../../../util/constants';
import * as ts from 'typescript';


export function getPropDecoratorMeta(moduleFile: ModuleFileMeta, diagnostics: Diagnostic[], classNode: ts.ClassDeclaration) {
  moduleFile.cmpMeta.propsMeta = [];

  const decoratedMembers = classNode.members.filter(n => n.decorators && n.decorators.length);

  decoratedMembers.forEach(memberNode => {
    let isProp = false;
    let propName: string = null;
    let propType: number = null;
    let userPropOptions: PropOptions = null;

    memberNode.forEachChild(n => {

      if (n.kind === ts.SyntaxKind.Decorator && n.getChildCount() > 1) {
        const child = n.getChildAt(1);
        const firstToken = child.getFirstToken();

        // If the first token is @State()
        if (firstToken && firstToken.getText() === 'Prop') {
          isProp = true;

        } else if (!firstToken && child.getText() === 'Prop') {
          // If the first token is @State
          isProp = true;
        }

        n.getChildAt(1).forEachChild(n => {
          if (n.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            try {
              const fnStr = `return ${n.getText()};`;
              userPropOptions = Object.assign(userPropOptions || {}, new Function(fnStr)());

            } catch (e) {
              const d = catchError(diagnostics, e);
              d.messageText = `parse prop options: ${e}`;
              d.absFilePath = moduleFile.tsFilePath;
            }
          }
        });

      } else if (isProp) {
        if (n.kind === ts.SyntaxKind.Identifier && !propName) {
          propName = n.getText();

        } else if (!propType) {
          if (n.kind === ts.SyntaxKind.BooleanKeyword) {
            propType = TYPE_BOOLEAN;

          } else if (n.kind === ts.SyntaxKind.NumberKeyword) {
            propType = TYPE_NUMBER;
          }
        }

      }

    });

    if (isProp && propName) {
      const prop: PropMeta = {
        propName: propName
      };

      if (propType) {
        prop.propType = propType;
      }

      if (userPropOptions) {
        if (typeof userPropOptions.type === 'string') {
          userPropOptions.type = userPropOptions.type.toLowerCase().trim();

          if (userPropOptions.type === 'boolean') {
            prop.propType = TYPE_BOOLEAN;

          } else if (userPropOptions.type === 'number') {
            prop.propType = TYPE_NUMBER;
          }
        }

        if (typeof userPropOptions.state === 'boolean') {
          prop.isStateful = !!userPropOptions.state;
        }
      }

      moduleFile.cmpMeta.propsMeta.push(prop);

      memberNode.decorators = undefined;
    }
  });

  moduleFile.cmpMeta.propsMeta = moduleFile.cmpMeta.propsMeta.sort((a, b) => {
    if (a.propName.toLowerCase() < b.propName.toLowerCase()) return -1;
    if (a.propName.toLowerCase() > b.propName.toLowerCase()) return 1;
    return 0;
  });
}
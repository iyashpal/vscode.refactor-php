import * as vscode from 'vscode';
import * as resolve from './Resolvers';
export { default as Config } from './Config';

/**
 * Register all code actions.
 * 
 * @param context vscode.ExtensionContext
 * 
 * @returns void
 */
export function codeActionsProvider(context: vscode.ExtensionContext): void {

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('php', new resolve.NamespaceResolver(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

}

/**
 * Register extension commands.
 * 
 * @returns void
 */
export function commandsProvider() {
    vscode.commands.registerCommand('php.refactoring.demo', () => new resolve.ImportsSortingResolver());
}


export const providers = {
    register: {
        commands: commandsProvider,
        codeActions: codeActionsProvider,
    }
};

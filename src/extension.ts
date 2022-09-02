import * as vscode from 'vscode';
import { subscribeToDocumentChanges, EMOJI_MENTION } from './diagnostics';

export function activate (context: vscode.ExtensionContext) {
	// Log the activation text.
	console.log('Refactor PHP extension activated.');

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('php', new Emojizer(), {
			providedCodeActionKinds: Emojizer.providedCodeActionKinds
		})
	);

	const emojiDiagnostics = vscode.languages.createDiagnosticCollection('emoji');

	context.subscriptions.push(emojiDiagnostics);

	subscribeToDocumentChanges(context, emojiDiagnostics);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('php', new Emojinfo(), {
			providedCodeActionKinds: Emojinfo.providedCodeActionKinds
		})
	);
}

export function deactivate () { }

export class Emojizer implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	public provideCodeActions (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		if (!this.isAtStartOfSmiley(document, range)) {
			return;
		}

		const replaceWithSmileyCatFix = this.createFix(document, range, `😺`);

		const replaceWithSmileyFix = this.createFix(document, range, '😀');

		replaceWithSmileyFix.isPreferred = true;

		const replaceWithSmileyHankyFix = this.createFix(document, range, '💩');

		return [
			replaceWithSmileyCatFix,
			replaceWithSmileyFix,
			replaceWithSmileyHankyFix,
		];
	}

	private isAtStartOfSmiley (document: vscode.TextDocument, range: vscode.Range) {
		const start = range.start;
		const line = document.lineAt(start.line);
		return line.text[start.character] === ':' && line.text[start.character + 1] === ')';
	}

	private createFix (document: vscode.TextDocument, range: vscode.Range, emoji: string): vscode.CodeAction {
		const fix = new vscode.CodeAction(`Convert to ${ emoji }`, vscode.CodeActionKind.QuickFix);

		fix.edit = new vscode.WorkspaceEdit();

		fix.edit.replace(document.uri, new vscode.Range(range.start, range.start.translate(0, 2)), emoji);

		return fix;
	}
}


export class Emojinfo implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	public provideCodeActions (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		return context.diagnostics.filter(diagnostic => diagnostic.code === EMOJI_MENTION)
			.map(diagnostic => this.createCommandCodeAction(diagnostic))
	}

	private createCommandCodeAction (diagnostic: vscode.Diagnostic): any {
		throw new Error('Method not implemented.');
	}
}

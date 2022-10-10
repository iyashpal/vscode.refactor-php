import * as vscode from 'vscode';
import { providers } from './Core';

export async function activate(context: vscode.ExtensionContext) {
	// Log the activation text.
	console.log('Refactoring (PHP) extension activated.');

	providers.register.commands();

	providers.register.codeActions(context);
}

export function deactivate() { }

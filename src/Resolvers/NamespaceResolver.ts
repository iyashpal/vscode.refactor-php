import * as vscode from "vscode";
import { BuiltInClasses } from ".";

export default class NamespaceResolver implements vscode.CodeActionProvider {

    private namespace: string = '';

    private actions: vscode.CodeAction[] = [];

    private action: 'expand' | 'import' = 'import';

    private selection: vscode.Selection = {} as vscode.Selection;

    private document: vscode.TextDocument = {} as vscode.TextDocument;

    private readonly lookupExp: RegExp = new RegExp(/[a-zA-Z0-9\\]+/);


    public async provideCodeActions (document: vscode.TextDocument, selection: vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<(vscode.CodeAction | vscode.Command)[]> {

        this.document = document;

        this.selection = selection;

        this.namespace = this.findNamespace(document, selection);

        await this.resolveSelection(selection, document);

        return this.actions;
    }

    public async inlineImport (selection: vscode.Selection) {

    }

    public async useImport () {

    }

    /**
     * Find the namespace from selection.
     * 
     * @param document 
     * @param selection 
     * @returns {boolean | string}
     */
    private findNamespace (document: vscode.TextDocument, selection: vscode.Selection): string {
        if (this.selection === undefined) {

            return '';
        }

        let range = document.getWordRangeAtPosition(selection.active, this.lookupExp);

        return range ? document.getText(range) : '';
    }

    private async resolveSelection (selection: vscode.Selection, document: vscode.TextDocument) {
        this.actions = [];

        let namespace = this.findNamespace(document, selection);

        if (/\\/.test(namespace)) {
            this.action = 'import';
            let { useStatements } = this.getDecelerations(namespace.replace(/^\\?/, ''), document);

            let classBasename = namespace.match(/\w+/g)?.pop();

            let isSelectionOnUseStatements = useStatements.some(({ line }) => line === selection.active.line);

            if (classBasename && !isSelectionOnUseStatements) {

                this.actions.push(this.resolve(document, selection, classBasename));
            }

        } else {
            this.action = 'expand';
            let files = await vscode.workspace.findFiles(`**/${ namespace }.php`, undefined, 10);

            let namespaces = await this.findNamespaces(namespace, files);

            for (let i in namespaces) {
                this.actions.push(this.resolve(document, selection, `\\${ namespaces[i] }`));
            }
        }
    }

    async doImport (editor: vscode.WorkspaceEdit) {
        if (this.action === 'import') {
            let namespace = this.findNamespace(this.document, this.selection);

            namespace = namespace.replace(/^\\?/, '');

            let { useStatements, decelerations } = this.getDecelerations(namespace, this.document);
            let [prepend, append, insertLine] = this.getInsertLine(decelerations);

            let range = new vscode.Range(new vscode.Position(Number(insertLine), 0), new vscode.Position(Number(insertLine) + 1, 0));

            let isSelectionOnUseStatements = useStatements.some(({ text }) => {
                return text.match(/(\w+)/g)?.pop() === namespace.match(/(\w+)/g)?.pop();
            });

            if (!isSelectionOnUseStatements) {
                editor.replace(this.document.uri, range, `${ prepend }use ${ namespace };${ append }`);
            }
        }
    }

    getInsertLine (declarationLines: { phpTag?: number, namespace?: number, useStatement?: number, class?: number }) {
        let prepend = declarationLines.phpTag === 0 ? '' : '\n';
        let append = '\n';
        let insertLine = declarationLines.phpTag;

        if (prepend === '' && declarationLines.namespace) {
            prepend = '\n';
        }

        if (declarationLines.useStatement) {
            prepend = '';
            insertLine = declarationLines.useStatement;
        } else if (declarationLines.namespace) {
            insertLine = declarationLines.namespace;
        }

        if (declarationLines.class && declarationLines.useStatement && declarationLines.phpTag && declarationLines.namespace) {
            if (((declarationLines.class - declarationLines.useStatement) <= 1 || (declarationLines.class - declarationLines.namespace) <= 1 || (declarationLines.class - declarationLines.phpTag) <= 1)) {

            }
            append = '\n\n';
        }

        return [prepend, append, insertLine];
    }


    private findNamespaces (namespace: string, files: vscode.Uri[]): Promise<any> {
        return new Promise((resolve, reject) => {
            let textDocuments = this.getTextDocuments(files, namespace);

            Promise.all(textDocuments).then(docs => {
                let parsedNamespaces = this.parseNamespaces(docs, namespace);

                resolve(parsedNamespaces);
            });
        });
    }

    getTextDocuments (files: vscode.Uri[], namespace: string) {
        let textDocuments = [];

        for (let i = 0; i < files.length; i++) {
            let fileName = files[i].fsPath.replace(/^.*[\\\/]/, '').split('.')[0];

            if (fileName !== namespace) {
                continue;
            }

            textDocuments.push(vscode.workspace.openTextDocument(files[i]));
        }

        return textDocuments;
    }

    parseNamespaces (docs: vscode.TextDocument[], resolving: string) {
        let parsedNamespaces: string[] = [];

        for (let i = 0; i < docs.length; i++) {
            for (let line = 0; line < docs[i].lineCount; line++) {
                let textLine = docs[i].lineAt(line).text;

                if (textLine.startsWith('namespace ') || textLine.startsWith('<?php namespace ')) {
                    let namespace = textLine.match(/^(namespace|(<\?php namespace))\s+(.+)?;/)?.pop();
                    let fqcn = `${ namespace }\\${ resolving }`;

                    if (!parsedNamespaces.includes(fqcn)) {
                        parsedNamespaces.push(fqcn);
                        break;
                    }
                }
            }
        }

        // If selected text is a built-in php class add that at the beginning.
        if (BuiltInClasses.includes(resolving)) {
            parsedNamespaces.unshift(resolving);
        }

        // If namespace can't be parsed but there is a file with the same
        // name of selected text then assuming it's a global class and
        // add that in the parsedNamespaces array as a global class.
        if (parsedNamespaces.length === 0 && docs.length > 0) {
            parsedNamespaces.push(resolving);
        }

        return parsedNamespaces;
    }

    private hasConfliction (statements: string[], namespace: string) {

    }

    private getDecelerations (namespace: string, document: vscode.TextDocument): { useStatements: { text: string, line: number }[], decelerations: object } {
        let useStatements: object[] = [];
        let declarationLines = {
            phpTag: 0,
            namespace: 0,
            useStatement: 0,
            class: 0
        };

        for (let line = 0; line < document.lineCount; line++) {
            let lineNumber = line + 1;
            let text = document.lineAt(line).text.trim();

            // break if all declarations were found.
            if (declarationLines.phpTag && declarationLines.namespace && declarationLines.useStatement && declarationLines.class) {
                break;
            }

            if (text.startsWith('<?php')) {
                declarationLines.phpTag = lineNumber;
            } else if (text.startsWith('namespace ') || text.startsWith('<?php namespace')) {
                declarationLines.namespace = lineNumber;
            } else if (text.startsWith('use ')) {
                useStatements.push({ text, line });
                declarationLines.useStatement = lineNumber;
            } else if (/(class|trait|interface)\s+\w+/.test(text)) {
                declarationLines.class = lineNumber;
            }
        }

        return { useStatements, decelerations: declarationLines };
    }


    private resolve (document: vscode.TextDocument, selection: vscode.Selection, text: string): vscode.CodeAction {
        let message = `Convert to ${ text }`;

        if (this.action === 'expand') {
            message = `Expand to ${ text }`;
        }



        const fix = new vscode.CodeAction(message, vscode.CodeActionKind.Refactor);

        let range = document.getWordRangeAtPosition(selection.active, this.lookupExp);

        if (range) {
            fix.edit = new vscode.WorkspaceEdit();

            fix.edit.replace(document.uri, range, text);

            this.doImport(fix.edit);
        }


        return fix;
    }

}

import * as vscode from "vscode";
import { BuiltInClasses } from ".";

export default class NamespaceResolver implements vscode.CodeActionProvider {

    /**
     * Regular expression to grab the class namespace.
     */
    public static readonly lookupExp: RegExp = new RegExp(/[a-zA-Z0-9\\]+/);


    public async import (selection: vscode.Selection) {

    }

    public async extend () {

    }


    private lookupNamespace (selection: vscode.Selection) {

    }



    public async provideCodeActions (document: vscode.TextDocument, selection: vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        let namespace = this.findNamespace(document, selection);

        if (/\\/.test(namespace)) {
            let [useStatements, decelerationLines] = this.getDecelerations(namespace.replace(/^\\?/, ''), document);

            let classBasename = namespace.match(/\w+/g)?.pop();

            if (classBasename) {
                actions.push(this.resolve(document, selection, classBasename));
            }

        } else {
            let files = await vscode.workspace.findFiles(`**/${ namespace }.php`, undefined, 10);
            
            let namespaces = await this.findNamespaces(namespace, files);

            for (let i in namespaces) {
                actions.push(this.resolve(document, selection, `\\${ namespaces[i] }`));
            }
        }

        return actions ?? null;
    }


    /**
     * Find the namespace from selection.
     * 
     * @param document 
     * @param selection 
     * @returns {boolean | string}
     */
    private findNamespace (document: vscode.TextDocument, selection: vscode.Selection | undefined): string {
        if (selection === undefined) {

            return '';
        }

        let range = document.getWordRangeAtPosition(selection.active, NamespaceResolver.lookupExp);

        return range ? document.getText(range) : '';
    }

    private async resolveSelection (selection: vscode.Selection, document: vscode.TextDocument, callback: (action: vscode.CodeAction) => void) {
        let namespace = this.findNamespace(document, selection);

        if (/\\/.test(namespace)) {
            let [useStatements, decelerationLines] = this.getDecelerations(namespace.replace(/^\\?/, ''), document);

            let classBasename = namespace.match(/\w+/g)?.pop();


        } else {
            let files = await vscode.workspace.findFiles(`**/${ namespace }.php`, undefined, 10);
            let namespaces = await this.findNamespaces(namespace, files);

            callback(this.resolve(document, selection, 'testing a'));
            console.log(files, namespaces);
        }
    }


    private findNamespaces (namespace: string, files: vscode.Uri[]): Promise<any> {
        return new Promise((resolve, reject) => {
            let textDocuments = this.getTextDocuments(files, namespace);

            // console.log(textDocuments);

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

    private getDecelerations (namespace: string, document: vscode.TextDocument) {
        let useStatements = [];
        let declarationLines = {
            phpTag: 0,
            namespace: 0,
            useStatement: 0,
            class: 0
        };

        for (let line = 0; line < document.lineCount; line++) {
            let lineNumber = line + 1;
            let text = document.lineAt(line).text;

            if (namespace !== null && text === `use ${ namespace };`) {
                break;
            }

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

        return [useStatements, declarationLines];
    }


    private resolve (document: vscode.TextDocument, selection: vscode.Selection, text: string): vscode.CodeAction {

        const fix = new vscode.CodeAction(`Convert to ${ text }`, vscode.CodeActionKind.QuickFix);

        let range = document.getWordRangeAtPosition(selection.active, NamespaceResolver.lookupExp);

        if (range) {
            fix.edit = new vscode.WorkspaceEdit();

            fix.edit.replace(document.uri, range, text);
        }


        return fix;
    }

}

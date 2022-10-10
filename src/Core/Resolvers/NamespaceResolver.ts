import * as vscode from "vscode";
import { BuiltInClasses } from ".";

export default class NamespaceResolver implements vscode.CodeActionProvider {

    /**
     * Extracted namespace from the active selection.
     * 
     * @var string
     */
    private namespace: string = '';

    /**
     * List of all available actions.
     * 
     * @var vscode.CodeAction]`
     */
    private codeActions: vscode.CodeAction[] = [];

    /**
     * List of all namespaces (documents listed based on the selection).
     * 
     * @var string[]
     */
    private openedDocumentsNamespaces: string[] = [];

    /**
     * Current opened editor's active selection.
     * 
     * @var vscode.Selection
     */
    private selection: vscode.Selection = {} as vscode.Selection;

    /**
     * Details of all declarations (specifically namespaces) from the active document.
     * 
     * @var vscode.DeclarationType
     */
    private declarations: DeclarationType = {} as DeclarationType;

    /**
     * Current opened document in editor.
     * 
     * @var vscode.TextDocument
     */
    private document: vscode.TextDocument = {} as vscode.TextDocument;

    /**
     * Action type based on the selection pattern.
     * 
     * @var {'inlineImport' | 'useImport'}
     */
    private actionType: 'inlineImport' | 'useImport' = 'inlineImport';

    /**
     * Regular expression to lookup the selection namespace.
     * 
     * @var {RegExp}
     */
    private readonly namespaceExp: RegExp = new RegExp(/[a-zA-Z0-9\\]+/);


    /**
     * Provide the action list of selection.
     * 
     * @param document vscode.TextDocument
     * @param selection vscode.Selection
     * @param context vscode.CodeActionContext
     * @param token vscode.CancellationToken
     * 
     * @returns Promise<(vscode.CodeAction|vscode.Command)[]>
     */
    public async provideCodeActions(document: vscode.TextDocument, selection: vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<(vscode.CodeAction | vscode.Command)[]> {

        this.document = document;

        this.selection = selection;

        this.declarations = {
            php: { line: 0, statement: '' },
            namespace: { line: 0, statement: '' },
            use: { line: 0, statements: [] },
            class: { line: 0, statement: '' }
        };

        await this
            .resolveNamespace()
            .resolveDeclarations()
            .resolveAction(document, selection);

        return this.codeActions;
    }

    /**
     * Resolve action on document selection.
     * 
     * @param document vscode.TextDocument
     * @param selection vscode.Selection
     * 
     * @returns Promise<void>
     */
    private async resolveAction(document: vscode.TextDocument, selection: vscode.Selection): Promise<void> {
        this.codeActions = [];
        this.openedDocumentsNamespaces = [];

        // run the specified action.
        await this[this.actionType](document, selection);
    }

    /**
     * Resolve class namespace to inline instead of using the "use" statement.
     * @param document 
     * @param selection 
     * 
     * @returns Promise<void>
     */
    public async inlineImport(document: vscode.TextDocument, selection: vscode.Selection): Promise<void> {
        let documents = (await vscode.workspace.findFiles(`**/${this.getNamespaceBase()}.php`, undefined, 10))
            .filter(file => this.isFilenameMatchesToNamespace(file));

        for (let index in documents) {

            this.resolveOpenedFileNamespace(
                await vscode.workspace.openTextDocument(documents[index])
            );

        }

        // If selected text is a built-in class add it on top of all.
        if (BuiltInClasses.includes(this.getUsableNamespace())) {
            this.openedDocumentsNamespaces.unshift(this.getUsableNamespace());
        }

        // If document file available and the namespace is missing just add the selected namespace as the class maybe globally added.
        if (this.openedDocumentsNamespaces.length === 0 && documents.length > 0) {
            this.openedDocumentsNamespaces.push(this.getUsableNamespace());
        }

        this.openedDocumentsNamespaces.map(documentNamespace => {
            const codeAction = new vscode.CodeAction(`Expand "${documentNamespace}"`, vscode.CodeActionKind.RefactorRewrite);

            let range = document.getWordRangeAtPosition(selection.active, this.namespaceExp);

            if (range) {
                codeAction.edit = new vscode.WorkspaceEdit();

                codeAction.edit.replace(document.uri, range, `\\${documentNamespace}`);

            }

            this.codeActions.push(codeAction);
        });
    }


    /**
     * Resolve class namespace to use statement instead of inline statement.
     * 
     * @param document vscode.TextDocument Currently opened document.
     * @param selection vscode.Selection Active selection from the opened document.
     * 
     * @returns Promise<any>
     */
    public async useImport(document: vscode.TextDocument, selection: vscode.Selection): Promise<any> {

        if (this.getNamespaceBase() && this.isSelectionNotOnUseStatements()) {

            const codeAction = new vscode.CodeAction(`Import "${this.getUsableNamespace()}"`, vscode.CodeActionKind.RefactorRewrite);

            let range = document.getWordRangeAtPosition(selection.active, this.namespaceExp);

            if (range) {
                codeAction.edit = new vscode.WorkspaceEdit();

                codeAction.edit.replace(document.uri, range, this.getNamespaceBase());

                this.resolveUseImportStatement(codeAction);
            }


            this.codeActions.push(codeAction);
        }
    }


    /**
     * Get the basename of class from namespace extracted from selection.
     * 
     * @returns string
     */
    private getNamespaceBase(namespace?: string): string {
        return (namespace ?? this.namespace).match(/\w+/g)?.pop() ?? '';
    }

    /**
     * Get namespace for use statement.
     * 
     * @param namespace string
     * @returns string
     */
    private getUsableNamespace(namespace?: string): string {
        return (namespace ?? this.namespace).replace(/^\\?/, '');
    }

    /**
     * Resolve or search the class namespace.
     * 
     * @param document vscode.TextDocument
     * @param selection vscode.Selection
     * @returns NamespaceResolver
     */
    private resolveNamespace(namespace?: string): NamespaceResolver {
        if (this.selection === undefined) {
            return this;
        }

        let range = this.document.getWordRangeAtPosition(this.selection.active, namespace ? new RegExp(namespace) : this.namespaceExp);

        this.namespace = range ? this.document.getText(range) : '';

        this.resolveActionType();

        return this;
    }

    /**
     * Resolve/Write the import statement in active document.
     * 
     * @param codeAction vscode.CodeAction
     * @returns void
     */
    private resolveUseImportStatement(codeAction: vscode.CodeAction): void {
        if (this.isNamespaceNotImported()) {
            let position = new vscode.Position(this.getUseStatementLineNumber(), 0);

            const range = new vscode.Range(position, position);

            const prefix = this.declarations.use.line ? '' : '\n';

            codeAction.edit?.replace(this.document.uri, range, `${prefix}use ${this.getUsableNamespace()};\n`);
        }

    }

    /**
     * Resolve/Grab namespace from the text document.
     * 
     * @param document vscode.TextDocument
     * 
     * @returns void
     */
    private resolveOpenedFileNamespace(document: vscode.TextDocument): void {
        for (let line = 0; line < document.lineCount; line++) {
            let text = document.lineAt(line).text;

            if (text.startsWith('namespace ') || (/(^<\?php)?(\s+)?(namespace)\s+([A-z0-9\\]+)/g).test(text)) {
                // Remove extra content.
                let namespace = text.replace(/(^<\?php)?(\s+)?(namespace)\s+/g, '');
                // Namespace without semicolon;
                let baseNamespace = namespace.match(this.namespaceExp)?.pop() ?? '';

                let documentNamespace = `${baseNamespace}\\${this.getUsableNamespace()}`;

                if (!this.openedDocumentsNamespaces.includes(documentNamespace)) {
                    this.openedDocumentsNamespaces.push(documentNamespace);
                }
            }
        }
    }

    /**
     * Resolve the action type selection based on the namespace pattern.
     * 
     * @returns string
     */
    private resolveActionType(): string {
        if (/\\/.test(this.namespace)) {
            this.actionType = 'useImport';
        } else {
            this.actionType = 'inlineImport';
        }

        return this.actionType;
    }

    /**
     * Resolve the active document declarations.
     * 
     * @returns NamespaceResolver
     */
    private resolveDeclarations(): NamespaceResolver {
        for (let i = 0; i < this.document.lineCount; i++) {
            let text = this.document.lineAt(i).text.trim();

            if (this.isDeclarationsResolved()) {
                break;
            }

            if (text.startsWith(`<?php`)) {
                this.declarations.php.line = (i + 1);
            } else if (text.startsWith('namespace ') || (/(<\?php)\s+(namespace)\s+([A-z0-9\\]+)/g).test(text)) {
                this.declarations.namespace.line = (i + 1);
            } else if (text.startsWith('use ') || (/^(\s+)?(use)\s+([A-z0-9\\]+)/g).test(text)) {
                if (this.declarations.class.line === 0) {
                    this.declarations.use.line = (i + 1);
                    this.declarations.use.statements.push({ statement: text.trim(), line: i });
                }
            } else if ((/(class|trait|interface|enum)\s+\w+/).test(text)) {
                this.declarations.class.line = (i + 1);
            }
        }

        return this;
    }

    /**
     * Determine if the declarations resolved successfully.
     * 
     * @returns boolean
     */
    private isDeclarationsResolved(): number {
        return this.declarations.php.line
            && this.declarations.use.line
            && this.declarations.class.line
            && this.declarations.namespace.line;
    }

    /**
     * Check if the current selection is from document use statements.
     * 
     * @param selection vscode.Selection
     * @returns boolean
     */
    private isSelectionOnUseStatements(selection?: vscode.Selection): boolean {
        return this.declarations.use.statements.some(
            ({ line }) => line === (selection ?? this.selection).active.line
        );
    }

    /**
     * Check if the current selection is not from document use statements.
     * 
     * @param selection vscode.Selection
     * @returns boolean
     */
    private isSelectionNotOnUseStatements(selection?: vscode.Selection): boolean {
        return !(this.isSelectionOnUseStatements(selection));
    }

    /**
     * Determine if the the selected namespace is imported OR not available in document user statements.
     * 
     * @param namespace string
     * @returns boolean
     */
    private isNamespaceImported(namespace?: string): boolean {
        return this.declarations.use.statements.some(
            ({ statement }) => this.getNamespaceBase(statement) === this.getNamespaceBase(namespace)
        );
    }

    /**
     * Determine if the selected namespace is not imported or not available in document use statements.
     * 
     * @param namespace string
     * @returns boolean
     */
    private isNamespaceNotImported(namespace?: string): boolean {
        return !(this.isNamespaceImported(namespace));
    }

    /**
     * Determine if the given document/filename matches with the selection namespace.
     * 
     * @param file vscode.Uri
     * @returns boolean
     */
    private isFilenameMatchesToNamespace(file: vscode.Uri): boolean {
        let filename = file.toString().replace(/^.*[\\\/]/g, '').replace(/(.php)/g, '');
        return filename === this.getNamespaceBase();
    }

    /**
     * Get the document use statements ending line number based on the resolved declarations.
     * 
     * @returns number
     */
    private getUseStatementLineNumber(): number {
        if (this.declarations.use.line) {
            return this.declarations.use.line;
        } else if (this.declarations.namespace.line) {
            return this.declarations.namespace.line;
        } else {
            return this.declarations.php.line;
        }
    }
}

interface DeclarationType {
    php: {
        line: number;
        statement: string;
    };
    namespace: {
        line: number;
        statement: string;
    };
    use: {
        line: number;
        statements: { statement: string, line: number }[]
    };
    class: {
        line: number;
        statement: string;
    };
}

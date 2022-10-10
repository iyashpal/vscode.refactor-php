import { Config } from "..";
import * as vscode from 'vscode';
import { ImportSortingConfig } from '.';

export default class ImportsSortingResolver {

    protected sorting: ImportSortingConfig;

    protected document: vscode.TextDocument;



    constructor() {
        this.sorting = Config.get('imports.sorting');

        this.document = vscode.window.activeTextEditor?.document as vscode.TextDocument;
    }

    private sortByAlphabets() {

    }

    private sortByNatural() {

    }


}

import { Config } from "..";
import * as vscode from 'vscode';
import { ImportSortingConfig } from '.';

export default class ImportsSortingResolver {

    protected sorting: ImportSortingConfig;

    
    constructor() {
        this.sorting = Config.get('imports.sorting');
        
        console.log(vscode.window.activeTextEditor?.document.lineCount);
    }

    private sortByAlphabets() {

    }

    private sortByLength() {

    }


}

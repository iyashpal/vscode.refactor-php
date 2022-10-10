import * as vscode from 'vscode';

export default class Config {

    /**
     * Get workspace configuration by key.
     * 
     * @param key string
     * @returns string
     */
    public static get(key: string): any {
        return vscode.workspace.getConfiguration('php.refactoring').get(key);
    }

}

export { default as BuiltInClasses } from './BuiltInClasses';
export { default as NamespaceResolver } from './NamespaceResolver';
export { default as ConstructorResolver } from './ConstructorResolver';
export { default as ImportsSortingResolver } from './ImportsSortingResolver';

export interface ImportSortingConfig {
    enabled: boolean;
    type: string;
    order: string;
}

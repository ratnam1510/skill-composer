export declare function injectIntoFile(manifest: string, filePath: string): {
    action: 'created' | 'updated' | 'unchanged';
    path: string;
};
export declare function removeFromFile(filePath: string): boolean;

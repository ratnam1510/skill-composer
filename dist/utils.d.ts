export declare function estimateTokens(text: string): number;
export declare function expandPath(p: string): string;
export declare function slugify(name: string): string;
export declare function extractKeywords(text: string): string[];
export declare function jaccardSimilarity(a: string[], b: string[]): number;
export declare function uniqueById<T extends {
    id: string;
}>(items: T[]): T[];

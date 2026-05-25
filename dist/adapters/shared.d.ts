import { extractKeywords } from '../utils.js';
export declare function inferCategories(keywords: string[]): string[];
export declare function inferInputsOutputs(text: string): {
    inputs: string[];
    outputs: string[];
};
export declare function extractNameFromContent(content: string, filePath?: string): string;
export declare function extractDescriptionFromContent(content: string): string;
export declare function extractChainsTo(frontmatter: Record<string, unknown>, content: string): string[];
export { extractKeywords };

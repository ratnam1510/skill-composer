import type { ComposerConfig } from './types.js';
export interface RemoteSkillReference {
    name: string;
    sourceUrl: string;
    repositoryUrl: string;
    installCommand: string;
}
export interface RemoteSkillCacheEntry extends RemoteSkillReference {
    id: string;
    rawUrl: string;
    fetchedAt: string;
    expiresAt: string;
    title: string;
    description: string;
    content: string;
    tokenEstimate: number;
}
export interface RemoteSkillCacheOptions {
    cacheDir?: string;
    ttlHours?: number;
    refresh?: boolean;
    timeoutMs?: number;
}
export declare function parseRemoteSkillReference(reference: string): RemoteSkillReference | null;
export declare function getRemoteCacheDir(config?: ComposerConfig, override?: string): string;
export declare function getCachedRemoteSkill(reference: string, config?: ComposerConfig, options?: RemoteSkillCacheOptions): RemoteSkillCacheEntry | null;
export declare function fetchRemoteSkill(reference: string, config?: ComposerConfig, options?: RemoteSkillCacheOptions): Promise<{
    entry: RemoteSkillCacheEntry;
    cacheHit: boolean;
}>;
export declare function listCachedRemoteSkills(config?: ComposerConfig, options?: RemoteSkillCacheOptions): RemoteSkillCacheEntry[];
export declare function searchCachedRemoteSkills(query: string, config?: ComposerConfig, options?: RemoteSkillCacheOptions): RemoteSkillCacheEntry[];
export declare function clearRemoteSkillCache(config?: ComposerConfig, options?: RemoteSkillCacheOptions & {
    expiredOnly?: boolean;
}): number;

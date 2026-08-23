/**
 * BuiltInSkillSeeder
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds production-grade built-in SkillOps skills from Markdown files at
 * extension activation. Runs idempotently on EVERY activation — safe across
 * reloads, updates, and multi-root workspaces.
 *
 * Seeding decision matrix:
 * ┌──────────────────────┬──────────────────┬────────────────────────────────┐
 * │ Skill in registry?   │ userModified?    │ Action                         │
 * ├──────────────────────┼──────────────────┼────────────────────────────────┤
 * │ No                   │ —                │ Seed v1 from .md file          │
 * │ Yes (builtIn)        │ false            │ Upgrade if SEED_VERSION > saved │
 * │ Yes (builtIn)        │ true             │ Archive new content, skip      │
 * │ Yes (user-created)   │ —                │ Never touch                    │
 * └──────────────────────┴──────────────────┴────────────────────────────────┘
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillRegistry, SkillCategoryMetadata } from './skillRegistry';
import { Logger } from '../../utils/logger';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Increment this number whenever built-in skill content is updated.
 * The seeder compares this against `metadata.seedVersion` to decide
 * whether to apply an upgrade to unmodified skills.
 */
const SEED_VERSION = 1;

const BUILT_IN_SOURCE      = 'GDLSoftware';
const BUILT_IN_MANAGED_BY  = 'SkillOps';

// ── Skill catalogue ──────────────────────────────────────────────────────────

/**
 * Human-readable display names and descriptions for each built-in skill ID.
 * The ID corresponds exactly to the filename (without `.md`) inside `builtInSkills/`.
 */
interface SkillMeta {
    readonly name: string;
    readonly description: string;
}

const SKILL_CATALOGUE: Record<string, SkillMeta> = {
    'react':             { name: 'React',               description: 'Core React patterns, hooks, state management, and performance best practices.' },
    'react-native':      { name: 'React Native',        description: 'Cross-platform mobile development with React Native and Expo.' },
    'nodejs':            { name: 'Node.js',              description: 'Server-side JavaScript with Node.js — event loop, async patterns, and security.' },
    'express':           { name: 'Express.js',           description: 'REST API development with Express.js — middleware, validation, and error handling.' },
    'nextjs':            { name: 'Next.js',              description: 'Full-stack React framework — App Router, SSR, SSG, Server Actions, and deployment.' },
    'angular':           { name: 'Angular',              description: 'Enterprise Angular development — components, DI, RxJS, and change detection.' },
    'spring-boot':       { name: 'Spring Boot',          description: 'Java microservices with Spring Boot — DI, JPA, Spring Security, and configuration.' },
    'flask':             { name: 'Flask',                description: 'Python web development with Flask — routing, blueprints, security, and production setup.' },
    'django':            { name: 'Django',               description: 'Python web framework — MVT architecture, ORM, security, and performance.' },
    'python-scripting':  { name: 'Python Scripting',     description: 'Production Python scripting — types, error handling, security, and virtual environments.' },
    'bootstrap':         { name: 'Bootstrap',            description: 'Responsive UI development with Bootstrap — grid, utilities, and customisation.' },
    'html5':             { name: 'HTML5',                description: 'Semantic HTML5 — accessibility, forms, images, and modern document structure.' },
    'tailwind':          { name: 'Tailwind CSS',         description: 'Utility-first CSS with Tailwind — configuration, theming, and responsive design.' },
    'material-ui':       { name: 'Material UI',          description: 'React component library with MUI — theming, styling patterns, and accessibility.' },
    'css':               { name: 'CSS',                  description: 'CSS fundamentals — cascade, layout, custom properties, and responsive design.' },
    'css3':              { name: 'CSS3',                 description: 'Modern CSS3 — Grid, Flexbox, animations, container queries, and modern selectors.' },
    'xml':               { name: 'XML',                  description: 'XML parsing, validation, schema design, and XXE injection prevention.' },
    'java':              { name: 'Java',                 description: 'Modern Java — types, collections, null safety, concurrency, and security.' },
    'android':           { name: 'Android',              description: 'Native Android development — MVVM, Jetpack, coroutines, and security.' },
    'javascript':        { name: 'JavaScript',           description: 'Modern JavaScript — ES modules, async patterns, DOM safety, and performance.' },
    'flutter':           { name: 'Flutter',              description: 'Cross-platform Flutter — state management, widgets, navigation, and security.' },
    'kotlin':            { name: 'Kotlin',               description: 'Idiomatic Kotlin — null safety, coroutines, collections, and Android patterns.' },
    'postgresql':        { name: 'PostgreSQL',           description: 'PostgreSQL — schema design, indexes, EXPLAIN ANALYZE, transactions, and security.' },
    'sql':               { name: 'SQL',                  description: 'Production-grade SQL — queries, joins, transactions, indexes, and injection prevention.' },
    'mongodb':           { name: 'MongoDB',              description: 'MongoDB — schema design, aggregation, indexes, transactions, and security.' },
    'firebase':          { name: 'Firebase',             description: 'Firebase — Auth, Firestore, Security Rules, Cloud Functions, and Admin SDK.' },
    'graphql':           { name: 'GraphQL',              description: 'GraphQL API design — schema, resolvers, DataLoader, authorization, and security.' },
    'elasticsearch':     { name: 'Elasticsearch',        description: 'Elasticsearch — mappings, queries, aggregations, aliases, and performance.' },
    'phpmyadmin':        { name: 'phpMyAdmin',           description: 'Safe MySQL administration via phpMyAdmin — inspection, safe SQL, and backups.' },
    'apache':            { name: 'Apache HTTP Server',   description: 'Apache configuration — virtual hosts, SSL/TLS, rewrite rules, and security.' },
    'php':               { name: 'PHP',                  description: 'Modern PHP — types, OOP, PDO, security, Composer, and performance.' },
    'wordpress':         { name: 'WordPress',            description: 'WordPress development — hooks, plugins, sanitization, escaping, and security.' },
    'mssql':             { name: 'Microsoft SQL Server', description: 'SQL Server — indexes, execution plans, stored procedures, transactions, and security.' },
    'mysql':             { name: 'MySQL',                description: 'MySQL — schema design, indexes, EXPLAIN, transactions, migrations, and security.' },
    'web-development':   { name: 'Web Development',      description: 'Full-stack web development — architecture decisions, security, accessibility, and deployment.' },
};

// ── Seeder ───────────────────────────────────────────────────────────────────

export class BuiltInSkillSeeder {

    /** Absolute path to the directory containing *.md skill files. */
    private static readonly SKILLS_DIR = path.join(__dirname, '..', 'builtInSkills');

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Idempotent entry point called from `extension.ts` on every activation.
     *
     * Safe to call repeatedly. Will not duplicate skills, will not overwrite
     * user-modified skills, and will cleanly apply content upgrades when
     * `SEED_VERSION` is bumped and the skill has not been user-modified.
     */
    public static seedSkills(registry: SkillRegistry): void {
        const logger = Logger.getInstance();
        logger.log(`[BuiltInSkillSeeder] Starting — SEED_VERSION=${SEED_VERSION}`);

        if (!fs.existsSync(BuiltInSkillSeeder.SKILLS_DIR)) {
            logger.error(
                '[BuiltInSkillSeeder] builtInSkills directory not found:',
                BuiltInSkillSeeder.SKILLS_DIR
            );
            return;
        }

        const mdFiles = BuiltInSkillSeeder.discoverSkillFiles();
        let seeded = 0, upgraded = 0, skipped = 0, archived = 0;

        for (const { id, filePath } of mdFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const result  = BuiltInSkillSeeder.processSkill(registry, id, content, logger);

                if      (result === 'seeded')   seeded++;
                else if (result === 'upgraded')  upgraded++;
                else if (result === 'archived')  archived++;
                else                             skipped++;

            } catch (error) {
                logger.error(`[BuiltInSkillSeeder] Failed processing '${id}':`, error);
            }
        }

        logger.log(
            `[BuiltInSkillSeeder] Done — ` +
            `seeded=${seeded}, upgraded=${upgraded}, archived=${archived}, skipped=${skipped}`
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private — file discovery
    // ──────────────────────────────────────────────────────────────────────────

    private static discoverSkillFiles(): Array<{ id: string; filePath: string }> {
        return fs
            .readdirSync(BuiltInSkillSeeder.SKILLS_DIR)
            .filter(f => f.endsWith('.md'))
            .map(f => ({
                id:       path.basename(f, '.md'),
                filePath: path.join(BuiltInSkillSeeder.SKILLS_DIR, f),
            }));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private — per-skill decision logic
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Applies the seeding decision matrix for a single skill.
     * Returns a string describing the action taken (for summary logging).
     */
    private static processSkill(
        registry : SkillRegistry,
        id       : string,
        content  : string,
        logger   : Logger,
    ): 'seeded' | 'upgraded' | 'archived' | 'skipped' {

        const existing = registry.getSkillCategoryMetadata(id);

        // ── CASE 0: User intentionally deleted this built-in — honour it forever ─
        if (existing?.userDeleted === true) {
            logger.log(`[BuiltInSkillSeeder] '${id}' was intentionally deleted by user, skipping.`);
            return 'skipped';
        }

        // ── CASE 1: Skill does not exist yet → seed it ────────────────────────
        if (!existing) {
            BuiltInSkillSeeder.seedNew(registry, id, content, logger);
            return 'seeded';
        }

        // ── CASE 2: Skill exists but was NOT created by the seeder ─────────────
        // (user manually created a skill with the same ID — never touch it)
        if (!existing.builtIn) {
            logger.log(`[BuiltInSkillSeeder] '${id}' is user-created, skipping.`);
            return 'skipped';
        }

        // ── CASE 3: Built-in skill exists, check for upgrade ──────────────────
        const installedVersion = existing.seedVersion ?? 0;

        if (installedVersion >= SEED_VERSION) {
            // Already up to date
            logger.log(`[BuiltInSkillSeeder] '${id}' is current (v${installedVersion}), skipping.`);
            return 'skipped';
        }

        // An upgrade is available (SEED_VERSION > installedVersion)
        if (existing.userModified) {
            // User has customised this skill → archive the new built-in content
            // without touching the active (user) version.
            BuiltInSkillSeeder.archiveBuiltInUpgrade(registry, id, content, existing, logger);
            return 'archived';
        }

        // Skill exists, is built-in, has NOT been user-modified, and is out of date
        // → replace the active version with the new built-in content.
        BuiltInSkillSeeder.applyUpgrade(registry, id, content, existing, logger);
        return 'upgraded';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private — write operations
    // ──────────────────────────────────────────────────────────────────────────

    /** Installs a brand-new built-in skill (no prior metadata exists). */
    private static seedNew(
        registry : SkillRegistry,
        id       : string,
        content  : string,
        logger   : Logger,
    ): void {
        const catalogue = SKILL_CATALOGUE[id];
        const name      = catalogue?.name        ?? BuiltInSkillSeeder.idToDisplayName(id);
        const desc      = catalogue?.description ?? `Built-in SkillOps skill: ${name}.`;

        const newVersion = registry.createSkillVersion(
            id, content, undefined, `Initial built-in seed (v${SEED_VERSION})`
        );
        registry.saveSkillVersion(id, newVersion);

        registry.updateSkillCategoryMetadata(id, {
            skillName:     name,
            description:   desc,
            enabled:       true,
            builtIn:       true,
            source:        BUILT_IN_SOURCE,
            managedBy:     BUILT_IN_MANAGED_BY,
            seedVersion:   SEED_VERSION,
            builtInVersion: SEED_VERSION,
            userModified:  false,
            // Keep legacy field for any older reader that checks it
            sourceVersion: `v${SEED_VERSION}`,
        });

        registry.promoteSkill(id, newVersion.metadata.version);
        logger.log(`[BuiltInSkillSeeder] Seeded '${id}' as '${name}' (v${SEED_VERSION}).`);
    }

    /**
     * Upgrades an unmodified built-in skill to the new seed content.
     * The old version is archived; the new version becomes `best`.
     */
    private static applyUpgrade(
        registry  : SkillRegistry,
        id        : string,
        content   : string,
        existing  : SkillCategoryMetadata,
        logger    : Logger,
    ): void {
        const prevVersion = existing.bestVersion;

        const newVersion = registry.createSkillVersion(
            id,
            content,
            prevVersion,
            `Built-in upgrade: v${existing.seedVersion ?? 0} → v${SEED_VERSION}`
        );
        registry.saveSkillVersion(id, newVersion);

        registry.updateSkillCategoryMetadata(id, {
            seedVersion:    SEED_VERSION,
            builtInVersion: SEED_VERSION,
            userModified:   false,
            sourceVersion:  `v${SEED_VERSION}`,
        });

        registry.promoteSkill(id, newVersion.metadata.version);

        logger.log(
            `[BuiltInSkillSeeder] Upgraded '${id}' ` +
            `v${existing.seedVersion ?? 0} → v${SEED_VERSION} (registry v${newVersion.metadata.version}).`
        );
    }

    /**
     * User has modified this skill. We save the new built-in content as a
     * DRAFT version so it is available for future comparison / manual upgrade,
     * but we do NOT promote it (the user's version remains `best`).
     */
    private static archiveBuiltInUpgrade(
        registry  : SkillRegistry,
        id        : string,
        content   : string,
        existing  : SkillCategoryMetadata,
        logger    : Logger,
    ): void {
        const draftVersion = registry.createSkillVersion(
            id,
            content,
            existing.bestVersion,
            `Built-in v${SEED_VERSION} available (user-modified — not auto-applied)`
        );
        // Save as draft — status remains 'draft', bestVersion is NOT changed.
        registry.saveSkillVersion(id, draftVersion);

        // Record the new built-in version so the UI can surface an upgrade offer.
        registry.updateSkillCategoryMetadata(id, {
            builtInVersion: SEED_VERSION,
        });

        logger.log(
            `[BuiltInSkillSeeder] '${id}' is user-modified. ` +
            `Archived built-in v${SEED_VERSION} as draft (registry v${draftVersion.metadata.version}). ` +
            `User's version remains active.`
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private — utilities
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Converts a kebab-case ID to a Title Case display name as a fallback
     * when the ID is not present in SKILL_CATALOGUE.
     * e.g. "react-native" → "React Native"
     */
    private static idToDisplayName(id: string): string {
        return id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Returns the original built-in markdown content for a given skill ID.
     * Used by the Dashboard "Restore Built-in" action without duplicating
     * file-path knowledge.
     * Returns null if no built-in .md file exists for that ID.
     */
    public static getBuiltInContent(id: string): string | null {
        const filePath = path.join(BuiltInSkillSeeder.SKILLS_DIR, `${id}.md`);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
        return null;
    }
}

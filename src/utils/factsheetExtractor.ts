/**
 * Verbatim Factsheet Extractor for Imaged Content
 * Based on the PxPipe Factsheet Architecture.
 *
 * Extracts precision-critical tokens (file paths, URLs, SHAs, UUIDs, version strings,
 * CONST_IDS, CLI flags, ticket codes, camelCase identifiers, and LABEL=value pairs)
 * so they ride alongside the image in plain text for 100% byte-exact recall.
 */

export interface FactsheetResult {
  tokens: string[];
  totalExtracted: number;
  droppedCount: number;
  byCategory: {
    paths: string[];
    hashes: string[];
    identifiers: string[];
    urls: string[];
    other: string[];
  };
}

export class FactsheetExtractor {
  public static readonly MAX_TOKENS = 96;
  public static readonly MAX_URLS = 8;

  // ReDoS-Safe Extraction Patterns
  private static readonly PATTERNS: readonly RegExp[] = [
    // 1. Semantic LABEL=value pairs (preserve association)
    /\b[A-Z][A-Z0-9_]{2,}=[^\s)"'<>]+/g,
    /\b[A-Za-z][A-Za-z0-9_]{2,}=[A-Za-z0-9_.:/+-]{1,64}/g,
    // 2. URLs
    /\bhttps?:\/\/[^\s)"'<>]+/g,
    // 3. Email addresses
    /\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+\b/g,
    // 4. UUIDs
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    // 5. Currency amounts
    /(?:[$€£¥]|(?:USD|EUR|GBP|CAD|AUD|CHF|JPY))\d(?:[\d,_]*\d)?(?:\.\d{2})?\b/g,
    // 6. File paths with extensions (.ts, .tsx, .py, .go, .rs, .json, etc.)
    /(?:[\w@~+-]+)?(?:\/[\w.@+-]+)+\.[A-Za-z]\w{0,8}\b/g,
    // 7. Directory paths (>= 2 segments)
    /\/[\w.@+-]+(?:\/[\w.@+-]+)+\/?/g,
    // 8. Git SHAs / Hex hashes (7 to 40 hex chars containing at least 1 digit)
    /\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/g,
    // 9. Version strings (v1.2.3, 2.0.1-beta)
    /\bv?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?\b/g,
    // 10. CLI flags (--config, -v, --target-model)
    /(?:^|[^\w-])(--?[A-Za-z][\w-]+)/g,
    // 11. Large separated numbers or ports
    /\b\d[\d,_]{3,}\b/g,
    // 12. CONST_IDS / Env vars
    /\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/g,
    // 13. camelCase / PascalCase identifiers
    /\b(?:[a-z]+|[A-Z][a-z0-9]+)(?:[A-Z][a-z0-9]*)+\b/g,
    // 14. Ticket / advisory codes (e.g. CVE-2024-30078, PROJ-1482)
    /\b(?=[A-Z0-9-]{0,119}\d)[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+\b/g,
  ];

  // Token Shape Classifiers for Tier Prioritization
  private static readonly SHAPE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  private static readonly SHAPE_HEX = /^(?=[0-9a-f]*\d)[0-9a-f]{7,40}$/;
  private static readonly SHAPE_CONST = /^[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+$/;
  private static readonly SHAPE_TICKET = /^(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+$/;
  private static readonly SHAPE_FLAG = /^--?[A-Za-z][\w-]+$/;
  private static readonly SHAPE_PATH = /(?:\/|\\)[\w.@+-]+/;
  private static readonly SHAPE_URL = /^https?:\/\//;

  /**
   * Extract and rank factsheet tokens with deterministic sorting
   */
  public static extract(text: string): FactsheetResult {
    if (!text) {
      return {
        tokens: [],
        totalExtracted: 0,
        droppedCount: 0,
        byCategory: { paths: [], hashes: [], identifiers: [], urls: [], other: [] }
      };
    }

    const seen = new Set<string>();
    const allMatches: string[] = [];

    for (const pattern of this.PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const token = (match[1] || match[0]).trim();
        if (token.length >= 3 && token.length <= 120 && !seen.has(token)) {
          seen.add(token);
          allMatches.push(token);
          if (allMatches.length >= 2048) break;
        }
      }
      if (allMatches.length >= 2048) break;
    }

    // Rank tokens by priority tier:
    // Tier 0 (High): SHAs, UUIDs, Tickets, CONST_IDS, Flags (Zero-redundancy tokens)
    // Tier 1 (Medium): Paths, Version strings, camelCase symbols
    // Tier 2 (Low): URLs, large numbers
    const tier0: string[] = [];
    const tier1: string[] = [];
    const tier2: string[] = [];

    let urlCount = 0;
    for (const token of allMatches) {
      if (this.SHAPE_URL.test(token)) {
        if (urlCount < this.MAX_URLS) {
          tier2.push(token);
          urlCount++;
        }
      } else if (
        this.SHAPE_UUID.test(token) ||
        this.SHAPE_HEX.test(token) ||
        this.SHAPE_CONST.test(token) ||
        this.SHAPE_TICKET.test(token) ||
        this.SHAPE_FLAG.test(token)
      ) {
        tier0.push(token);
      } else if (this.SHAPE_PATH.test(token)) {
        tier1.push(token);
      } else {
        tier1.push(token);
      }
    }

    // Deterministic sorting (longest-first within tier, then alphabetical)
    const sorter = (a: string, b: string) => b.length - a.length || a.localeCompare(b);
    tier0.sort(sorter);
    tier1.sort(sorter);
    tier2.sort(sorter);

    const merged = [...tier0, ...tier1, ...tier2];
    const finalTokens = merged.slice(0, this.MAX_TOKENS);
    const droppedCount = Math.max(0, merged.length - this.MAX_TOKENS);

    // Categorize for UI display
    const paths = finalTokens.filter(t => this.SHAPE_PATH.test(t));
    const hashes = finalTokens.filter(t => this.SHAPE_HEX.test(t) || this.SHAPE_UUID.test(t));
    const identifiers = finalTokens.filter(t => this.SHAPE_CONST.test(t) || this.SHAPE_TICKET.test(t) || this.SHAPE_FLAG.test(t));
    const urls = finalTokens.filter(t => this.SHAPE_URL.test(t));
    const other = finalTokens.filter(t => !paths.includes(t) && !hashes.includes(t) && !identifiers.includes(t) && !urls.includes(t));

    return {
      tokens: finalTokens,
      totalExtracted: merged.length,
      droppedCount,
      byCategory: { paths, hashes, identifiers, urls, other }
    };
  }
}

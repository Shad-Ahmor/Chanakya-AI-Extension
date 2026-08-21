/**
 * Structure-Aware JSON Schema Stripper
 * Based on PxPipe's schema-strip.ts architecture.
 *
 * Strips descriptive metadata annotations (description, title, examples, default, $id, $comment)
 * from MCP tool input schemas before sending to LLMs, because the visual PxPipe image already
 * provides human/OCR instructions to the model.
 *
 * Structure-Aware: Differentiates between schema metadata keywords and user property names!
 */

const SCHEMA_STRIP_KEYS = new Set([
  'description',
  'title',
  'examples',
  'default',
  '$id',
  '$comment',
]);

const SCHEMA_COMPOSITION_KEYS = new Set(['oneOf', 'anyOf', 'allOf']);

const SCHEMA_NAMED_SUBSCHEMA_KEYS = new Set([
  'properties',
  'patternProperties',
  'definitions',
  '$defs',
]);

const SCHEMA_SINGLE_SUBSCHEMA_KEYS = new Set([
  'items',
  'additionalProperties',
  'not',
  'contains',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties',
  'if',
  'then',
  'else',
]);

export class SchemaStripper {
  private static readonly MAX_DEPTH = 20;

  /**
   * Deeply strips annotation keys from a JSON schema object without mutating user property names.
   */
  public static strip(schema: any, depth = 0): any {
    if (!schema || typeof schema !== 'object' || depth > this.MAX_DEPTH) {
      return schema;
    }

    if (Array.isArray(schema)) {
      return schema.map((item) => this.strip(item, depth + 1));
    }

    const stripped: Record<string, any> = {};

    for (const [key, value] of Object.entries(schema)) {
      // If it's an annotation key at the schema node level, omit it
      if (SCHEMA_STRIP_KEYS.has(key)) {
        continue;
      }

      // If it's a named subschema container (like 'properties'), recurse on the property VALUES only
      if (SCHEMA_NAMED_SUBSCHEMA_KEYS.has(key) && value && typeof value === 'object') {
        const subMap: Record<string, any> = {};
        for (const [propName, propSchema] of Object.entries(value as Record<string, any>)) {
          subMap[propName] = this.strip(propSchema, depth + 1);
        }
        stripped[key] = subMap;
        continue;
      }

      // Composition arrays (oneOf, anyOf, allOf)
      if (SCHEMA_COMPOSITION_KEYS.has(key) && Array.isArray(value)) {
        stripped[key] = value.map((sub) => this.strip(sub, depth + 1));
        continue;
      }

      // Single subschema keys (items, additionalProperties, etc.)
      if (SCHEMA_SINGLE_SUBSCHEMA_KEYS.has(key) && value && typeof value === 'object') {
        stripped[key] = this.strip(value, depth + 1);
        continue;
      }

      // Primitive constraints (type, required, enum, minimum, maximum, etc.) pass through
      stripped[key] = value;
    }

    return stripped;
  }

  /**
   * Strip descriptions from a collection of MCP tools and measure token savings
   */
  public static stripToolCollection(tools: Array<{ name: string; description?: string | undefined; inputSchema?: any }>): {
    strippedTools: Array<{ name: string; description?: string | undefined; inputSchema?: any }>;
    originalCharCount: number;
    strippedCharCount: number;
    savingsRatio: number;
  } {
    const originalJson = JSON.stringify(tools);
    const originalCharCount = originalJson.length;

    const strippedTools = tools.map((tool) => {
      const stripped: { name: string; description?: string; inputSchema?: any } = {
        name: tool.name
      };
      if (tool.description) {
        stripped.description = `[See PxPipe Image] ${tool.description.slice(0, 40)}...`;
      }
      if (tool.inputSchema) {
        stripped.inputSchema = this.strip(tool.inputSchema);
      }
      return stripped;
    });

    const strippedJson = JSON.stringify(strippedTools);
    const strippedCharCount = strippedJson.length;
    const savingsRatio = Math.max(0, Math.round(((originalCharCount - strippedCharCount) / (originalCharCount || 1)) * 100));

    return {
      strippedTools,
      originalCharCount,
      strippedCharCount,
      savingsRatio
    };
  }
}

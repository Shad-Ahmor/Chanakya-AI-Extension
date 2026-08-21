import * as fs from 'fs';
import * as path from 'path';

export interface Rule {
    id: string;
    name: string;
    description: string;
    priority: number;
    enabled: boolean;
    category: string;
    content: string;
}

export class RulesRegistry {
    private static instance: RulesRegistry;
    private rulesDir: string;
    private rulesFile: string;

    private constructor(workspaceRoot: string) {
        this.rulesDir = path.join(workspaceRoot, '.agents', 'rules');
        this.rulesFile = path.join(this.rulesDir, 'rules.json');
        if (!fs.existsSync(this.rulesDir)) {
            fs.mkdirSync(this.rulesDir, { recursive: true });
        }
        if (!fs.existsSync(this.rulesFile)) {
            fs.writeFileSync(this.rulesFile, JSON.stringify([], null, 2), 'utf8');
        }
    }

    public static getInstance(workspaceRoot: string): RulesRegistry {
        if (!RulesRegistry.instance) {
            RulesRegistry.instance = new RulesRegistry(workspaceRoot);
        }
        return RulesRegistry.instance;
    }

    public static resetInstance(): void {
        (RulesRegistry as any).instance = undefined;
    }

    private loadAllRules(): Rule[] {
        if (!fs.existsSync(this.rulesFile)) return [];
        try {
            return JSON.parse(fs.readFileSync(this.rulesFile, 'utf8')) as Rule[];
        } catch (e) {
            console.error('Failed to parse rules.json', e);
            return [];
        }
    }

    private saveAllRules(rules: Rule[]): void {
        if (!fs.existsSync(this.rulesDir)) {
            fs.mkdirSync(this.rulesDir, { recursive: true });
        }
        fs.writeFileSync(this.rulesFile, JSON.stringify(rules, null, 2), 'utf8');
    }

    public listEnabledRules(): Rule[] {
        return this.loadAllRules().filter(r => r.enabled).sort((a, b) => b.priority - a.priority);
    }

    public addRule(rule: Rule): void {
        const rules = this.loadAllRules();
        const existingIdx = rules.findIndex(r => r.id === rule.id);
        if (existingIdx >= 0) {
            rules[existingIdx] = rule;
        } else {
            rules.push(rule);
        }
        this.saveAllRules(rules);
    }

    public toggleRule(ruleId: string, enabled: boolean): void {
        const rules = this.loadAllRules();
        const rule = rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
            this.saveAllRules(rules);
        }
    }

    public getRule(ruleId: string): Rule | null {
        return this.loadAllRules().find(r => r.id === ruleId) || null;
    }
}

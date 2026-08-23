import re

# 1. extension.ts
with open("src/extension.ts", "r") as f:
    ext_code = f.read()
ext_code = ext_code.replace("runReactPilot();", "runReactPilot(context);")
with open("src/extension.ts", "w") as f:
    f.write(ext_code)

# 2. runReactPilot.ts
with open("src/commands/runReactPilot.ts", "r") as f:
    pilot_code = f.read()
pilot_code = pilot_code.replace("export async function runReactPilot() {", "export async function runReactPilot(context: vscode.ExtensionContext) {")
pilot_code = pilot_code.replace("BuiltInSkillSeeder.seedSkills(registry);", "BuiltInSkillSeeder.seedSkills(registry, context.extensionPath);")
with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(pilot_code)

# 3. builtInSkillSeeder.ts
with open("src/services/skillOpt/builtInSkillSeeder.ts", "r") as f:
    seeder_code = f.read()

# Replace hardcoded property with a getter method or just replace its usages
seeder_code = seeder_code.replace("private static readonly SKILLS_DIR = '/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/src/services/skillOpt/builtInSkills';", "private static getSkillsDir(extensionPath: string) { return require('path').join(extensionPath, 'src', 'services', 'skillOpt', 'builtInSkills'); }")

seeder_code = seeder_code.replace("public static seedSkills(registry: SkillRegistry, logger: Logger = Logger.getInstance()): void {", "public static seedSkills(registry: SkillRegistry, extensionPath: string, logger: Logger = Logger.getInstance()): void {")

# Fix usages of BuiltInSkillSeeder.SKILLS_DIR inside seedSkills
seeder_code = seeder_code.replace("!fs.existsSync(BuiltInSkillSeeder.SKILLS_DIR)", "!fs.existsSync(BuiltInSkillSeeder.getSkillsDir(extensionPath))")
seeder_code = seeder_code.replace("BuiltInSkillSeeder.SKILLS_DIR", "BuiltInSkillSeeder.getSkillsDir(extensionPath)")

with open("src/services/skillOpt/builtInSkillSeeder.ts", "w") as f:
    f.write(seeder_code)

print("Patch applied successfully.")

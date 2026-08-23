import re
import sys

with open("src/services/agentOrchestrator.ts", "r") as f:
    code = f.read()

# 1. Update resolvePath
code = code.replace("private resolvePath(reqPath: string): string {", "private resolvePath(reqPath: string, customWorkspace?: string): string {")
code = code.replace("if (path.isAbsolute(reqPath)) return reqPath;\n    const ws = vscode.workspace.workspaceFolders;", "if (path.isAbsolute(reqPath)) return reqPath;\n    if (customWorkspace) return require('path').join(customWorkspace, reqPath);\n    const ws = vscode.workspace.workspaceFolders;")

# 2. Update executeTool
code = code.replace("public async executeTool(name: string, args: any): Promise<string> {", "public async executeTool(name: string, args: any, customWorkspace?: string): Promise<string> {")

# 3. Pass customWorkspace to internal methods in switch case
methods = ['runTerminalCommand', 'searchCode', 'listDirectory', 'editFile', 'replaceInFile', 'createFile', 'deleteFile', 'deleteDirectory', 'viewFile']
for m in methods:
    # Handle cases like `rawResult = await this.viewFile(targetPath);` -> `rawResult = await this.viewFile(targetPath, customWorkspace);`
    if m == 'runTerminalCommand':
        code = code.replace(f"rawResult = await this.{m}(args.command, args.cwd);", f"rawResult = await this.{m}(args.command, args.cwd, customWorkspace);")
    elif m == 'replaceInFile':
        code = code.replace(f"rawResult = await this.{m}(targetPath, args.targetContent, args.replacementContent);", f"rawResult = await this.{m}(targetPath, args.targetContent, args.replacementContent, customWorkspace);")
    elif m == 'searchCode':
        code = code.replace(f"rawResult = await this.{m}(args.query);", f"rawResult = await this.{m}(args.query, customWorkspace);")
    elif m in ['editFile', 'createFile']:
        code = code.replace(f"rawResult = await this.{m}(targetPath, args.content);", f"rawResult = await this.{m}(targetPath, args.content, customWorkspace);")
    else:
        code = code.replace(f"rawResult = await this.{m}(targetPath);", f"rawResult = await this.{m}(targetPath, customWorkspace);")

# 4. Update method signatures
for m in methods:
    if m == 'runTerminalCommand':
        code = code.replace(f"private async {m}(command: string, cwd?: string): Promise<string> {{", f"private async {m}(command: string, cwd?: string, customWorkspace?: string): Promise<string> {{")
    elif m == 'replaceInFile':
        code = code.replace(f"private async {m}(filePath: string, targetContent: string, replacementContent: string): Promise<string> {{", f"private async {m}(filePath: string, targetContent: string, replacementContent: string, customWorkspace?: string): Promise<string> {{")
    elif m == 'searchCode':
        code = code.replace(f"private async {m}(query: string): Promise<string> {{", f"private async {m}(query: string, customWorkspace?: string): Promise<string> {{")
    elif m in ['editFile', 'createFile']:
        code = code.replace(f"private async {m}(filePath: string, content: string): Promise<string> {{", f"private async {m}(filePath: string, content: string, customWorkspace?: string): Promise<string> {{")
    elif m in ['deleteDirectory', 'listDirectory']:
        code = code.replace(f"private async {m}(dirPath: string): Promise<string> {{", f"private async {m}(dirPath: string, customWorkspace?: string): Promise<string> {{")
    else:
        code = code.replace(f"private async {m}(filePath: string): Promise<string> {{", f"private async {m}(filePath: string, customWorkspace?: string): Promise<string> {{")

# 5. Fix runTerminalCommand execCwd
code = code.replace("const execCwd = cwd ? this.resolvePath(cwd) : (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());", "const execCwd = cwd ? this.resolvePath(cwd, customWorkspace) : (customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());")

# 6. Fix searchCode execCwd
code = code.replace("const execCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();", "const execCwd = customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();")

# 7. Update resolvePath calls inside the methods
for m in methods:
    if m not in ['runTerminalCommand', 'searchCode']:
        code = code.replace("const fullPath = this.resolvePath(filePath);", "const fullPath = this.resolvePath(filePath, customWorkspace);")
        code = code.replace("const fullPath = this.resolvePath(dirPath);", "const fullPath = this.resolvePath(dirPath, customWorkspace);")


with open("src/services/agentOrchestrator.ts", "w") as f:
    f.write(code)

print("Done")

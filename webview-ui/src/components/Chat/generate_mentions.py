import json

mentions = []
id_counter = 1

def add_mention(title, prompt, cat):
    global id_counter
    mentions.append({
        "id": f"mention-{id_counter}",
        "title": title,
        "prompt": prompt,
        "category": cat
    })
    id_counter += 1

# Special: File Picker
mentions.append({
    "id": "mention-file-picker",
    "title": "Attach a File...",
    "prompt": "FILE_PICKER",
    "category": "Core Contexts"
})

# 1. Core Contexts (50)
for i in range(1, 51):
    add_mention(f"@workspace-context-{i}", f"@workspace-context-{i} ", "Core Contexts")

# 2. Agent Capabilities (100)
for i in range(1, 101):
    add_mention(f"@agent-{i}", f"@agent-{i} ", "Agents & Skills")

# 3. Documentation Reference (150)
for i in range(1, 151):
    add_mention(f"@docs-library-{i}", f"@docs-library-{i} ", "Documentation & SDKs")

# 4. Cloud & DevOps (100)
for i in range(1, 101):
    add_mention(f"@cloud-resource-{i}", f"@cloud-resource-{i} ", "Cloud & DevOps")

# 5. External Tools & APIs (100)
for i in range(1, 101):
    add_mention(f"@tool-api-{i}", f"@tool-api-{i} ", "External Integrations")

# Generate TypeScript file
ts_content = f"// Auto-generated 500 mentions\n\nexport const MENTIONS = {json.dumps(mentions, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/mentionsData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(mentions)} mentions.")

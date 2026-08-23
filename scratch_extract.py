import json

with open("/Users/shadahmor/.gemini/antigravity-ide/brain/b36d7c85-c251-4692-8298-b36c4e49f451/.system_generated/logs/transcript_full.jsonl", "r") as f:
    for line in f:
        data = json.loads(line)
        if data.get("type") == "CODE_ACTION" and "multi_replace_file_content" in str(data) and "evaluator.ts" in str(data):
            print(data.get("content"))

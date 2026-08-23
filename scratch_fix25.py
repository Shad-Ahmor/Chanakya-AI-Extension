with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()

code = code.replace("recorder.recordToolCall('pilot-task-1', 'run_command', { command: 'npm run build' }, { error: 'Failed' });", "recorder.recordToolCall('pilot-task-1', 'run_command', { command: 'npm run build' }, undefined, 'Failed');")
code = code.replace("recorder.endTask('pilot-task-1', false, 1);", "recorder.endTask('pilot-task-1', false);")

with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(code)

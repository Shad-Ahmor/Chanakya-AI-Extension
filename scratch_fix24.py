import re

with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()

# We need to import TrajectoryRecorder and record a mock trajectory
new_imports = """import { SkillOptService } from '../services/skillOpt/skillOptService';
import { TrajectoryRecorder } from '../services/skillOpt/trajectoryRecorder';"""

code = code.replace("import { SkillOptService } from '../services/skillOpt/skillOptService';", new_imports)

mock_trajectory = """
    // Ensure there is at least one trajectory for 'react' version 1
    const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
    const existing = recorder.getTrajectories().filter(t => t.skill === 'react' && t.skillVersion === 1);
    if (existing.length === 0) {
        recorder.startTask('pilot-task-1', 'Build a React component.', 'react', 1);
        recorder.recordToolCall('pilot-task-1', 'run_command', { command: 'npm run build' }, { error: 'Failed' });
        recorder.endTask('pilot-task-1', false, 1);
    }
"""

code = code.replace("const optimizer = SkillOptService.getInstance(workspaceRoot);", mock_trajectory + "\n    const optimizer = SkillOptService.getInstance(workspaceRoot);")

with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(code)

import * as fs from 'fs';
import * as path from 'path';

export interface TrajectoryToolCall {
    toolName: string;
    args: any;
    result?: string;
    error?: string;
    success: boolean;
}

export interface Trajectory {
    taskId: string;
    task: string;
    skill: string;
    skillVersion: number;
    toolCalls: TrajectoryToolCall[];
    retries: number;
    success: boolean;
    durationMs: number;
    timestamp: number;
}

export class TrajectoryRecorder {
    private static instance: TrajectoryRecorder;
    private trajectoriesDir: string;
    private currentTrajectories: Map<string, Trajectory> = new Map();

    private constructor(workspaceRoot: string) {
        if (!workspaceRoot) {
            // Fallback to a temporary directory if no workspace is open
            const os = require('os');
            this.trajectoriesDir = path.join(os.tmpdir(), 'chanakya-agents', 'trajectories');
        } else {
            this.trajectoriesDir = path.join(workspaceRoot, '.agents', 'trajectories');
        }
        
        try {
            if (!fs.existsSync(this.trajectoriesDir)) {
                fs.mkdirSync(this.trajectoriesDir, { recursive: true });
            }
        } catch (e) {
            console.error('Failed to create trajectories dir:', e);
        }
    }

    public static getInstance(workspaceRoot: string): TrajectoryRecorder {
        if (!TrajectoryRecorder.instance) {
            TrajectoryRecorder.instance = new TrajectoryRecorder(workspaceRoot);
        }
        return TrajectoryRecorder.instance;
    }

    public static resetInstance(): void {
        (TrajectoryRecorder as any).instance = undefined;
    }

    public startTask(taskId: string, task: string, skill: string = 'general', skillVersion: number = 1): void {
        this.currentTrajectories.set(taskId, {
            taskId,
            task,
            skill,
            skillVersion,
            toolCalls: [],
            retries: 0,
            success: false,
            durationMs: 0,
            timestamp: Date.now()
        });
    }

    public recordToolCall(taskId: string, toolName: string, args: any, result?: string, error?: string): void {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            // Check for secrets here if needed, but for now we just record it.
            // DO NOT store API keys etc. We assume args and results don't contain them 
            // or we could sanitize them if a generic scrubber was available.
            const callInfo: TrajectoryToolCall = {
                toolName,
                args: this.sanitizeArgs(args),
                success: !error
            };
            if (result !== undefined) {
                const sanitized = this.sanitizeResult(result);
                if (sanitized !== undefined) {
                    callInfo.result = sanitized;
                }
            }
            if (error !== undefined) callInfo.error = error;

            trajectory.toolCalls.push(callInfo);
        }
    }

    public recordRetry(taskId: string): void {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.retries++;
        }
    }

    public endTask(taskId: string, success: boolean): void {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.success = success;
            trajectory.durationMs = Date.now() - trajectory.timestamp;
            
            this.persistTrajectory(trajectory);
            this.currentTrajectories.delete(taskId);
        }
    }

    private persistTrajectory(trajectory: Trajectory): void {
        const filePath = path.join(this.trajectoriesDir, `${trajectory.taskId}.json`);
        try {
            fs.writeFileSync(filePath, JSON.stringify(trajectory, null, 2), 'utf8');
        } catch (e) {
            console.error('Failed to write trajectory to disk:', e);
        }
    }

    public getTrajectory(taskId: string): Trajectory | null {
        const filePath = path.join(this.trajectoriesDir, `${taskId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    }

    public getTrajectories(): Trajectory[] {
        const trajectories: Trajectory[] = [];
        if (!fs.existsSync(this.trajectoriesDir)) return trajectories;
        
        const files = fs.readdirSync(this.trajectoriesDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const data = fs.readFileSync(path.join(this.trajectoriesDir, file), 'utf8');
                trajectories.push(JSON.parse(data));
            } catch (err) {
                // Ignore parsing errors for now
            }
        }
        return trajectories;
    }

    private sanitizeArgs(args: any): any {
        if (typeof args !== 'object' || args === null) return args;
        const sanitized = { ...args };
        const secretKeys = ['password', 'token', 'key', 'secret', 'authorization'];
        for (const key of Object.keys(sanitized)) {
            if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        return sanitized;
    }

    private sanitizeResult(result?: string): string | undefined {
        if (!result) return result;
        return result.replace(/(bearer\s+|token=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
    }
}

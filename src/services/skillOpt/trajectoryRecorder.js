"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrajectoryRecorder = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TrajectoryRecorder {
    static instance;
    trajectoriesDir;
    currentTrajectories = new Map();
    constructor(workspaceRoot) {
        this.trajectoriesDir = path.join(workspaceRoot, '.agents', 'trajectories');
        if (!fs.existsSync(this.trajectoriesDir)) {
            fs.mkdirSync(this.trajectoriesDir, { recursive: true });
        }
    }
    static getInstance(workspaceRoot) {
        if (!TrajectoryRecorder.instance) {
            TrajectoryRecorder.instance = new TrajectoryRecorder(workspaceRoot);
        }
        return TrajectoryRecorder.instance;
    }
    static resetInstance() {
        TrajectoryRecorder.instance = undefined;
    }
    startTask(taskId, task, skill = 'general', skillVersion = 1) {
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
    recordToolCall(taskId, toolName, args, result, error) {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            // Check for secrets here if needed, but for now we just record it.
            // DO NOT store API keys etc. We assume args and results don't contain them 
            // or we could sanitize them if a generic scrubber was available.
            const callInfo = {
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
            if (error !== undefined)
                callInfo.error = error;
            trajectory.toolCalls.push(callInfo);
        }
    }
    recordRetry(taskId) {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.retries++;
        }
    }
    endTask(taskId, success) {
        const trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.success = success;
            trajectory.durationMs = Date.now() - trajectory.timestamp;
            this.persistTrajectory(trajectory);
            this.currentTrajectories.delete(taskId);
        }
    }
    persistTrajectory(trajectory) {
        const filePath = path.join(this.trajectoriesDir, `${trajectory.taskId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(trajectory, null, 2), 'utf8');
    }
    getTrajectory(taskId) {
        const filePath = path.join(this.trajectoriesDir, `${taskId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    }
    getTrajectories() {
        const trajectories = [];
        if (!fs.existsSync(this.trajectoriesDir))
            return trajectories;
        const files = fs.readdirSync(this.trajectoriesDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const data = fs.readFileSync(path.join(this.trajectoriesDir, file), 'utf8');
                trajectories.push(JSON.parse(data));
            }
            catch (err) {
                // Ignore parsing errors for now
            }
        }
        return trajectories;
    }
    sanitizeArgs(args) {
        if (typeof args !== 'object' || args === null)
            return args;
        const sanitized = { ...args };
        const secretKeys = ['password', 'token', 'key', 'secret', 'authorization'];
        for (const key of Object.keys(sanitized)) {
            if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    sanitizeResult(result) {
        if (!result)
            return result;
        return result.replace(/(bearer\s+|token=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
    }
}
exports.TrajectoryRecorder = TrajectoryRecorder;
//# sourceMappingURL=trajectoryRecorder.js.map
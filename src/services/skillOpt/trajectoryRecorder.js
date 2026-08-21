"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var TrajectoryRecorder = /** @class */ (function () {
    function TrajectoryRecorder(workspaceRoot) {
        this.currentTrajectories = new Map();
        this.trajectoriesDir = path.join(workspaceRoot, '.agents', 'trajectories');
        if (!fs.existsSync(this.trajectoriesDir)) {
            fs.mkdirSync(this.trajectoriesDir, { recursive: true });
        }
    }
    TrajectoryRecorder.getInstance = function (workspaceRoot) {
        if (!TrajectoryRecorder.instance) {
            TrajectoryRecorder.instance = new TrajectoryRecorder(workspaceRoot);
        }
        return TrajectoryRecorder.instance;
    };
    TrajectoryRecorder.resetInstance = function () {
        TrajectoryRecorder.instance = undefined;
    };
    TrajectoryRecorder.prototype.startTask = function (taskId, task, skill, skillVersion) {
        if (skill === void 0) { skill = 'general'; }
        if (skillVersion === void 0) { skillVersion = 1; }
        this.currentTrajectories.set(taskId, {
            taskId: taskId,
            task: task,
            skill: skill,
            skillVersion: skillVersion,
            toolCalls: [],
            retries: 0,
            success: false,
            durationMs: 0,
            timestamp: Date.now()
        });
    };
    TrajectoryRecorder.prototype.recordToolCall = function (taskId, toolName, args, result, error) {
        var trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            // Check for secrets here if needed, but for now we just record it.
            // DO NOT store API keys etc. We assume args and results don't contain them 
            // or we could sanitize them if a generic scrubber was available.
            trajectory.toolCalls.push({
                toolName: toolName,
                args: this.sanitizeArgs(args),
                result: this.sanitizeResult(result),
                error: error,
                success: !error
            });
        }
    };
    TrajectoryRecorder.prototype.recordRetry = function (taskId) {
        var trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.retries++;
        }
    };
    TrajectoryRecorder.prototype.endTask = function (taskId, success) {
        var trajectory = this.currentTrajectories.get(taskId);
        if (trajectory) {
            trajectory.success = success;
            trajectory.durationMs = Date.now() - trajectory.timestamp;
            this.persistTrajectory(trajectory);
            this.currentTrajectories.delete(taskId);
        }
    };
    TrajectoryRecorder.prototype.persistTrajectory = function (trajectory) {
        var filePath = path.join(this.trajectoriesDir, "".concat(trajectory.taskId, ".json"));
        fs.writeFileSync(filePath, JSON.stringify(trajectory, null, 2), 'utf8');
    };
    TrajectoryRecorder.prototype.getTrajectory = function (taskId) {
        var filePath = path.join(this.trajectoriesDir, "".concat(taskId, ".json"));
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    };
    TrajectoryRecorder.prototype.getTrajectories = function () {
        var trajectories = [];
        if (!fs.existsSync(this.trajectoriesDir))
            return trajectories;
        var files = fs.readdirSync(this.trajectoriesDir).filter(function (f) { return f.endsWith('.json'); });
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            try {
                var data = fs.readFileSync(path.join(this.trajectoriesDir, file), 'utf8');
                trajectories.push(JSON.parse(data));
            }
            catch (err) {
                // Ignore parsing errors for now
            }
        }
        return trajectories;
    };
    TrajectoryRecorder.prototype.sanitizeArgs = function (args) {
        if (typeof args !== 'object' || args === null)
            return args;
        var sanitized = __assign({}, args);
        var secretKeys = ['password', 'token', 'key', 'secret', 'authorization'];
        var _loop_1 = function (key) {
            if (secretKeys.some(function (sk) { return key.toLowerCase().includes(sk); })) {
                sanitized[key] = '[REDACTED]';
            }
        };
        for (var _i = 0, _a = Object.keys(sanitized); _i < _a.length; _i++) {
            var key = _a[_i];
            _loop_1(key);
        }
        return sanitized;
    };
    TrajectoryRecorder.prototype.sanitizeResult = function (result) {
        if (!result)
            return result;
        return result.replace(/(bearer\s+|token=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
    };
    return TrajectoryRecorder;
}());
exports.TrajectoryRecorder = TrajectoryRecorder;

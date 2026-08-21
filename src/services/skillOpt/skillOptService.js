"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillOptService = void 0;
var skillRegistry_1 = require("./skillRegistry");
var trajectoryRecorder_1 = require("./trajectoryRecorder");
var evaluator_1 = require("./evaluator");
var reflectionEngine_1 = require("./reflectionEngine");
var candidateGenerator_1 = require("./candidateGenerator");
var validationGate_1 = require("./validationGate");
var logger_1 = require("../../utils/logger");
var SkillOptService = /** @class */ (function () {
    function SkillOptService(workspaceRoot) {
        this.logger = logger_1.Logger.getInstance();
        this.registry = skillRegistry_1.SkillRegistry.getInstance(workspaceRoot);
        this.recorder = trajectoryRecorder_1.TrajectoryRecorder.getInstance(workspaceRoot);
        this.reflection = reflectionEngine_1.ReflectionEngine.getInstance();
        this.generator = candidateGenerator_1.CandidateGenerator.getInstance();
        this.validationGate = validationGate_1.ValidationGate.getInstance();
    }
    SkillOptService.getInstance = function (workspaceRoot) {
        if (!SkillOptService.instance) {
            SkillOptService.instance = new SkillOptService(workspaceRoot);
        }
        return SkillOptService.instance;
    };
    SkillOptService.resetInstance = function () {
        SkillOptService.instance = undefined;
    };
    /**
     * Executes the complete optimization loop.
     * @param skillName The name of the skill category to optimize.
     * @param validationRunner A callback that runs benchmark tests on the new candidate content and returns its score.
     */
    SkillOptService.prototype.optimize = function (skillName, validationRunner) {
        return __awaiter(this, void 0, void 0, function () {
            var bestSkill, allTrajectories, skillTrajectories, evaluator, totalScore, _i, skillTrajectories_1, t, scoreBefore, reflectionResult, candidateResult, candidateSkill, scoreAfter, decision;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bestSkill = this.registry.getBestSkill(skillName);
                        if (!bestSkill) {
                            throw new Error("Skill ".concat(skillName, " not found or has no best version."));
                        }
                        allTrajectories = this.recorder.getTrajectories();
                        skillTrajectories = allTrajectories.filter(function (t) { return t.skill === skillName && t.skillVersion === bestSkill.metadata.version; });
                        if (skillTrajectories.length === 0) {
                            throw new Error("No trajectories found for skill ".concat(skillName, " (version ").concat(bestSkill.metadata.version, ")."));
                        }
                        evaluator = evaluator_1.EvaluatorFactory.getEvaluator();
                        totalScore = 0;
                        for (_i = 0, skillTrajectories_1 = skillTrajectories; _i < skillTrajectories_1.length; _i++) {
                            t = skillTrajectories_1[_i];
                            totalScore += evaluator.evaluate(t).score;
                        }
                        scoreBefore = totalScore / skillTrajectories.length;
                        return [4 /*yield*/, this.reflection.reflect(skillTrajectories)];
                    case 1:
                        reflectionResult = _a.sent();
                        if (reflectionResult.improvements.length === 0) {
                            throw new Error('Optimization halted: No behavioral improvements proposed by reflection.');
                        }
                        return [4 /*yield*/, this.generator.generateCandidate(bestSkill.content, reflectionResult)];
                    case 2:
                        candidateResult = _a.sent();
                        if (candidateResult.edits.length === 0) {
                            throw new Error('Optimization halted: No edits generated for the candidate.');
                        }
                        candidateSkill = this.registry.createSkillVersion(skillName, candidateResult.candidateContent, bestSkill.metadata.version, 'Candidate generated by SkillOpt');
                        candidateSkill.metadata.status = 'draft';
                        this.registry.saveSkillVersion(skillName, candidateSkill);
                        // 6. Validate candidate
                        this.logger.log("Validating candidate v".concat(candidateSkill.metadata.version, " for ").concat(skillName, "..."));
                        return [4 /*yield*/, validationRunner(candidateResult.candidateContent)];
                    case 3:
                        scoreAfter = _a.sent();
                        decision = this.validationGate.evaluateDecision(scoreBefore, scoreAfter, 0.02);
                        if (decision.decision === 'accepted') {
                            // Promote candidate
                            this.registry.promoteSkill(skillName, candidateSkill.metadata.version);
                            this.logger.log("Optimization ACCEPTED: Promoted ".concat(skillName, " to v").concat(candidateSkill.metadata.version));
                        }
                        else {
                            // Reject candidate
                            candidateSkill.metadata.status = 'archived';
                            candidateSkill.metadata.changeDescription = "Rejected: ".concat(decision.reason);
                            this.registry.saveSkillVersion(skillName, candidateSkill);
                            this.logger.log("Optimization REJECTED: Candidate v".concat(candidateSkill.metadata.version, " discarded."));
                        }
                        // 9. Return Optimization Report
                        return [2 /*return*/, {
                                skill: skillName,
                                previousVersion: bestSkill.metadata.version,
                                candidateVersion: candidateSkill.metadata.version,
                                scoreBefore: scoreBefore,
                                scoreAfter: scoreAfter,
                                improvement: decision.improvement,
                                decision: decision.decision,
                                changes: candidateResult.edits,
                                reason: decision.reason
                            }];
                }
            });
        });
    };
    return SkillOptService;
}());
exports.SkillOptService = SkillOptService;

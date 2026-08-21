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
exports.CandidateGenerator = void 0;
var aiService_1 = require("../aiService");
var logger_1 = require("../../utils/logger");
var CandidateGenerator = /** @class */ (function () {
    function CandidateGenerator() {
        this.aiService = aiService_1.AIService.getInstance();
        this.logger = logger_1.Logger.getInstance();
    }
    CandidateGenerator.getInstance = function () {
        if (!CandidateGenerator.instance) {
            CandidateGenerator.instance = new CandidateGenerator();
        }
        return CandidateGenerator.instance;
    };
    CandidateGenerator.prototype.generateCandidate = function (currentSkillContent, reflection) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt;
            var _this = this;
            return __generator(this, function (_a) {
                if (reflection.improvements.length === 0) {
                    return [2 /*return*/, { edits: [], candidateContent: currentSkillContent }];
                }
                prompt = "You are an expert AI behavior optimizer.\nYou are given the current skill instructions and a reflection report detailing behavioral problems and improvements.\nGenerate a minimal, evidence-based set of edits to improve the skill.\nDo not invent problems. Do not make unrelated changes. Do not remove useful existing behavior.\n\nCurrent Skill:\n```markdown\n".concat(currentSkillContent, "\n```\n\nReflection Improvements:\n").concat(JSON.stringify(reflection.improvements, null, 2), "\n\nOutput your edits as ONLY a valid JSON array of objects matching this schema:\n[\n  {\n    \"operation\": \"ADD\" | \"REPLACE\" | \"DELETE\",\n    \"section\": \"The name of the section you are modifying or adding to\",\n    \"content\": \"The new content to ADD or REPLACE with\",\n    \"targetContent\": \"The exact existing content to REPLACE or DELETE\"\n  }\n]\nNo markdown formatting, no explanation. Just the JSON array.");
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var fullText = '';
                        _this.aiService.streamCompletion({
                            prompt: prompt,
                            systemInstruction: 'You are a JSON-only API. Respond only with a valid JSON array.',
                            callbacks: {
                                onChunk: function (chunk) {
                                    fullText += chunk;
                                },
                                onComplete: function (text) {
                                    try {
                                        var cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                                        var edits = JSON.parse(cleanedText);
                                        var candidateContent = _this.applyEdits(currentSkillContent, edits);
                                        resolve({ edits: edits, candidateContent: candidateContent });
                                    }
                                    catch (e) {
                                        reject(new Error('Failed to parse candidate JSON: ' + e.message));
                                    }
                                },
                                onError: function (error) {
                                    reject(error);
                                }
                            }
                        });
                    })];
            });
        });
    };
    CandidateGenerator.prototype.applyEdits = function (currentContent, edits) {
        var newContent = currentContent;
        for (var _i = 0, edits_1 = edits; _i < edits_1.length; _i++) {
            var edit = edits_1[_i];
            if (edit.operation === 'ADD') {
                if (edit.section && newContent.includes(edit.section)) {
                    // Simple append to section
                    newContent = newContent.replace(edit.section, edit.section + '\n' + edit.content);
                }
                else {
                    // Append to bottom if section not found
                    newContent += '\n\n' + (edit.section ? "## ".concat(edit.section, "\n") : '') + edit.content;
                }
            }
            else if (edit.operation === 'REPLACE' && edit.targetContent && edit.content) {
                newContent = newContent.replace(edit.targetContent, edit.content);
            }
            else if (edit.operation === 'DELETE' && edit.targetContent) {
                newContent = newContent.replace(edit.targetContent, '');
            }
        }
        return newContent.trim();
    };
    return CandidateGenerator;
}());
exports.CandidateGenerator = CandidateGenerator;

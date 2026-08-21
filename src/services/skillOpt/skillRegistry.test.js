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
var skillRegistry_1 = require("./skillRegistry");
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var assert = __importStar(require("assert"));
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var testWorkspace, registry, category, skillV1, skillV2, loadedV1, loadedV2, best, newBest, checkV2, files, skillsList;
        return __generator(this, function (_a) {
            console.log("Starting Phase 2 Unit Tests...");
            testWorkspace = path.join(__dirname, 'test_workspace_phase2');
            if (fs.existsSync(testWorkspace)) {
                fs.rmSync(testWorkspace, { recursive: true, force: true });
            }
            skillRegistry_1.SkillRegistry.resetInstance();
            registry = skillRegistry_1.SkillRegistry.getInstance(testWorkspace);
            try {
                category = 'coding';
                // 1. Create v1
                console.log("Running Test 1: Create v1");
                skillV1 = registry.createSkillVersion(category, '# Version 1 Content', undefined, 'Initial version');
                assert.strictEqual(skillV1.metadata.version, 1);
                registry.saveSkillVersion(category, skillV1);
                registry.promoteSkill(category, 1);
                console.log("Test 1 passed.");
                // 2. Create v2
                console.log("Running Test 2: Create v2");
                skillV2 = registry.createSkillVersion(category, '# Version 2 Content', 1, 'Improved loops');
                assert.strictEqual(skillV2.metadata.version, 2);
                assert.strictEqual(skillV2.metadata.parentVersion, 1);
                registry.saveSkillVersion(category, skillV2);
                registry.promoteSkill(category, 2);
                console.log("Test 2 passed.");
                // 3. Both versions remain available
                console.log("Running Test 3: Both versions remain available");
                loadedV1 = registry.loadSkill(category, 1);
                loadedV2 = registry.loadSkill(category, 2);
                assert.ok(loadedV1 && loadedV2);
                assert.strictEqual(loadedV1.content, '# Version 1 Content');
                assert.strictEqual(loadedV2.content, '# Version 2 Content');
                console.log("Test 3 passed.");
                // 4. Best version can be selected
                console.log("Running Test 4: Best version can be selected");
                best = registry.getBestSkill(category);
                assert.ok(best);
                assert.strictEqual(best.metadata.version, 2);
                assert.strictEqual(best.metadata.status, 'best');
                console.log("Test 4 passed.");
                // 5. Rollback works
                console.log("Running Test 5: Rollback works");
                registry.rollbackSkill(category, 1);
                newBest = registry.getBestSkill(category);
                assert.ok(newBest);
                assert.strictEqual(newBest.metadata.version, 1);
                assert.strictEqual(newBest.metadata.status, 'best');
                checkV2 = registry.loadSkill(category, 2);
                assert.strictEqual(checkV2.metadata.status, 'archived');
                console.log("Test 5 passed.");
                // 6. Historical versions are never deleted
                console.log("Running Test 6: Historical versions are never deleted");
                files = fs.readdirSync(path.join(testWorkspace, '.agents', 'skills', category));
                assert.ok(files.includes('skill_v1.md'));
                assert.ok(files.includes('skill_v2.md'));
                assert.ok(files.includes('metadata.json'));
                console.log("Test 6 passed.");
                skillsList = registry.listSkills();
                assert.ok(skillsList.includes(category));
                console.log("All Phase 2 unit tests passed successfully!");
            }
            catch (e) {
                console.error("Test failed:", e);
                process.exit(1);
            }
            finally {
                if (fs.existsSync(testWorkspace)) {
                    fs.rmSync(testWorkspace, { recursive: true, force: true });
                }
            }
            return [2 /*return*/];
        });
    });
}
runTests();

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
exports.Logger = void 0;
var vscode = __importStar(require("vscode"));
/**
 * Singleton Logger using VS Code OutputChannel for clean and non-intrusive logging.
 */
var Logger = /** @class */ (function () {
    function Logger() {
        this.channel = vscode.window.createOutputChannel('Chanakya AI Enhancer');
    }
    Logger.getInstance = function () {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    };
    Logger.prototype.log = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var timestamp = new Date().toISOString();
        var formattedArgs = args.length > 0 ? " | ".concat(JSON.stringify(args)) : '';
        this.channel.appendLine("[INFO  ".concat(timestamp, "] ").concat(message).concat(formattedArgs));
    };
    Logger.prototype.warn = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var timestamp = new Date().toISOString();
        var formattedArgs = args.length > 0 ? " | ".concat(JSON.stringify(args)) : '';
        this.channel.appendLine("[WARN  ".concat(timestamp, "] ").concat(message).concat(formattedArgs));
    };
    Logger.prototype.error = function (message, error) {
        var timestamp = new Date().toISOString();
        var errDetails = error instanceof Error ? "\nStack: ".concat(error.stack) : JSON.stringify(error);
        this.channel.appendLine("[ERROR ".concat(timestamp, "] ").concat(message, " ").concat(errDetails !== null && errDetails !== void 0 ? errDetails : ''));
    };
    Logger.prototype.show = function () {
        this.channel.show(true);
    };
    Logger.prototype.dispose = function () {
        this.channel.dispose();
    };
    return Logger;
}());
exports.Logger = Logger;

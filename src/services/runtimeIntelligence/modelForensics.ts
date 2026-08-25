import * as fs from 'fs';
import * as path from 'path';

export class ModelForensics {
    /**
     * Attempts to read the first few KB of a GGUF file to extract basic metadata 
     * without loading the entire multi-GB model into memory.
     */
    public static extractGGUFMetadata(filePath: string): any {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            // Very rudimentary GGUF magic number check
            // A real GGUF parser would use a struct parser, but we just read the raw strings
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(4096);
            fs.readSync(fd, buffer, 0, 4096, 0);
            fs.closeSync(fd);

            const headerStr = buffer.toString('utf-8');
            const isGGUF = buffer.readUInt32LE(0) === 0x46554747; // 'GGUF'

            if (!isGGUF) {
                return null;
            }

            // Extract whatever string metadata we can regex out of the header
            const nameMatch = headerStr.match(/general\.name\x00(.*?)\x00/);
            const archMatch = headerStr.match(/general\.architecture\x00(.*?)\x00/);
            const paramMatch = headerStr.match(/general\.parameter_count\x00(.*?)\x00/);
            const quantMatch = headerStr.match(/general\.quantization_version\x00(.*?)\x00/);

            return {
                name: nameMatch ? nameMatch[1].replace(/[^a-zA-Z0-9.\-_]/g, '') : 'UNKNOWN',
                architecture: archMatch ? archMatch[1].replace(/[^a-zA-Z0-9.\-_]/g, '') : 'UNKNOWN',
                parameterCount: paramMatch ? paramMatch[1].replace(/[^a-zA-Z0-9.\-_]/g, '') : 'UNKNOWN',
                quantization: quantMatch ? quantMatch[1].replace(/[^a-zA-Z0-9.\-_]/g, '') : 'UNKNOWN',
            };
        } catch (e) {
            // Ignore
        }
        return null;
    }
}

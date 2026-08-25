import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EvidenceItem, createEvidence, createUnknownEvidence } from './types';

const execAsync = promisify(exec);

export class HardwareDiscovery {
    private static instance: HardwareDiscovery;

    private constructor() {}

    public static getInstance(): HardwareDiscovery {
        if (!HardwareDiscovery.instance) {
            HardwareDiscovery.instance = new HardwareDiscovery();
        }
        return HardwareDiscovery.instance;
    }

    public async discoverHardware(): Promise<{
        cpu: EvidenceItem<string>;
        gpu: EvidenceItem<string>;
        ram_gb: EvidenceItem<number | null>;
        vram_gb: EvidenceItem<number | null>;
    }> {
        const platform = os.platform();
        const totalRamGb = Math.round(os.totalmem() / (1024 ** 3));
        const cpus = os.cpus();
        const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';

        let gpuName = 'Unknown GPU';
        let vramGb: number | null = null;
        let gpuSource = 'UNKNOWN';
        let gpuConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' = 'UNKNOWN';
        let gpuMethod = 'Failed to discover';

        if (platform === 'darwin') {
            try {
                // macOS: Use system_profiler
                const { stdout } = await execAsync('system_profiler SPDisplaysDataType');
                const chipsetMatch = stdout.match(/Chipset Model:\s*(.*)/);
                if (chipsetMatch && chipsetMatch[1]) {
                    gpuName = chipsetMatch[1].trim();
                    gpuSource = 'system_profiler SPDisplaysDataType';
                    gpuConfidence = 'HIGH';
                    gpuMethod = 'system_profiler command on macOS';

                    // Apple Silicon has unified memory
                    if (gpuName.includes('Apple')) {
                        vramGb = totalRamGb; // Shared memory
                    }
                }
            } catch (e) {
                // Ignore
            }
        } else {
            try {
                // Windows / Linux: Try nvidia-smi
                const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader');
                const parts = stdout.trim().split(',');
                if (parts.length === 2) {
                    gpuName = parts[0].trim();
                    const vramStr = parts[1].replace(' MiB', '').trim();
                    vramGb = Math.round(parseInt(vramStr, 10) / 1024);
                    gpuSource = 'nvidia-smi';
                    gpuConfidence = 'HIGH';
                    gpuMethod = 'nvidia-smi command execution';
                }
            } catch (e) {
                // Ignore
            }
        }

        return {
            cpu: createEvidence(cpuModel, 'os.cpus()', 'HIGH', 'Node.js os module'),
            gpu: gpuConfidence === 'UNKNOWN' ? createUnknownEvidence(gpuMethod, gpuName) : createEvidence(gpuName, gpuSource, gpuConfidence, gpuMethod),
            ram_gb: createEvidence(totalRamGb, 'os.totalmem()', 'HIGH', 'Node.js os module'),
            vram_gb: vramGb !== null ? createEvidence(vramGb, gpuSource, gpuConfidence, gpuMethod) : createUnknownEvidence('VRAM unavailable or indistinguishable from RAM', null)
        };
    }
}

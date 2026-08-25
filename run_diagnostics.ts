import { RuntimeIntelligenceService } from './src/services/runtimeIntelligence/runtimeIntelligenceService';

async function main() {
    const service = RuntimeIntelligenceService.getInstance();
    const diagnostic = await service.getRuntimeIntelligence();
    console.log(JSON.stringify(diagnostic, null, 2));
}

main().catch(console.error);

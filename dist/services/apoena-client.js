import { OpenAIClient } from './openai-client.js';
export class ApoenaEducationalClient extends OpenAIClient {
    constructor(options = {}) {
        super(options);
    }
    evaluateStep(payload) {
        return super.evaluateStep(payload);
    }
}

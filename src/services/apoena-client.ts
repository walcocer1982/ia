import type { OpenAIGatewayOptions } from './openai-gateway.js';
import { OpenAIClient, type EvaluateStepRequest } from './openai-client.js';
import type { SophiaResponse } from '../domain/responses.js';

export class ApoenaEducationalClient extends OpenAIClient {
  constructor(options: OpenAIGatewayOptions = {}) {
    super(options);
  }

  override evaluateStep(payload: EvaluateStepRequest): Promise<SophiaResponse> {
    return super.evaluateStep(payload);
  }
}

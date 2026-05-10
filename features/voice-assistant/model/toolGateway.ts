import type { VoiceAssistantContextData } from "../types";
import {
  ASSISTANT_READONLY_TOOLS,
  executeAssistantDataTool,
} from "./assistantDataTools";

export { ASSISTANT_READONLY_TOOLS };

export const executeVoiceAssistantTool = (
  name: string,
  rawArgs: unknown,
  context: VoiceAssistantContextData,
): unknown => executeAssistantDataTool(name, rawArgs, context);

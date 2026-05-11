import { handleNodeMcpRequest } from '../server/mcp/nodeHandler.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  await handleNodeMcpRequest(req, res);
}

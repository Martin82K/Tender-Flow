import { Readable } from 'node:stream';
import { handleMcpWebRequest } from './tenderFlowMcp.js';

const nodeRequestToWebRequest = (req) => {
  const protocol = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  const method = req.method || 'GET';
  return new Request(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : Readable.toWeb(req),
    duplex: method === 'GET' || method === 'HEAD' ? undefined : 'half',
  });
};

export const sendWebResponseToNode = async (webResponse, res) => {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!webResponse.body) {
    res.end();
    return;
  }

  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.end(buffer);
};

export const handleNodeMcpRequest = async (req, res) => {
  const webRequest = nodeRequestToWebRequest(req);
  const webResponse = await handleMcpWebRequest(webRequest);
  await sendWebResponseToNode(webResponse, res);
};

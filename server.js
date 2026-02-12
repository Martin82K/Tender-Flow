import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSecurityHeadersConfig,
  createSecurityHeadersMiddleware,
} from './server/securityHeaders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const securityConfig = createSecurityHeadersConfig();

app.use(createSecurityHeadersMiddleware(securityConfig));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS mode: ${securityConfig.allowAllOrigins ? 'allow-all' : 'allowlist'}`);
  console.log(`Frame ancestors: ${securityConfig.frameAncestors}`);
});

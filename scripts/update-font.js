
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Using a very standard, reliable URL
const FONT_URL = "https://raw.githubusercontent.com/fontsource/font-files/main/roboto/latin-400-normal.ttf";
const OUTPUT_PATH = path.join(__dirname, '../fonts/roboto-regular.ts');

console.log(`Downloading font from ${FONT_URL}...`);

async function downloadFont() {
    try {
        const response = await fetch(FONT_URL);
        if (!response.ok) {
            throw new Error(`Failed to download font: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        const content = `// Roboto Regular font for jsPDF - supports Czech diacritics
// Auto-generated from Roboto-Regular.ttf
// Date: ${new Date().toISOString()}

export const RobotoRegularBase64 = \`${base64}\`;
`;

        // Ensure directory exists
        const dir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_PATH, content);
        console.log(`Font file generated successfully at: ${OUTPUT_PATH}`);
        console.log(`Base64 length: ${base64.length}`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

downloadFont();

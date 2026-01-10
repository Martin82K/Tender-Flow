import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';

export interface PythonResult {
    success: boolean;
    output?: string;
    error?: string;
    outputFile?: string;
}

export interface PythonToolOptions {
    tool: 'excel-merge' | 'excel-unlock';
    inputFile: string;
    outputFile?: string;
    args?: string[];
}

/**
 * Python Runner Service
 * Executes Python tools locally on the desktop
 */
export class PythonRunnerService {
    private pythonPath: string = 'python3';
    private toolsPath: string;

    constructor() {
        // Tools are in server_py relative to app root
        const appPath = app.isPackaged
            ? path.dirname(app.getPath('exe'))
            : process.cwd();

        this.toolsPath = path.join(appPath, 'server_py');

        // Try to detect Python
        this.detectPython();
    }

    private async detectPython(): Promise<void> {
        const pythonCommands = ['python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];

        for (const cmd of pythonCommands) {
            try {
                const result = await this.exec(cmd, ['--version']);
                if (result.success) {
                    this.pythonPath = cmd;
                    console.log(`Python detected: ${cmd}`);
                    return;
                }
            } catch {
                continue;
            }
        }

        console.warn('Python not found in PATH. Python tools will not work.');
    }

    /**
     * Check if Python is available
     */
    async isPythonAvailable(): Promise<{ available: boolean; version?: string }> {
        try {
            const result = await this.exec(this.pythonPath, ['--version']);
            if (result.success && result.output) {
                const version = result.output.trim().replace('Python ', '');
                return { available: true, version };
            }
        } catch {
            // Ignore
        }
        return { available: false };
    }

    /**
     * Check if required dependencies are installed
     */
    async checkDependencies(): Promise<{ installed: boolean; missing: string[] }> {
        const required = ['openpyxl'];
        const missing: string[] = [];

        for (const pkg of required) {
            try {
                const result = await this.exec(this.pythonPath, ['-c', `import ${pkg}`]);
                if (!result.success) {
                    missing.push(pkg);
                }
            } catch {
                missing.push(pkg);
            }
        }

        return {
            installed: missing.length === 0,
            missing,
        };
    }

    /**
     * Run a Python tool
     */
    async runTool(options: PythonToolOptions): Promise<PythonResult> {
        const { tool, inputFile, outputFile, args = [] } = options;

        // Verify input file exists
        try {
            await fs.access(inputFile);
        } catch {
            return { success: false, error: `Input file not found: ${inputFile}` };
        }

        // Get script path
        let scriptPath: string;
        switch (tool) {
            case 'excel-merge':
                scriptPath = path.join(this.toolsPath, 'excel_merge_tool', 'merge_final.py');
                break;
            case 'excel-unlock':
                // For unlock, we need a different approach - call the function directly
                scriptPath = path.join(this.toolsPath, 'excel_unlock_api', 'unlock_standalone.py');
                break;
            default:
                return { success: false, error: `Unknown tool: ${tool}` };
        }

        // Check if script exists
        try {
            await fs.access(scriptPath);
        } catch {
            return { success: false, error: `Tool script not found: ${scriptPath}` };
        }

        // Determine output file
        const finalOutput = outputFile || this.generateOutputPath(inputFile, tool);

        // Build arguments
        const scriptArgs = [scriptPath, inputFile, finalOutput, ...args];

        // Execute
        const result = await this.exec(this.pythonPath, scriptArgs);

        if (result.success) {
            return {
                success: true,
                output: result.output,
                outputFile: finalOutput,
            };
        }

        return {
            success: false,
            error: result.error || 'Unknown error',
            output: result.output,
        };
    }

    /**
     * Run Excel merge tool
     */
    async mergeExcel(inputFile: string, outputFile?: string): Promise<PythonResult> {
        return this.runTool({
            tool: 'excel-merge',
            inputFile,
            outputFile,
        });
    }

    private generateOutputPath(inputFile: string, tool: string): string {
        const dir = path.dirname(inputFile);
        const ext = path.extname(inputFile);
        const base = path.basename(inputFile, ext);

        const suffix = tool === 'excel-merge' ? '_combined' : '_unlocked';
        return path.join(dir, `${base}${suffix}${ext}`);
    }

    private exec(command: string, args: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
        return new Promise((resolve) => {
            const proc = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, output: stdout });
                } else {
                    resolve({ success: false, output: stdout, error: stderr || `Exit code: ${code}` });
                }
            });

            proc.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                proc.kill();
                resolve({ success: false, error: 'Process timeout (5 minutes)' });
            }, 5 * 60 * 1000);
        });
    }
}

// Singleton
let pythonRunner: PythonRunnerService | null = null;

export function getPythonRunner(): PythonRunnerService {
    if (!pythonRunner) {
        pythonRunner = new PythonRunnerService();
    }
    return pythonRunner;
}

export default PythonRunnerService;

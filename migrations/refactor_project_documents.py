import re
import os

file_path = '/Users/martin/CRM/CRM/components/projectLayoutComponents/ProjectDocuments.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
print("Step 1: Replacing Imports...")
old_import = "import { getDocHubProjectLinks, isProbablyUrl, resolveDocHubStructureV1 } from '../../utils/docHub';"
new_imports = """import { useDocHubIntegration } from '../../hooks/useDocHubIntegration';
import { DocHubStatusCard } from './documents/dochub/DocHubStatusCard';
import { DocHubSetupWizard } from './documents/dochub/DocHubSetupWizard';
import { DocHubStructureEditor } from './documents/dochub/DocHubStructureEditor';
import { DocHubAutoCreateStatus } from './documents/dochub/DocHubAutoCreateStatus';
import { DocHubHistory } from './documents/dochub/DocHubHistory';
import { DocHubLinks } from './documents/dochub/DocHubLinks';"""

if old_import in content:
    content = content.replace(old_import, new_imports)
else:
    print("Warning: old_import not found")

content = content.replace("import { AutoCreateModal } from './documents/AutoCreateModal';", "// AutoCreateModal removed")

# 2. State Setup
print("Step 2: Replacing State...")
state_start = "const [docHubEnabled, setDocHubEnabled] = useState(false);"
state_end = "const [isDocHubConnecting, setIsDocHubConnecting] = useState(false);"

start_idx = content.find(state_start)
end_idx = content.find(state_end)

if start_idx != -1 and end_idx != -1:
    end_idx += len(state_end)
    new_state = """    // DocHub Integration Hook
    const docHub = useDocHubIntegration(project, project.docHubProvider, project.docHubRootFolderId, project.docHubMode, project.docHubConnectionDate);
    const { isConnected: isDocHubConnected, docHubProjectLinks, structureDraft: docHubStructure } = docHub.state;

    // UI state for logs (lifted up)
    const [showDocHubRunLog, setShowDocHubRunLog] = useState(false);
    const [showDocHubRunOverview, setShowDocHubRunOverview] = useState(false);
    const docHubRunLogRef = useRef<HTMLDivElement>(null);
    const docHubRunOverviewRef = useRef<HTMLDivElement>(null);

    const handleHistorySelect = (run: any, mode: 'log' | 'overview') => {
        docHub.setters.setAutoCreateResult({
            createdCount: null,
            runId: run.id,
            logs: run.logs,
            finishedAt: run.finished_at || run.started_at
        });
        if (mode === 'log') {
            setShowDocHubRunLog(true);
            setShowDocHubRunOverview(false);
            window.setTimeout(() => docHubRunLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } else {
            setShowDocHubRunOverview(true);
            setShowDocHubRunLog(false);
            window.setTimeout(() => docHubRunOverviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
    };"""
    content = content[:start_idx] + new_state + content[end_idx:]
else:
    print("Warning: State block not found")

# 3. Cleanups
print("Step 3: Cleanups...")
# Remove the docHub sync effect
effect_start = "useEffect(() => {"
effect_content = "setDocHubEnabled(!!project.docHubEnabled);"
if effect_content in content:
    # Find start of effect
    idx = content.find(effect_content)
    # Search backwards for useEffect
    start_eff = content.rfind("useEffect", 0, idx)
    # Search forwards for end of dependency array and semicolon
    end_eff = content.find("]);", idx)
    
    if start_eff != -1 and end_eff != -1:
         content = content[:start_eff] + "// Sync effect removed" + content[end_eff+3:]
    else:
         print("Warning: useEffect end not found")
else:
    print("Warning: useEffect content not found")

# Remove structure logic
struct_line = "const docHubStructure = resolveDocHubStructureV1(project.docHubStructureV1 || undefined);"
if struct_line in content:
    content = content.replace(struct_line, "")

struct_state = "const [isEditingDocHubStructure, setIsEditingDocHubStructure] = useState(false);"
if struct_state in content:
    content = content.replace(struct_state, "")

# Remove AutoCreateModal usage
content = re.sub(r'<AutoCreateModal\s+[^/]*?/>', '', content, flags=re.DOTALL)

# 4. DocsLinkSection update
print("Step 4: DocsLinkSection update...")
content = content.replace("docHubStructure={effectiveDocHubStructure}", "docHubStructure={docHubStructure}")

# 5. Render Block
print("Step 5: Render Block Replacement...")
render_start_marker = "{documentsSubTab === 'dochub' && ("
render_end_marker = "{/* Price Lists Section */}"

r_start = content.find(render_start_marker)
r_end = content.find(render_end_marker)

if r_start != -1 and r_end != -1:
    new_render = """                    {/* DocHub Section (Wizard) */}
                    {documentsSubTab === 'dochub' && (
                        <div className="space-y-6">
                            <DocHubStatusCard
                                state={docHub.state}
                                actions={docHub.actions}
                                setters={docHub.setters}
                                showModal={showModal}
                            />
                            
                            <DocHubSetupWizard
                                state={docHub.state}
                                actions={docHub.actions}
                                setters={docHub.setters}
                                showModal={showModal}
                            />
                            
                            {docHub.state.isConnected && !docHub.state.isSetupWizardOpen && (
                                <>
                                    <DocHubStructureEditor
                                        state={docHub.state}
                                        actions={docHub.actions}
                                        setters={docHub.setters}
                                        showModal={showModal}
                                    />
                                    
                                    <DocHubLinks
                                        state={docHub.state}
                                        showModal={showModal}
                                    />

                                    <DocHubAutoCreateStatus
                                        state={docHub.state}
                                        setters={docHub.setters}
                                        showModal={showModal}
                                        showLog={showDocHubRunLog}
                                        setShowLog={setShowDocHubRunLog}
                                        showOverview={showDocHubRunOverview}
                                        setShowOverview={setShowDocHubRunOverview}
                                        logRef={docHubRunLogRef}
                                        overviewRef={docHubRunOverviewRef}
                                    />

                                    <DocHubHistory
                                        project={project}
                                        onSelectRun={handleHistorySelect}
                                    />
                                </>
                            )}
                        </div>
                    )}
                    
                    """
    
    content = content[:r_start] + new_render + content[r_end:]
else:
    print("Warning: Render block not found")

# Link logic removal (863-918)
# Hledám `const input_hasDocHubRoot` -> `const docHubProjectLinks`
logic_start = "const hasDocHubRoot = !!project.docHubRootId && docHubRootLink.trim() !== '';"
logic_end_pattern = r'\}, \[isDocHubConnected, project.id, project.docHubRootId, project.docHubDriveId, project.docHubStructureV1\]\);'

start_l = content.find(logic_start)
if start_l != -1:
    # Find end using regex because of strict match issue
    match = re.search(logic_end_pattern, content[start_l:])
    if match:
        end_l = start_l + match.end()
        content = content[:start_l] + "// Old link logic removed" + content[end_l:]
    else:
        print("Warning: Link logic end not found")
else:
    print("Warning: Link logic start not found")

print("Saving...")
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done.")

[Setup]
AppName=Tender Flow MCP Bridge
AppVersion=1.0.0
AppPublisher=Tender Flow
AppPublisherURL=https://tenderflow.cz
AppSupportURL=https://tenderflow.cz
AppUpdatesURL=https://tenderflow.cz
DefaultDirName={localappdata}\TenderFlowMCP
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
OutputBaseFilename=TenderFlowMCPBridgeSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=tender-flow.ico
UninstallDisplayIcon={app}\tender-flow.ico

[Languages]
Name: "czech"; MessagesFile: "compiler:Languages\Czech.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Spouštět automaticky při startu Windows"; GroupDescription: "Nastavení spouštění:"; Flags: unchecked

[Files]
; Hlavní spustitelný soubor
Source: "..\dist\tender-flow-mcp-bridge-win-x64.exe"; DestDir: "{app}"; DestName: "tender-flow-mcp-bridge.exe"; Flags: ignoreversion
; Ikona pro zástupce
Source: "tender-flow.ico"; DestDir: "{app}"; DestName: "tender-flow.ico"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\Tender Flow MCP Bridge"; Filename: "{app}\tender-flow-mcp-bridge.exe"; IconFilename: "{app}\tender-flow.ico"
Name: "{userdesktop}\Tender Flow MCP Bridge"; Filename: "{app}\tender-flow-mcp-bridge.exe"; IconFilename: "{app}\tender-flow.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\tender-flow-mcp-bridge.exe"; Description: "{cm:LaunchProgram,Tender Flow MCP Bridge}"; Flags: nowait postinstall skipifsilent

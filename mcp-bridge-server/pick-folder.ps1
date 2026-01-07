# COM-based folder picker - more compatible with pkg-compiled Node.js apps
# This uses Shell.Application which doesn't require STA threading mode

try {
    $shell = New-Object -ComObject Shell.Application
    
    # BrowseForFolder parameters:
    # hwndOwner = 0 (no owner)
    # sTitle = dialog title
    # ulFlags = 0x51 (BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE | BIF_EDITBOX)
    # vRootFolder = 0 (Desktop)
    $folder = $shell.BrowseForFolder(0, "Vyberte kořenovou složku projektu", 0x51, 0)
    
    if ($folder -and $folder.Self) {
        Write-Output $folder.Self.Path
    }
    else {
        [Console]::Error.WriteLine("Dialog cancelled or no folder selected")
    }
}
catch {
    [Console]::Error.WriteLine("Error: $_")
    exit 1
}

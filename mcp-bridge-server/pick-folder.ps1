
try {
    Add-Type -AssemblyName System.Windows.Forms
} catch {
    Write-Error "Failed to load System.Windows.Forms: $_"
    exit 1
}

$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.ShowNewFolderButton = $true
$f.Description = "Vyberte kořenovou složku projektu"

# Attempt to bring to front (hacky, but might help if it's behind)
# We can't easily force it without a window handle, but we can try to warn the user.

# Show the dialog
$result = $f.ShowDialog()

if ($result -eq 'OK') {
    Write-Output $f.SelectedPath
} else {
    # If cancelled, we output nothing, which node sees as empty string
    # But let's log to stderr just in case
    [Console]::Error.WriteLine("Dialog result: $result")
}

' PLUS Laundry - Hidden Launcher
' Clears leftover Node.js env vars that break the bundled runtime,
' then starts laundry-app.exe hidden (no console window).

Dim fso, shell, appDir, exePath, result

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

appDir  = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = Chr(34) & appDir & "\laundry-app.exe" & Chr(34)

' --- Clear Node.js leftover env vars that can break pkg-bundled runtime ---
' These remain in System env after Node.js is uninstalled and cause crashes
shell.Environment("PROCESS")("OPENSSL_CONF")    = ""
shell.Environment("PROCESS")("OPENSSL_ENGINES") = ""
shell.Environment("PROCESS")("NODE_OPTIONS")    = ""
shell.Environment("PROCESS")("NODE_PATH")       = ""
shell.Environment("PROCESS")("NODE_ENV")        = ""

' --- Skip if already running (avoid port conflict on double-start) ---
result = shell.Run("cmd /c tasklist /FI ""IMAGENAME eq laundry-app.exe"" 2>nul | find /I ""laundry-app.exe"" >nul", 0, True)
If result <> 0 Then
    shell.Run exePath, 0, False
End If

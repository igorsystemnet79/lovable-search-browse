#define AppName "PonudiMi Installer"
#define AppVersion "0.1.0"
[Setup]
AppId={{8A0B46E4-9D74-4D90-9B21-73E8D17B2C11}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=PonudiMi
DefaultDirName={autopf}\PonudiMi Installer
DisableProgramGroupPage=yes
OutputDir=..\..\dist
OutputBaseFilename=PonudiMi-Installer-Windows
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
[Files]
Source: "PonudiMi-Deploy.ps1"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{autoprograms}\PonudiMi Installer"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\PonudiMi-Deploy.ps1"""
Name: "{autodesktop}\PonudiMi Installer"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\PonudiMi-Deploy.ps1"""
[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\PonudiMi-Deploy.ps1"""; Description: "Pokreni PonudiMi instalaciju"; Flags: postinstall nowait skipifsilent

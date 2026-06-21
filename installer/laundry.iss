; PLUS Laundry - Inno Setup Installer Script
; Build: npm run build:installer
; Output: dist\PLUS-Laundry-Setup.exe

#define AppName "PLUS Laundry"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppPublisher "PLUS Systems"
#define AppExeName "laundry-app.exe"
#define TaskName "LaundryPOS"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppId={{B2F3A1C4-9D8E-4F2B-A7C6-3E5D1F0B8A94}
DefaultDirName={autopf}\PLUS\Laundry
DefaultGroupName={#AppName}
OutputDir=..\dist
OutputBaseFilename=Laundry-PLUS-Setup-v{#AppVersion}
SetupIconFile=..\assets\icon\app.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
DisableProgramGroupPage=yes

[Languages]
Name: "default"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
FinishedHeadingLabel=اكتمل تثبيت [name]
FinishedLabel=تم تثبيت [name] بنجاح على جهازك.%n%nسيُفتح المتصفح تلقائياً على:%n https://localhost:3443
StatusExtractFiles=جاري نسخ الملفات...
StatusCreateIcons=جاري إنشاء الاختصارات...
StatusRunProgram=جاري تشغيل البرنامج...

[Files]
; البرنامج الرئيسي — يُستبدل دائماً
Source: "..\release\laundry-app.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\release\mkcert.exe";      DestDir: "{app}"; Flags: ignoreversion
; أيقونة التطبيق
Source: "..\assets\icon\app.ico";     DestDir: "{app}"; Flags: ignoreversion

; NSSM — يُسجَّل البرنامج كـ Windows Service
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

; السكريبتات — تُستبدل دائماً
Source: "..\scripts\*";               DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs

; أداة تشخيص في جذر التثبيت
Source: "..\scripts\diagnose.bat";    DestDir: "{app}"; Flags: ignoreversion

; ملف الإعدادات — مضمَّن بكلمة السر الصحيحة، لا يُستبدل عند إعادة التثبيت
Source: ".env"; DestDir: "{app}"; Flags: onlyifdoesntexist uninsneveruninstall

[Dirs]
; إنشاء مجلد ssl فارغ (mkcert سيملؤه)
Name: "{app}\ssl"

[Icons]
; اختصار سطح المكتب — يفتح المتصفح مباشرة بدون نافذة سوداء
Name: "{commondesktop}\الرابط مغاسل"; \
  Filename: "{sys}\explorer.exe"; \
  Parameters: "https://localhost:3443"; \
  IconFilename: "{app}\app.ico"; \
  Comment: "فتح نظام إدارة المغسلة"

[Run]
; لا توجد خطوات mkcert هنا — تعمل من [Code] حتى تظهر نوافذها فوق الـ installer


[UninstallRun]
; إزالة Task Scheduler القديم إن وجد (للتوافق مع الإصدارات السابقة)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Unregister-ScheduledTask -TaskName '{#TaskName}' -Confirm:$false -ErrorAction SilentlyContinue"""; \
  Flags: runhidden waituntilterminated; \
  RunOnceId: "RemoveLaundryTask"

[Registry]
; حذف أي تشغيل تلقائي قديم عبر Registry (الإصدارات السابقة)
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; \
  ValueName: "PLUSLaundry"; Flags: deletevalue

; حذف متغيرات Node.js الضارة من System environment نهائياً
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "OPENSSL_CONF";    Flags: deletevalue; Tasks: ;
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "OPENSSL_ENGINES"; Flags: deletevalue; Tasks: ;
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_OPTIONS";    Flags: deletevalue; Tasks: ;
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_PATH";       Flags: deletevalue; Tasks: ;
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_ENV";        Flags: deletevalue; Tasks: ;

[Code]
function SetFileAttributes(lpFileName: String; dwFileAttributes: DWORD): BOOL;
  external 'SetFileAttributesW@kernel32.dll stdcall';

{ فحص حجم ملف بأمان — يرجع 0 إذا غير موجود }
function GetFileSizeSafe(FileName: String): Int64;
var FSize: Int64;
begin
  Result := 0;
  if FileExists(FileName) then
    if FileSize64(FileName, FSize) then
      Result := FSize;
end;

{ فحص MySQL قبل بدء التثبيت — تنبيه إذا غير مثبتة لكن لا نمنع التثبيت }
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  MySqlFound: Boolean;
  TmpFile: String;
begin
  Result := True;
  MySqlFound := False;

  { 1) ابحث عن خدمة MySQL في النظام }
  TmpFile := ExpandConstant('{tmp}\mysql-check.txt');
  Exec(ExpandConstant('{cmd}'),
       '/C sc query type= service state= all | findstr /I "MySQL" > "' + TmpFile + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  if GetFileSizeSafe(TmpFile) > 0 then
    MySqlFound := True;

  { 2) أو افحص المنفذ 3306 }
  if not MySqlFound then begin
    Exec(ExpandConstant('{cmd}'),
         '/C netstat -an | findstr ":3306" > "' + TmpFile + '"',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if GetFileSizeSafe(TmpFile) > 0 then
      MySqlFound := True;
  end;

  if not MySqlFound then begin
    if MsgBox(
        'تحذير: لم يتم العثور على MySQL Server على هذا الجهاز.' + #13#10 + #13#10 +
        'البرنامج يحتاج MySQL Server مثبّتة بكلمة سر root:' + #13#10 +
        '   Db2@dm1n2022' + #13#10 + #13#10 +
        'إذا كانت مثبّتة بكلمة سر مختلفة، عدّل ملف .env بعد التثبيت.' + #13#10 + #13#10 +
        'هل تريد المتابعة على أي حال؟',
        mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
  end;
end;

procedure RegisterService(AppDir: String);
var NssmPath: String; ResultCode: Integer;
begin
  NssmPath := AppDir + '\nssm.exe';
  { إلغاء تسجيل قديم إن وجد }
  Exec(NssmPath, 'remove LaundryPlusApp confirm', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(500);
  { تسجيل الـ Service }
  Exec(NssmPath, 'install LaundryPlusApp "' + AppDir + '\{#AppExeName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp AppDirectory "' + AppDir + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp DisplayName {#AppName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp Description نظام إدارة المغسلة', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { تشغيل مؤجل — يعطي MySQL وقتاً للبدء قبل البرنامج }
  Exec(NssmPath, 'set LaundryPlusApp Start SERVICE_DELAYED_AUTO_START', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { إعادة التشغيل عند الفشل مع تأخير 30 ثانية (كافٍ لبدء MySQL) }
  Exec(NssmPath, 'set LaundryPlusApp AppExit Default Restart', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { تأخير 10 ثوانٍ فقط — البرنامج نفسه ينتظر MySQL داخلياً لمدة 90 ثانية }
  Exec(NssmPath, 'set LaundryPlusApp AppRestartDelay 10000', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { تعطيل AppThrottle تماماً — كان يسبب تجميد الـ service في حالة Paused }
  Exec(NssmPath, 'set LaundryPlusApp AppThrottle 0', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp ObjectName LocalSystem', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { === CRITICAL: NSSM stdout/stderr logging — بدونه لا يمكن تشخيص الأخطاء === }
  ForceDirectories(AppDir + '\data\logs');
  Exec(NssmPath, 'set LaundryPlusApp AppStdout "' + AppDir + '\data\logs\service-stdout.log"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp AppStderr "' + AppDir + '\data\logs\service-stderr.log"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { Rotation: عند 5MB يُنشأ ملف جديد }
  Exec(NssmPath, 'set LaundryPlusApp AppRotateFiles 1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp AppRotateOnline 1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(NssmPath, 'set LaundryPlusApp AppRotateBytes 5242880', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { بيئة: TZ صريح حتى لا يفشل الـ logging }
  Exec(NssmPath, 'set LaundryPlusApp AppEnvironmentExtra "NODE_NO_WARNINGS=1"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { تشغيل الـ Service فوراً }
  Exec(NssmPath, 'start LaundryPlusApp', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { إعداد recovery actions عبر sc.exe: restart عند الفشل }
  Exec(ExpandConstant('{sys}\sc.exe'),
       'failure LaundryPlusApp reset= 86400 actions= restart/30000/restart/60000/restart/120000',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { Scheduled Task: يفحص كل 5 دقائق — إذا Paused يستأنف تلقائياً }
  Exec('powershell.exe',
       '-NoProfile -ExecutionPolicy Bypass -Command "' +
       '$action = New-ScheduledTaskAction -Execute ''sc.exe'' -Argument ''continue LaundryPlusApp''; ' +
       '$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date); ' +
       '$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -Hidden; ' +
       'Register-ScheduledTask -TaskName ''LaundryPlusWatchdog'' -Action $action -Trigger $trigger ' +
       '-Settings $settings -RunLevel Highest -Force | Out-Null"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var EnvFile, AppDir: String; ResultCode: Integer;
begin
  if CurStep = ssInstall then begin
    { إيقاف الـ Service القديم عبر NSSM }
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop LaundryPlusApp', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(2000);
    { احتياط: taskkill لو NSSM لم يكن مثبتاً }
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#AppExeName}', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
  if CurStep = ssPostInstall then begin
    AppDir := ExpandConstant('{app}');

    { منح صلاحية الكتابة الكاملة لمجلد التثبيت لجميع المستخدمين }
    Exec(ExpandConstant('{sys}\icacls.exe'),
         '"' + AppDir + '" /grant *S-1-5-32-545:(OI)(CI)F /T /Q',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    { إخفاء .env }
    EnvFile := AppDir + '\.env';
    if FileExists(EnvFile) then
      SetFileAttributes(EnvFile, $0002);

    { تنبيه المستخدم قبل تثبيت شهادة HTTPS }
    MsgBox('سيظهر حوار أمان لتثبيت شهادة HTTPS.' + #13#10 +
           'انقر "نعم" للموافقة حتى يكتمل التثبيت.',
           mbInformation, MB_OK);

    { تثبيت mkcert CA في Windows trust store — الحوار يظهر الآن فوق كل النوافذ }
    Exec(AppDir + '\mkcert.exe', '-install', AppDir,
         SW_SHOW, ewWaitUntilTerminated, ResultCode);

    { توليد شهادة localhost }
    Exec(AppDir + '\mkcert.exe',
         '-key-file "' + AppDir + '\ssl\localhost-key.pem"' +
         ' -cert-file "' + AppDir + '\ssl\localhost-cert.pem"' +
         ' localhost 127.0.0.1',
         AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

    { تسجيل وتشغيل الـ Windows Service }
    RegisterService(AppDir);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then begin
    { إيقاف وإزالة الـ Watchdog Task }
    Exec('powershell.exe',
         '-NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName ''LaundryPlusWatchdog'' -Confirm:$false -ErrorAction SilentlyContinue"',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    { إيقاف وإزالة الـ Service }
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop LaundryPlusApp', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
    Exec(ExpandConstant('{app}\nssm.exe'), 'remove LaundryPlusApp confirm', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

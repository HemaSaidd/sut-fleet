import os
import subprocess

desktop = os.path.expanduser('~/Desktop')
shortcut_path = os.path.join(desktop, 'SUT Fleet Admin.lnk')
chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
ico_path = os.path.abspath('assets/app-icon.ico')
target_url = 'https://sut-fleet.vercel.app/admin.html'

ps_script = f'''
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{chrome_path}"
$Shortcut.Arguments = "--app={target_url}"
$Shortcut.Description = "SUT Fleet Operations Center"
$Shortcut.IconLocation = "{ico_path},0"
$Shortcut.Save()
'''

ps_file = 'temp_shortcut.ps1'
with open(ps_file, 'w', encoding='utf-8') as f:
    f.write(ps_script)

subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps_file], check=True)
if os.path.exists(ps_file):
    os.remove(ps_file)

print('SUCCESS: Created shortcut on Desktop:', shortcut_path)

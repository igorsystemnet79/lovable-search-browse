Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object Windows.Forms.Form
$form.Text="PonudiMi - instalacija na internet server";$form.Size=New-Object Drawing.Size(720,640);$form.StartPosition="CenterScreen"
function Label($s,$x,$y){$c=New-Object Windows.Forms.Label;$c.Text=$s;$c.Location=New-Object Drawing.Point($x,$y);$c.Size=New-Object Drawing.Size(190,24);$form.Controls.Add($c)}
function Field($x,$y,$w=440){$c=New-Object Windows.Forms.TextBox;$c.Location=New-Object Drawing.Point($x,$y);$c.Size=New-Object Drawing.Size($w,25);$form.Controls.Add($c);return $c}
Label "IP adresa ili hostname servera:" 20 22;$hostBox=Field 220 20
Label "SSH korisnik (npr. ubuntu):" 20 62;$userBox=Field 220 60
Label "SSH privatni ključ:" 20 102;$keyBox=Field 220 100 340
$browse=New-Object Windows.Forms.Button;$browse.Text="Izaberi...";$browse.Location=New-Object Drawing.Point(575,98);$browse.Size=New-Object Drawing.Size(100,27);$browse.Add_Click({$d=New-Object Windows.Forms.OpenFileDialog;if($d.ShowDialog() -eq "OK"){$keyBox.Text=$d.FileName}});$form.Controls.Add($browse)
Label "Domen (npr. ponudimi.rs):" 20 142;$domainBox=Field 220 140
Label "Email prvog administratora:" 20 182;$emailBox=Field 220 180
$note=New-Object Windows.Forms.Label;$note.Text="Potreban je Ubuntu 22.04/24.04 VPS, SSH pristup ključem i domen usmeren na IP servera.";$note.Location=New-Object Drawing.Point(20,220);$note.Size=New-Object Drawing.Size(660,38);$form.Controls.Add($note)
$log=New-Object Windows.Forms.TextBox;$log.Multiline=$true;$log.ReadOnly=$true;$log.ScrollBars="Vertical";$log.Location=New-Object Drawing.Point(20,270);$log.Size=New-Object Drawing.Size(660,260);$form.Controls.Add($log)
function Log($s){$log.AppendText((Get-Date -Format "HH:mm:ss")+"  "+$s+[Environment]::NewLine);[Windows.Forms.Application]::DoEvents()}
function Run($exe,[string[]]$arguments){$o=Join-Path $env:TEMP "ponudimi-o.txt";$e=Join-Path $env:TEMP "ponudimi-e.txt";$quoted=foreach($arg in $arguments){'"'+$arg.Replace('"','\"')+'"'};$p=Start-Process -FilePath $exe -ArgumentList ($quoted -join " ") -NoNewWindow -Wait -PassThru -RedirectStandardOutput $o -RedirectStandardError $e;if(Test-Path $o){Get-Content $o|%{Log $_}};if(Test-Path $e){Get-Content $e|%{Log $_}};if($p.ExitCode -ne 0){throw "$exe nije uspešno završen (kod $($p.ExitCode))."}}
$go=New-Object Windows.Forms.Button;$go.Text="INSTALIRAJ PONUDIMI";$go.Location=New-Object Drawing.Point(20,550);$go.Size=New-Object Drawing.Size(220,38);$form.Controls.Add($go)
$quit=New-Object Windows.Forms.Button;$quit.Text="Zatvori";$quit.Location=New-Object Drawing.Point(560,550);$quit.Size=New-Object Drawing.Size(120,38);$quit.Add_Click({$form.Close()});$form.Controls.Add($quit)
$go.Add_Click({
$go.Enabled=$false
try {
$server=$hostBox.Text.Trim();$user=$userBox.Text.Trim();$key=$keyBox.Text.Trim();$domain=$domainBox.Text.Trim().ToLowerInvariant();$email=$emailBox.Text.Trim()
if($server -notmatch "^[A-Za-z0-9.-]+$"){throw "Unesi ispravnu adresu servera."}
if($user -notmatch "^[A-Za-z0-9_-]+$"){throw "Unesi ispravno SSH korisničko ime."}
if(!(Test-Path -LiteralPath $key -PathType Leaf)){throw "Izaberi postojeći SSH privatni ključ."}
if($domain -notmatch "^[a-z0-9.-]+\.[a-z]{2,}$"){throw "Unesi ispravan domen usmeren na server."}
if($email -notmatch "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"){throw "Unesi ispravnu email adresu."}
$ssh=(Get-Command ssh.exe -ErrorAction Stop).Source;$scp=(Get-Command scp.exe -ErrorAction Stop).Source
Log "Provera SSH veze..."
Run $ssh @("-i",$key,"-o","BatchMode=yes","-o","StrictHostKeyChecking=accept-new","-o","ConnectTimeout=15","$user@$server","echo PONUDIMI_SSH_OK")
Log "Preuzimanje izvornog koda..."
$zip=Join-Path $env:TEMP "ponudimi-source.zip"
Invoke-WebRequest -Uri "https://codeload.github.com/igorsystemnet79/lovable-search-browse/zip/refs/heads/windows-installer-prep" -OutFile $zip
if((Get-Item $zip).Length -lt 100000){throw "Preuzeti paket je neočekivano mali."}
Log "Slanje paketa na server..."
Run $scp @("-i",$key,"-o","BatchMode=yes","-o","StrictHostKeyChecking=accept-new",$zip,"$($user)@$($server):/tmp/ponudimi-source.zip")
$remote="set -eu; command -v apt-get >/dev/null; sudo -n true; sudo apt-get update; sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 openssl unzip; sudo systemctl enable --now docker; sudo mkdir -p /opt/ponudimi; sudo unzip -q -o /tmp/ponudimi-source.zip -d /tmp/ponudimi-unpack; sudo cp -a /tmp/ponudimi-unpack/*/. /opt/ponudimi/; sudo chown -R $($user):$($user) /opt/ponudimi; sudo bash -c 'cd /opt/ponudimi/standalone && printf \"%s\\n\" \"$domain\" \"$email\" | sh ./scripts/install.sh && docker compose ps'"
Log "Instalacija servisa na serveru..."
Run $ssh @("-i",$key,"-o","BatchMode=yes","-o","StrictHostKeyChecking=accept-new","$user@$server",$remote)
Log "Instalaciona komanda je završena. Servisi mogu još preuzimati i graditi kontejnere."
[Windows.Forms.MessageBox]::Show("Postupak je pokrenut. Proveri https://$domain. Ne isključuj Render dok ne proverimo bazu, fotografije i sve funkcije.","PonudiMi")
} catch {
Log ("GREŠKA: "+$_.Exception.Message)
[Windows.Forms.MessageBox]::Show($_.Exception.Message,"PonudiMi - instalacija nije završena")
} finally {$go.Enabled=$true}
})
[void]$form.ShowDialog()

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CredMan4 {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
    [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
    public long LastWritten; public int CredentialBlobSize;
    public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
    [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredReadW(string target, int type, int flags, out IntPtr cred);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred);
}
'@
$ptr = [IntPtr]::Zero
if (-not [CredMan4]::CredReadW('Supabase CLI:supabase', 1, 0, [ref]$ptr)) { Write-Output 'AUSENTE'; exit }
try {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan4+CREDENTIAL])
  $bytes = New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $bytes, 0, $c.CredentialBlobSize)
  $pat = [System.Text.Encoding]::ASCII.GetString($bytes).Trim()
  $h = @{ Authorization = "Bearer $pat" }
  # paths possiveis da config de auth
  foreach ($u in @(
    'https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config/auth',
    'https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config'
  )) {
    try {
      $cfg = Invoke-RestMethod -Uri $u -Headers $h
      Write-Output ("OK $u")
      $out = [ordered]@{}
      foreach ($p in @('SITE_URL','MAILER_AUTOCONFIRM','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_SENDER_NAME','SMTP_ADMIN_EMAIL','URL_PATHS_CONFIRMATION','URL_PATHS_RECOVERY','MAILER_SUBJECTS_CONFIRMATION','MAILER_SUBJECTS_RECOVERY','MAILER_TEMPLATES_CONFIRMATION_CONTENT','MAILER_TEMPLATES_RECOVERY_CONTENT')) {
        if ($cfg.PSObject.Properties.Name -contains $p) { $out[$p] = $cfg.$p }
      }
      $out['SMTP_PASS_set'] = [bool]$cfg.SMTP_PASS
      $out | ConvertTo-Json
      break
    } catch { Write-Output ("FALHOU $u -> $($_.Exception.Message)") }
  }
} finally { [CredMan4]::CredFree($ptr) }
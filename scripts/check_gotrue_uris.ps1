Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CM5{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct CREDENTIAL{public int Flags;public int Type;[MarshalAs(UnmanagedType.LPWStr)]public string TargetName;[MarshalAs(UnmanagedType.LPWStr)]public string Comment;public long LastWritten;public int CredentialBlobSize;public IntPtr CredentialBlob;public int Persist;public int AttributeCount;public IntPtr Attributes;[MarshalAs(UnmanagedType.LPWStr)]public string TargetAlias;[MarshalAs(UnmanagedType.LPWStr)]public string UserName;}[DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool CredReadW(string t,int ty,int f,out IntPtr c);[DllImport("advapi32.dll")]public static extern void CredFree(IntPtr c);}'
$ptr=[IntPtr]::Zero
if(-not [CM5]::CredReadW('Supabase CLI:supabase',1,0,[ref]$ptr)){Write-Output 'AUSENTE';exit}
try{
  $c=[Runtime.InteropServices.Marshal]::PtrToStructure($ptr,[type][CM5+CREDENTIAL])
  $b=New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob,$b,0,$c.CredentialBlobSize)
  $pat=[Text.Encoding]::ASCII.GetString($b).Trim()
  $cfg=Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config/auth' -Headers @{Authorization="Bearer $pat"}
  foreach($p in 'SITE_URL','URI_ALLOW_LIST','MAILER_SECURE_EMAIL_CHANGE_ENABLED','MAILER_OTP_EXP','MAILER_OTP_LENGTH','DISABLE_SIGNUP','SMTP_MAX_FREQUENCY') { if($cfg.PSObject.Properties.Name -contains $p){Write-Output ("$p = " + $cfg.$p)} }
} finally {[CM5]::CredFree($ptr)}

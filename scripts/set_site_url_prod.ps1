# set_site_url_prod.ps1 — PREPARADO mas NÃO executado (produção).
# Corrige SITE_URL de http://localhost:3000 para https://revolutionx.com.br
# no Supabase produção (proj ardpabjoepzhkpmkgwgu).
#
# Leitura do PAT: Credential Manager Windows, entrada 'Supabase CLI:supabase'
# (mesmo mecanismo de check_gotrue_uris.ps1). O PAT nunca é impresso.
#
# Impacto validado: register/forgot/reset montam emailRedirectTo via
# resolvePublicSiteOrigin (src/lib/site-origin.ts), que prioriza
# NEXT_PUBLIC_SITE_URL e caí para https://revolutionx.com.br — o link de
# confirmação/reset do GoTrue já vai para o domínio canônico, que está na
# URI_ALLOW_LIST. Trocar SITE_URL corrige apenas os links "padrão" que o
# GoTrue gera quando NÃO recebe redirectTo (ex.: e-mail de troca de e-mail,
# recovery sem redirect explícito). Não quebra o fluxo atual.
#
# Para executar quando autorizado:   powershell -File scripts/set_site_url_prod.ps1
# (comentar a linha $dryRun=$false abaixo).

param([switch]$Apply)

Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CM5s{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct CREDENTIAL{public int Flags;public int Type;[MarshalAs(UnmanagedType.LPWStr)]public string TargetName;[MarshalAs(UnmanagedType.LPWStr)]public string Comment;public long LastWritten;public int CredentialBlobSize;public IntPtr CredentialBlob;public int Persist;public int AttributeCount;public IntPtr Attributes;[MarshalAs(UnmanagedType.LPWStr)]public string TargetAlias;[MarshalAs(UnmanagedType.LPWStr)]public string UserName;}[DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool CredReadW(string t,int ty,int f,out IntPtr c);[DllImport("advapi32.dll")]public static extern void CredFree(IntPtr c);}'

$ptr=[IntPtr]::Zero
if(-not [CM5s]::CredReadW('Supabase CLI:supabase',1,0,[ref]$ptr)){Write-Error 'PAT Supabase ausente no Credential Manager';exit 1}
try{
  $c=[Runtime.InteropServices.Marshal]::PtrToStructure($ptr,[type][CM5s+CREDENTIAL])
  $b=New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob,$b,0,$c.CredentialBlobSize)
  $pat=[Text.Encoding]::ASCII.GetString($b).Trim()
  $hdr=@{Authorization="Bearer $pat"}

  # 1) Estado atual (leitura)
  $cfg=Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config/auth' -Headers $hdr
  Write-Output ("ANTES  SITE_URL       = " + $cfg.SITE_URL)
  Write-Output ("ANTES  URI_ALLOW_LIST = " + $cfg.URI_ALLOW_LIST)

  # 2) Preparo do corpo (NÃO envia sem -Apply)
  $body=@{ SITE_URL='https://revolutionx.com.br' } | ConvertTo-Json
  Write-Output ("BODY   " + $body)

  if(-not $Apply){
    Write-Warning 'DRY-RUN: nada enviado. Use -Apply (apos revisar) para gravar.'
    Write-Output ('Comando a executar:  powershell -File scripts/set_site_url_prod.ps1 -Apply')
    exit 0
  }

  # 3) Aplicação (PATCH)
  $updated=Invoke-RestMethod -Method Patch -Uri 'https://api.supabase.com/v1/projects/ardpabjoepzhkpmkgwgu/config/auth' -Headers $hdr -ContentType 'application/json' -Body $body
  Write-Output ("DEPOIS SITE_URL = " + $updated.SITE_URL)
  Write-Output 'OK: SITE_URL gravado.'
} finally {[CM5s]::CredFree($ptr)}
# Protocol P0.8 — Section 3: Meta Console via CDP

## 3.1 Screenshot Before Scope Removal

The 23 browser tabs are already available via CDP at 127.0.0.1:9222. I'll capture a baseline screenshot before removing scopes, then remove the 8 unnecessary scopes, capture after, and diff.

**Steps**:
1. Screenshot current state (before scope removal)
2. Remove 8 scopes in Meta Console
3. Screenshot after scope removal  
4. Diff the two screenshots for evidence
5. Submit review of remaining 5 scopes
6. Record ID and status

## 3.2 Business Manager → System Users

After scope cleanup, create/system users in Business Manager:
- Assign ad account (984184351272559) to the system user
- Assign the relevant Facebook Page
- Generate system user token with approved scopes
- Validate with `act_` endpoint → expect 200

## 3.3 System User Token Generation

Generate `META_SYSTEM_USER_TOKEN_1421814643397349` (new var). Validate:
```
GET https://graph.facebook.com/v26.0/act_984184351272559?fields=id,name,account_status&access_token=<SYSTEM_TOKEN>
→ 200 OK
```

## 3.4 hPanel → Auth → SMTP → Configure

Configure mailer in Supabase hPanel to fix the register 400 error. After configuration:
- Register test should work (the 400 error should be resolved)
- Evidence: successful registration flow

## 3.5 Scope Review Submission

Submit review of the 5 remaining scopes in Meta Console. Document:
- Which 5 scopes were removed
- Which 5 remain under review
- Review ID and expected approval timeline
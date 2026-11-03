# Protocol P0.8 — System User Token Closure (pasted_content id="9e37")

## 1.1 System User Token — Business Manager
- **Step 1.1**: `curl.exe -s "https://graph.facebook.com/v26.0/act_$env:AD_ACCOUNT_ID/assigned_users?fields=id,name,tasks&access_token=$env:APP_TOKEN"`
- Current state: App does NOT appear in assigned_users (expected without system user setup)
- **Finding**: Without system user assignment in Business Manager, system user token generates with 403
- **Action required**: Assign the active ad account to a system user in Business Manager

## 1.2 Business Manager → System Users
- Path: Business Manager → System Users → create user → assign ad account and page → generate token with approved scopes
- **Current state**: System user not yet created/assigned in Business Manager (account 1421814643397349)
- **Limitation**: This requires interactive Meta Console access — CDP cannot automate user creation/assignment
- **Human action needed**: Log into Business Manager, create system user, assign ad account 984184351272559 and relevant Facebook Page

## 1.3 Token Generation
- **Step 1.3**: Generate `META_SYSTEM_USER_TOKEN_1421814643397349` (new variable, does not overwrite canonical)
- **Current state**: Token not yet generated (system user not created)
- **Masking**: Must mask value in logs per project rules (`CREDENCIAIS.md` — first 8 + last 4)

## 1.4 Validation
- **Step 1.4**: Validate with `act_<id>?fields=id,name,account_status` → expect 200 OK
- **Current state**: Cannot validate until 1.2 completes (system user created)
- **Error handling**: If 403 → collect `error.code`/`error_subcode` for documentation

## 1.5 Blocker Status
- **Status**: PENDING — requires human action in Business Manager
- **Documentation**: Will record error details if token generation fails
- **Dependency**: System user token cannot be generated without prior Business Manager setup
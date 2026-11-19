ALTER TABLE password_reset_tokens ALTER COLUMN token_hash TYPE TEXT;
ALTER TABLE email_verification_tokens ALTER COLUMN token_hash TYPE TEXT;
-- api-key providers (Tevalis etc.) store their credential in access_token;
-- refresh fields stay null and the cron skips token refresh for them.
ALTER TABLE pouriq_pos_connections ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'oauth';

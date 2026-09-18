-- 060_login_lockout.sql
-- design-system.md's login spec ("3 percobaan gagal -> kunci 15 menit +
-- email keamanan") was never actually implemented — app/api/auth/login/
-- route.ts just returned "Email atau password salah" on every failure with
-- no attempt tracking at all, an unlimited-attempts brute-force surface.
--
-- Adds the tracking columns; the counting/locking logic itself lives in the
-- login route (an admin-client pre-check before calling
-- supabase.auth.signInWithPassword(), then an update after, so a locked
-- account is rejected without even attempting the real auth call). The
-- "kirim email keamanan" half of that spec is NOT implemented — there's no
-- email-sending infrastructure anywhere in this codebase (no Resend/
-- SendGrid/SMTP integration, only Supabase Auth's own built-in signup
-- confirmation emails), so this is disclosed as a real, known gap rather
-- than faked.
alter table users add column failed_login_attempts int not null default 0;
alter table users add column locked_until timestamptz;

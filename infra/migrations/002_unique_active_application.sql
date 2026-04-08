-- Migration 002: Prevent duplicate active applications per user
-- A user may only have one non-rejected application at a time.
-- CONCURRENTLY avoids locking the table during index build.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_one_active_app_per_user
    ON applications(user_id)
    WHERE status != 'rejected';

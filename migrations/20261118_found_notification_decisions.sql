BEGIN;

-- Retain statuses already in use while permitting owner review decisions.
ALTER TABLE found_notifications
    DROP CONSTRAINT IF EXISTS found_notifications_status_check;

ALTER TABLE found_notifications
    ADD CONSTRAINT found_notifications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'));

COMMIT;

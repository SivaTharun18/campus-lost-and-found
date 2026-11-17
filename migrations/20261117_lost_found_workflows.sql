BEGIN;

-- Add a distinct archive state. Existing 'returned' rows are intentionally untouched.
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items
    ADD CONSTRAINT items_status_check
    CHECK (status IN ('active', 'claimed', 'returned', 'archived'));

CREATE TABLE IF NOT EXISTS found_notifications (
    notification_id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(item_id),
    finder_id INTEGER NOT NULL REFERENCES users(user_id),
    found_location VARCHAR(250) NOT NULL,
    found_date DATE NOT NULL,
    description TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS found_notifications_item_id_idx
    ON found_notifications(item_id);
CREATE INDEX IF NOT EXISTS found_notifications_finder_id_idx
    ON found_notifications(finder_id);
CREATE INDEX IF NOT EXISTS found_notifications_status_idx
    ON found_notifications(status);

COMMIT;

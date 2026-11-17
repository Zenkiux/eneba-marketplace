-- +goose Up
-- Account area: country for the login history, favourites (wishlist), and the payment method
-- label chosen on the demo payment page (shown in the orders table).
ALTER TABLE sessions ADD COLUMN country text NOT NULL DEFAULT '';

CREATE TABLE wishlist_items (
    user_id    uuid   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

ALTER TABLE payment_attempts ADD COLUMN method text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE payment_attempts DROP COLUMN method;
DROP TABLE wishlist_items;
ALTER TABLE sessions DROP COLUMN country;

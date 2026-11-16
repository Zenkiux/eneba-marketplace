-- +goose Up
-- Initial schema. Money is integer cents; all times are timestamptz.
-- See docs/architecture.md for the reasoning behind each table and constraint.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------- accounts
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name  text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash   bytea NOT NULL UNIQUE,          -- sha256(raw token); raw token only in the cookie
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,           -- absolute expiry
    user_agent   text NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- ---------------------------------------------------------------- catalog
CREATE TABLE platforms (
    id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL
);

CREATE TABLE regions (
    id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL
);

CREATE TABLE product_types (
    id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL
);

CREATE TABLE products (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug             text NOT NULL UNIQUE,
    title            text NOT NULL,
    description      text NOT NULL DEFAULT '',
    cover_url        text NOT NULL DEFAULT '',
    platform_id      smallint NOT NULL REFERENCES platforms(id),
    region_id        smallint NOT NULL REFERENCES regions(id),
    type_id          smallint NOT NULL REFERENCES product_types(id),
    release_date     date,
    developer        text NOT NULL DEFAULT '',
    publisher        text NOT NULL DEFAULT '',
    genres           text[] NOT NULL DEFAULT '{}',
    list_price_cents bigint NOT NULL CHECK (list_price_cents > 0),
    popularity       integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_title_trgm_idx ON products USING gin (lower(title) gin_trgm_ops);
CREATE INDEX products_platform_idx ON products(platform_id);
CREATE INDEX products_region_idx ON products(region_id);
CREATE INDEX products_type_idx ON products(type_id);
CREATE INDEX products_release_idx ON products(release_date);

CREATE TABLE sellers (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug         text NOT NULL UNIQUE,
    name         text NOT NULL,
    rating       numeric(4,2) NOT NULL CHECK (rating BETWEEN 0 AND 10),  -- synthetic demo data
    rating_count integer NOT NULL DEFAULT 0,
    verified     boolean NOT NULL DEFAULT false
);

CREATE TABLE offers (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  bigint NOT NULL REFERENCES products(id),
    seller_id   bigint NOT NULL REFERENCES sellers(id),
    price_cents bigint NOT NULL CHECK (price_cents > 0),
    currency    char(3) NOT NULL DEFAULT 'EUR',
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, seller_id)
);
CREATE INDEX offers_product_active_idx ON offers(product_id) WHERE active;

-- ---------------------------------------------------------------- orders
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'cancelled', 'expired');

CREATE TABLE orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id),
    status          order_status NOT NULL DEFAULT 'pending_payment',
    total_cents     bigint NOT NULL CHECK (total_cents > 0),
    currency        char(3) NOT NULL DEFAULT 'EUR',
    idempotency_key text NOT NULL,
    request_hash    bytea NOT NULL,             -- sha256 of the normalised request body
    expires_at      timestamptz NOT NULL,
    paid_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);
CREATE INDEX orders_user_created_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_pending_expiry_idx ON orders(expires_at) WHERE status = 'pending_payment';

CREATE TABLE order_items (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id         uuid NOT NULL REFERENCES orders(id),
    offer_id         bigint NOT NULL REFERENCES offers(id),
    product_id       bigint NOT NULL REFERENCES products(id),
    seller_id        bigint NOT NULL REFERENCES sellers(id),
    unit_price_cents bigint NOT NULL CHECK (unit_price_cents > 0),
    quantity         integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    title_snapshot   text NOT NULL,
    seller_snapshot  text NOT NULL,
    UNIQUE (order_id, offer_id)
);
CREATE INDEX order_items_offer_idx ON order_items(offer_id);

CREATE TYPE key_status AS ENUM ('available', 'reserved', 'sold');

-- One row per digital key. A key is linked to an order item exactly when it is reserved or sold.
CREATE TABLE offer_keys (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offer_id         bigint NOT NULL REFERENCES offers(id),
    code_ciphertext  bytea NOT NULL,             -- AES-256-GCM (nonce || ciphertext)
    code_fingerprint bytea NOT NULL UNIQUE,      -- HMAC-SHA256 of the plain code: blocks duplicate keys
    status           key_status NOT NULL DEFAULT 'available',
    order_item_id    bigint REFERENCES order_items(id),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK ((status = 'available') = (order_item_id IS NULL))
);
CREATE INDEX offer_keys_available_idx ON offer_keys(offer_id, id) WHERE status = 'available';
CREATE INDEX offer_keys_order_item_idx ON offer_keys(order_item_id) WHERE order_item_id IS NOT NULL;

CREATE TYPE payment_outcome AS ENUM ('succeeded', 'declined');

CREATE TABLE payment_attempts (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES orders(id),
    outcome         payment_outcome NOT NULL,
    idempotency_key text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, idempotency_key)
);
-- At most one successful payment per order.
CREATE UNIQUE INDEX payment_attempts_one_success_idx ON payment_attempts(order_id) WHERE outcome = 'succeeded';

-- ---------------------------------------------------------------- cart
CREATE TABLE cart_items (
    user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id bigint NOT NULL REFERENCES offers(id),
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, offer_id)
);

-- ---------------------------------------------------------------- homepage
-- The homepage layout and each block's content source live here, not in the frontend.
CREATE TABLE home_sections (
    id       smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key      text NOT NULL UNIQUE,
    type     text NOT NULL CHECK (type IN ('banner', 'category_strip', 'bestsellers', 'deals', 'new_releases', 'upcoming')),
    title    text NOT NULL DEFAULT '',
    position integer NOT NULL,
    enabled  boolean NOT NULL DEFAULT true,
    config   jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE banners (
    id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_id smallint NOT NULL REFERENCES home_sections(id) ON DELETE CASCADE,
    slot      text NOT NULL DEFAULT 'main' CHECK (slot IN ('main', 'side')),
    title     text NOT NULL,
    subtitle  text NOT NULL DEFAULT '',
    image_url text NOT NULL,
    cta_label text NOT NULL DEFAULT '',
    cta_href  text NOT NULL DEFAULT '',
    position  integer NOT NULL DEFAULT 0,
    starts_at timestamptz,
    ends_at   timestamptz
);

-- +goose Down
DROP TABLE banners, home_sections, cart_items, payment_attempts, offer_keys, order_items, orders,
    offers, sellers, products, product_types, regions, platforms, sessions, users;
DROP TYPE payment_outcome, key_status, order_status;

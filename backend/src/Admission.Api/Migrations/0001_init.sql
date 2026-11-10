-- 0001_init: classes and holds. Seat counts are derived from holds (never stored); see ASSUMPTIONS.md.

CREATE TABLE classes (
    id          varchar(22)  PRIMARY KEY,
    name        varchar(100) NOT NULL,
    total_seats integer      NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_classes_id_format   CHECK (id ~ '^c_[a-z2-7]{20}$'),
    CONSTRAINT ck_classes_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT ck_classes_total_seats CHECK (total_seats BETWEEN 1 AND 10000)
);

CREATE INDEX ix_classes_created_at ON classes (created_at, id);

CREATE TABLE holds (
    id           varchar(22) PRIMARY KEY,
    class_id     varchar(22) NOT NULL REFERENCES classes (id) ON DELETE RESTRICT,
    student_id   char(17)    NOT NULL,
    status       varchar(10) NOT NULL DEFAULT 'HELD',
    expires_at   timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz NULL,
    cancelled_at timestamptz NULL,
    expired_at   timestamptz NULL,
    CONSTRAINT ck_holds_id_format    CHECK (id ~ '^h_[a-z2-7]{20}$'),
    CONSTRAINT ck_holds_student_id   CHECK (student_id ~ '^[0-9]{17}$'),
    CONSTRAINT ck_holds_status       CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT ck_holds_expiry_order CHECK (expires_at > created_at),
    CONSTRAINT ck_holds_confirmed_at CHECK ((status = 'CONFIRMED') = (confirmed_at IS NOT NULL)),
    CONSTRAINT ck_holds_cancelled_at CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CONSTRAINT ck_holds_expired_at   CHECK ((status = 'EXPIRED')   = (expired_at   IS NOT NULL))
);

-- Seat counting per class (held + confirmed) inside the locked transaction.
CREATE INDEX ix_holds_class_status ON holds (class_id, status) INCLUDE (expires_at);

-- "One active application per student per class" enforced by the database as a backstop.
CREATE UNIQUE INDEX ux_holds_active_per_student_class
    ON holds (class_id, student_id)
    WHERE status IN ('HELD', 'CONFIRMED');

-- GET /me/holds
CREATE INDEX ix_holds_student_created ON holds (student_id, created_at DESC);

-- Background expiry sweeper.
CREATE INDEX ix_holds_held_expiry ON holds (expires_at) WHERE status = 'HELD';

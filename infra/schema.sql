-- Hackforge AI Student Loan System — Full Schema
-- Apply with: psql -U postgres -d hackforge -f infra/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name     TEXT NOT NULL,
    mobile        TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    dob           TEXT,
    password_hash TEXT NOT NULL,
    intent        TEXT DEFAULT 'loan' CHECK (intent IN ('loan','scholarship','both')),
    is_verified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    pan_hash         TEXT,
    aadhaar_hash     TEXT,
    income           NUMERIC,
    cibil_score      INTEGER,
    employment_type  TEXT,
    collateral_value NUMERIC,
    academic_score   NUMERIC,
    state            TEXT,
    gender           TEXT,
    category         TEXT,
    bank_account     TEXT,
    ifsc_code        TEXT,
    kyc_status       TEXT DEFAULT 'pending',
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    doc_type        TEXT NOT NULL,
    minio_path      TEXT,
    status          TEXT DEFAULT 'processing',
    doc_trust_score NUMERIC,
    tamper_flag     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    type            TEXT DEFAULT 'loan',
    status          TEXT DEFAULT 'submitted',
    pipeline_stages JSONB DEFAULT '{}',
    loan_amount     NUMERIC,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eligibility_scores (
    app_id            UUID PRIMARY KEY REFERENCES applications(id),
    academic          NUMERIC,
    financial         NUMERIC,
    pq                NUMERIC,
    doc_trust         NUMERIC,
    kyc_completeness  NUMERIC,
    composite         NUMERIC,
    band              TEXT,
    pq_override       BOOLEAN DEFAULT FALSE,
    fraud_flag        BOOLEAN DEFAULT FALSE,
    risk_band         TEXT DEFAULT 'MEDIUM',
    explanation       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS behavioral_responses (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id        UUID REFERENCES applications(id),
    pq_score      NUMERIC,
    fin_resp      NUMERIC,
    resilience    NUMERIC,
    goal_clarity  NUMERIC,
    risk_aware    NUMERIC,
    initiative    NUMERIC,
    social_cap    NUMERIC,
    question_hash TEXT,
    time_flags    JSONB DEFAULT '[]',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scholarships (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               TEXT NOT NULL,
    description        TEXT,
    amount             NUMERIC,
    category           TEXT,
    gender             TEXT DEFAULT 'all',
    state              TEXT,
    min_income         NUMERIC,
    max_income         NUMERIC,
    min_academic_score NUMERIC,
    deadline           DATE,
    provider           TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scholarship_matches (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id         UUID REFERENCES applications(id),
    scholarship_id UUID REFERENCES scholarships(id),
    match_score    NUMERIC,
    status         TEXT DEFAULT 'matched',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disbursal_schedule (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id       UUID REFERENCES applications(id),
    semester     INTEGER NOT NULL,
    amount       NUMERIC NOT NULL,
    planned_date DATE,
    actual_date  DATE,
    status       TEXT DEFAULT 'pending',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id     UUID,
    user_id    UUID,
    event_type TEXT NOT NULL,
    details    JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID,
    channel    TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    subject    TEXT,
    message    TEXT NOT NULL,
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grievances (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id      UUID,
    user_id     UUID,
    subject     TEXT,
    description TEXT,
    status      TEXT DEFAULT 'open',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_app_id ON audit_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_profiles_pan_hash ON profiles(pan_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_aadhaar_hash ON profiles(aadhaar_hash);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

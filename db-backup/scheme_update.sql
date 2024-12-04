CREATE TABLE IF NOT EXISTS forecast (
    id uuid NOT NULL CONSTRAINT forecasts_pkey PRIMARY KEY,
    name varchar(255) NOT NULL,
    created_time bigint NOT NULL,
    tenant_id uuid NOT NULL CONSTRAINT fk_forecasts_tenant_id REFERENCES tenant (id) ON DELETE CASCADE,
    device_id uuid NOT NULL CONSTRAINT fk_forecasts_entity_id REFERENCES device (id) ON DELETE CASCADE,
    attributes jsonb NOT NULL,
    active BOOLEAN DEFAULT FALSE
);
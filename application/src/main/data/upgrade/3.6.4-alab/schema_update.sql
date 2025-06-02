--
-- Copyright © 2016-2024 The Thingsboard Authors
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--

CREATE TABLE IF NOT EXISTS forecast (
    id uuid NOT NULL CONSTRAINT forecasts_pkey PRIMARY KEY,
    name varchar(255) NOT NULL,
    created_time bigint NOT NULL,
    tenant_id uuid NOT NULL CONSTRAINT fk_forecasts_tenant_id REFERENCES tenant (id) ON DELETE CASCADE,
    device_id uuid NOT NULL CONSTRAINT fk_forecasts_entity_id REFERENCES device (id) ON DELETE CASCADE,
    attributes jsonb NOT NULL,
    active BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS claim (
    id uuid NOT NULL CONSTRAINT claims_pkey PRIMARY KEY,
    -- body text NOT NULL,
    body varchar(255) NOT NULL,
    created_time bigint NOT NULL,
    tenant_id uuid NOT NULL CONSTRAINT fk_claims_tenant_id REFERENCES tenant (id) ON DELETE CASCADE,
    done BOOLEAN DEFAULT FALSE,
    name varchar(255) not null
);

ALTER TABLE claim
ADD COLUMN IF NOT EXISTS assignee_id uuid CONSTRAINT fk_claims_assignee_id REFERENCES tb_user(id);

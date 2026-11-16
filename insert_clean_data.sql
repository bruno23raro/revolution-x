-- integrations
INSERT INTO integrations (id, organization_id, provider, status, connection_mode) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'whatsapp', 'connected', 'official'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'whatsapp', 'connected', 'official')
ON CONFLICT DO NOTHING;

-- meta_integrations
INSERT INTO meta_integrations (id, organization_id, provider, phone_number_id, encrypted_access_token, status) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'whatsapp', 'phone_a', 'token_a', 'CONNECTED'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'whatsapp', 'phone_b', 'token_b', 'CONNECTED')
ON CONFLICT DO NOTHING;

-- webhook_events
INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash, openbsp_event_id) VALUES
('mev_a1', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'message', 'hash_a1', 'opbsp_a1'),
('mev_a2', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'message', 'hash_a2', 'opbsp_a2'),
('mev_b1', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', 'message', 'hash_b1', 'opbsp_b1')
ON CONFLICT DO NOTHING;

-- integration_events
INSERT INTO integration_events (integration_id, workspace_id, event_type) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'connection_success'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'credential_renewal'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'connection_success')
ON CONFLICT DO NOTHING;

-- crm_contacts
INSERT INTO crm_contacts (phone_number, name, organization_id, external_id) VALUES
('5511999990001', 'CRM Contact A1', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ext_a1'),
('5511999990002', 'CRM Contact A2', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ext_a2'),
('5511999990003', 'CRM Contact B1', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'ext_b1')
ON CONFLICT DO NOTHING;

-- inbound_messages
INSERT INTO inbound_messages (message_id, from_number, to_number, type, organization_id) VALUES
('msg_a1', '5511999990001', '5511888880001', 'text', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('msg_a2', '5511999990002', '5511888880001', 'text', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('msg_b1', '5511999990003', '5511888880001', 'text', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12')
ON CONFLICT DO NOTHING;

-- message_status
INSERT INTO message_status (message_id, status, organization_id) VALUES
('msg_a1', 'delivered', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('msg_a2', 'read', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('msg_b1', 'delivered', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12')
ON CONFLICT DO NOTHING;

-- Contact
INSERT INTO "Contact" ("id", "organizationId", "name", "email") VALUES
('c0eec999-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Contact A1', 'contact-a1@test.com'),
('c1eec999-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Contact A2', 'contact-a2@test.com'),
('c2eec999-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Contact B1', 'contact-b1@test.com')
ON CONFLICT DO NOTHING;
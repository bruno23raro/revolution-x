-- integrations
INSERT INTO integrations (id, organization_id, provider, status, connection_mode) VALUES
('i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'whatsapp', 'connected', 'official'),
('i1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'whatsapp', 'connected', 'official')
ON CONFLICT DO NOTHING;

-- meta_integrations
INSERT INTO meta_integrations (id, organization_id, provider, phone_number_id, encrypted_access_token, status) VALUES
('m0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'whatsapp', 'phone_a', 'token_a', 'CONNECTED'),
('m1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'i1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'whatsapp', 'phone_b', 'token_b', 'CONNECTED')
ON CONFLICT DO NOTHING;

-- webhook_events
INSERT INTO webhook_events (meta_event_id, integration_id, event_type, payload_hash, openbsp_event_id) VALUES
('mev_a1', 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'message', 'hash_a1', 'opbsp_a1'),
('mev_a2', 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'message', 'hash_a2', 'opbsp_a2'),
('mev_b1', 'm1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'message', 'hash_b1', 'opbsp_b1')
ON CONFLICT DO NOTHING;

-- integration_events
INSERT INTO integration_events (integration_id, workspace_id, event_type) VALUES
('i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'connection_success'),
('i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'credential_renewal'),
('i1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'connection_success')
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
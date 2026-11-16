-- Insert test organizations
INSERT INTO "Organization" ("id", "name", "slug", "status") VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Org A', 'org-a', 'active'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Org B', 'org-b', 'active')
ON CONFLICT DO NOTHING;

-- Insert test contacts
INSERT INTO "Contact" ("id", "organizationId", "name", "email") VALUES
('c0eec999-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Contact A1', 'contact-a1@test.com'),
('c1eec999-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Contact A2', 'contact-a2@test.com'),
('c2eec999-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Contact B1', 'contact-b1@test.com')
ON CONFLICT DO NOTHING;
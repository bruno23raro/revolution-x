insert into public."OrganizationMember" (id, "organizationId", "userId", role, "joinedAt")
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'a8fbf6d6-4342-42e5-8f1f-4805e154c522', 'admin', now());
select "userId", role, "organizationId" from public."OrganizationMember";
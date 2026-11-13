insert into public."User" (id, email) values ('a8fbf6d6-4342-42e5-8f1f-4805e154c522', 'admin+jkpuqe@revolutionx.local') on conflict (id) do nothing;
insert into public."OrganizationMember" (id, "organizationId", "userId", role, "joinedAt")
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'a8fbf6d6-4342-42e5-8f1f-4805e154c522', 'admin', now());
select u.email, m.role, m."organizationId" from public."User" u join public."OrganizationMember" m on m."userId" = u.id where u.id = 'a8fbf6d6-4342-42e5-8f1f-4805e154c522';
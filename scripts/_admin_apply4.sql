insert into public."User" (id, email, name, "passwordHash", "emailVerified", "createdAt", "updatedAt")
select u.id, u.email, 'Admin Dev', 'gotrue', true, now(), now()
from auth.users u where u.email = 'admin@revx.local'
on conflict (id) do nothing;

insert into public."OrganizationMember" (id, "organizationId", "userId", role, "joinedAt")
select gen_random_uuid(), '00000000-0000-0000-0000-000000000002', u.id, 'admin', now()
from auth.users u
where u.email = 'admin@revx.local'
  and not exists (select 1 from public."OrganizationMember" m where m."userId" = u.id);

select u.email, m.role, m."organizationId"
from public."User" u left join public."OrganizationMember" m on m."userId" = u.id
where u.email = 'admin@revx.local';
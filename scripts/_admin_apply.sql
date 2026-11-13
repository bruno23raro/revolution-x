update public."OrganizationMember" set role = 'admin' where "userId" = 'a8fbf6d6-4342-42e5-8f1f-4805e154c522';
insert into public."OrganizationMember" ("organizationId", "userId", role, "joinedAt")
select o.id, 'a8fbf6d6-4342-42e5-8f1f-4805e154c522', 'admin', now()
from public."Organization" o
where not exists (select 1 from public."OrganizationMember" m where m."userId" = 'a8fbf6d6-4342-42e5-8f1f-4805e154c522')
limit 1;
select "userId", role, "organizationId" from public."OrganizationMember" where "userId" = 'a8fbf6d6-4342-42e5-8f1f-4805e154c522';
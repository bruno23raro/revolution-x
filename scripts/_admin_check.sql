select role, count(*) from public."OrganizationMember" group by role;
select id, "userId", role, "organizationId" from public."OrganizationMember" where "userId" = 'a8fbf6d6-4342-42e5-8f1f-4805e154c522';
select id, name from public."Organization" order by id limit 5;
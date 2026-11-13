select column_name, data_type, is_nullable from information_schema.columns where table_name='User' order by ordinal_position;
select id, email from public."User" limit 5;
select id, email from auth.users order by created_at limit 5;
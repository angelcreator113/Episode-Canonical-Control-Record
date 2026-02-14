UPDATE episodes SET categories = '["Drama", "Action"]'::jsonb WHERE id = '138d175d-9729-44f0-b8c0-fcaa97e03265';
UPDATE episodes SET categories = '["Comedy", "Adventure"]'::jsonb WHERE id = 'e6352ca6-e05c-4fd4-897c-cd49c00b5f05';
UPDATE episodes SET categories = '["Thriller", "Mystery"]'::jsonb WHERE id = 'bde0b25c-a4bc-461b-a5f0-a093688d8270';
SELECT id, title, categories FROM episodes LIMIT 5;

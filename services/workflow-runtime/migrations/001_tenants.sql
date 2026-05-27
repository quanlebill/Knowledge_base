CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  slug varchar UNIQUE NOT NULL,
  plan_id smallint,
  data_residency varchar DEFAULT 'Asia-SE1',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  deleted_at timestamp
);

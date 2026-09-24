-- Split into its own migration: Postgres doesn't reliably allow using a
-- newly-added enum value in the same transaction it was added in.
alter type user_role add value 'merchant';

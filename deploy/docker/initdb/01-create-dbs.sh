# Connectly database init: one PostgreSQL instance, one database per service.
psql -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname = 'connectly_identity'" | grep -q 1 || psql -U "$POSTGRES_USER" -c "CREATE DATABASE connectly_identity;"
psql -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname = 'connectly_social'" | grep -q 1 || psql -U "$POSTGRES_USER" -c "CREATE DATABASE connectly_social;"
psql -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname = 'connectly_chat'" | grep -q 1 || psql -U "$POSTGRES_USER" -c "CREATE DATABASE connectly_chat;"
psql -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname = 'connectly_notification'" | grep -q 1 || psql -U "$POSTGRES_USER" -c "CREATE DATABASE connectly_notification;"

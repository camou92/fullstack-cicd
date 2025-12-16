# Base image PostgreSQL
FROM postgres:17

USER root

# Installer awscli via APT (compatible Ubuntu/Debian + PEP 668)
RUN apt-get update && \
    apt-get install -y \
        awscli \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dossier de travail pour les backups
WORKDIR /backup

# Entrypoint simple pour exécuter pg_dump + aws s3 cp
CMD ["bash"]

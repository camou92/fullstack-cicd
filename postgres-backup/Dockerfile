# Base image
FROM postgres:17

# Installer awscli
RUN apt-get update && \
    apt-get install -y python3-pip unzip && \
    pip3 install --no-cache-dir awscli && \
    rm -rf /var/lib/apt/lists/*

# Entrypoint pour backup
WORKDIR /backup

# Par défaut, on peut lancer bash pour exécuter le pg_dump et S3
CMD ["bash"]

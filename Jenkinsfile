pipeline {

    agent {
        docker {
           image 'camoudock/agent-jenkins-stack:V6'
           args '--user root -v /var/run/docker.sock:/var/run/docker.sock'
        }
    }

    environment {
        /* ========= REGISTRY ========= */
        DOCKER_REPO    = "192.168.122.48:5001"
        BACKEND_IMAGE  = "${DOCKER_REPO}/backend-app:latest"
        FRONTEND_IMAGE = "${DOCKER_REPO}/frontend-app:latest"
        BACKUP_IMAGE   = "${DOCKER_REPO}/postgres-backup:1.0.0"

        /* ========= POSTGRES ========= */
        POSTGRES_HOST = "postgres-sql-movie"
        POSTGRES_DB   = "movie_app"
        POSTGRES_USER = "username"
        POSTGRES_PASS = "password"

        /* ========= AWS ========= */
        S3_BUCKET  = "movie-postgres-backups"
        AWS_REGION = "eu-north-1"
    }

    options {
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    triggers {
        cron('H/5 * * * *') // test toutes les 5 minutes
    }

    stages {

        /* ================= INIT ================= */
        stage('Init Git Security') {
            steps {
                sh 'git config --global --add safe.directory "$WORKSPACE"'
            }
        }

        /* ================= CHECKOUT ================= */
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: scm.branches,
                    userRemoteConfigs: scm.userRemoteConfigs,
                    extensions: [[$class: 'CleanCheckout']]
                ])
                sh 'git log -1 --oneline'
            }
        }

        /* ================= BACKUP IMAGE ================= */
        stage('Build Backup Image') {
            when {
                anyOf {
                    changeset "postgres-backup/**"
                    triggeredBy "UserIdCause"
                }
            }
            steps {
                dir('postgres-backup') {
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'nexus-cred',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh '''
set -e
docker build -t ${BACKUP_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${BACKUP_IMAGE}
docker logout ${DOCKER_REPO}
'''
                    }
                }
            }
        }

        /* ================= BACKEND ================= */
        stage('Build Backend & Push Docker') {
            when {
                anyOf {
                    changeset "movieApi/**"
                    triggeredBy "UserIdCause"
                }
            }
            steps {
                dir('movieApi') {
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'nexus-cred',
                            usernameVariable: 'NEXUS_USER',
                            passwordVariable: 'NEXUS_PASS'
                        ),
                        usernamePassword(
                            credentialsId: 'nexus-cred',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh '''
set -e

# Maven build + déploiement
cat > settings.xml <<EOF
<settings>
  <servers>
    <server>
      <id>nexus</id>
      <username>${NEXUS_USER}</username>
      <password>${NEXUS_PASS}</password>
    </server>
  </servers>
</settings>
EOF

mvn clean deploy -DskipTests -s settings.xml

# Télécharger OTEL agent
curl -L -o opentelemetry-javaagent.jar \
https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Docker build & push
docker build -t ${BACKEND_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${BACKEND_IMAGE}
docker logout ${DOCKER_REPO}
'''
                    }
                }
            }
        }

        /* ================= FRONTEND ================= */
        stage('Build Frontend & Push Docker') {
            when {
                anyOf {
                    changeset "movieUi/**"
                    triggeredBy "UserIdCause"
                }
            }
            steps {
                dir('movieUi') {
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'nexus-cred',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh '''
set -e
npm ci
npm run build
docker build -t ${FRONTEND_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${FRONTEND_IMAGE}
docker logout ${DOCKER_REPO}
'''
                    }
                }
            }
        }

        /* ================= DEPLOY ================= */
        stage('Deploy Docker Compose') {
            when {
                anyOf {
                    changeset "movieApi/**"
                    changeset "movieUi/**"
                    changeset "docker-compose.yml"
                    triggeredBy "UserIdCause"
                }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
set -e
docker compose version
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker compose pull
docker compose up -d
docker logout ${DOCKER_REPO}
'''
                }
            }
        }

        /* ================= BACKUP POSTGRES ================= */
        stage('Backup PostgreSQL to S3') {
            when {
                anyOf {
                    triggeredBy 'TimerTrigger'
                    changeset "postgres-backup/**"
                }
            }
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-cred']
                ]) {
                    sh '''
set -e

LATEST=$(aws s3 ls s3://${S3_BUCKET}/ | sort | tail -n 1 | awk '{print $4}')
NEED_BACKUP=1

if [ ! -z "$LATEST" ]; then
  LATEST_TS=$(date -d "$(echo $LATEST | sed -E 's/.*([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}).*/\\1/')" +%s)
  NOW_TS=$(date +%s)
  DIFF=$((NOW_TS - LATEST_TS))
  [ $DIFF -lt 86400 ] && NEED_BACKUP=0
fi

if [ $NEED_BACKUP -eq 1 ]; then
  TS=$(date +%Y-%m-%d_%H-%M-%S)
  FILE=movie_app_$TS.sql

  # Backup via docker compose pour résoudre postgres
  docker compose run --rm \
    -e PGPASSWORD=${POSTGRES_PASS} \
    postgres-backup sh -c "
      pg_dump -h ${POSTGRES_HOST} -U ${POSTGRES_USER} ${POSTGRES_DB} > /tmp/$FILE &&
      aws s3 cp /tmp/$FILE s3://${S3_BUCKET}/$FILE
  "
else
  echo "Backup non nécessaire"
fi
'''
                }
            }
        }

    }

    post {
        success { echo "✅ PIPELINE COMPLET OK" }
        failure { echo "❌ PIPELINE EN ÉCHEC" }
        always { cleanWs() }
    }

}

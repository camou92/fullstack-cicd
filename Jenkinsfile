pipeline {

    agent {
        docker {
            image 'camoudock/agent-jenkins-stack:latest'
            args '--user root -v /var/run/docker.sock:/var/run/docker.sock'
        }
    }

    environment {
        /* ========= REGISTRY ========= */
        DOCKER_REPO    = "192.168.122.48:5001"
        BACKEND_IMAGE  = "${DOCKER_REPO}/backend-app:latest"
        FRONTEND_IMAGE = "${DOCKER_REPO}/frontend-app:latest"
        BACKUP_IMAGE   = "${DOCKER_REPO}/postgres-backup:1.0.0"

        /* ========= GIT ========= */
        GIT_APP_REPO = "https://github.com/camou92/fullstack-cicd.git"

        /* ========= POSTGRES ========= */
        POSTGRES_HOST = "postgres"
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
        cron('H 2 * * *')  // backup uniquement
    }

    stages {

        stage('Init Git Security') {
            steps {
                sh 'git config --global --add safe.directory "$WORKSPACE"'
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        /* ================= BACKUP IMAGE ================= */
        stage('Build Backup Image') {
            when { anyOf { changeset "postgres-backup/**"; triggeredBy "UserIdCause" } }
            steps {
                dir('postgres-backup') {
                    withCredentials([usernamePassword(credentialsId: 'nexus-cred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        timeout(time: 10, unit: 'MINUTES') {
                            sh '''
set -e
docker build --progress=plain -t ${BACKUP_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${BACKUP_IMAGE}
docker logout ${DOCKER_REPO}
'''
                        }
                    }
                }
            }
        }

        /* ================= BACKEND ================= */
        stage('Build Backend & Push Docker') {
            when { anyOf { changeset "movieApi/**"; triggeredBy "UserIdCause" } }
            steps {
                dir('movieApi') {
                    withCredentials([
                        usernamePassword(credentialsId: 'nexus-cred', usernameVariable: 'NEXUS_USER', passwordVariable: 'NEXUS_PASS'),
                        usernamePassword(credentialsId: 'nexus-cred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
                    ]) {
                        timeout(time: 20, unit: 'MINUTES') {
                            sh '''
set -e
# Maven build + deploy
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

# Télécharger OTEL agent avant docker build
curl -L -o opentelemetry-javaagent.jar https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Docker build multi-stage (cache par layer)
docker build --progress=plain -t ${BACKEND_IMAGE} --cache-from ${BACKEND_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${BACKEND_IMAGE}
docker logout ${DOCKER_REPO}
'''
                        }
                    }
                }
            }
        }

        /* ================= FRONTEND ================= */
        stage('Build Frontend & Push Docker') {
            when { anyOf { changeset "movieUi/**"; triggeredBy "UserIdCause" } }
            steps {
                dir('movieUi') {
                    withCredentials([usernamePassword(credentialsId: 'nexus-cred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        timeout(time: 15, unit: 'MINUTES') {
                            sh '''
set -e
npm ci
npm run build
docker build --progress=plain -t ${FRONTEND_IMAGE} --cache-from ${FRONTEND_IMAGE} .
echo "$DOCKER_PASS" | docker login ${DOCKER_REPO} -u "$DOCKER_USER" --password-stdin
docker push ${FRONTEND_IMAGE}
docker logout ${DOCKER_REPO}
'''
                        }
                    }
                }
            }
        }

        /* ================= DEPLOY ================= */
        stage('Deploy Docker Compose') {
            when { anyOf { changeset "movieApi/**"; changeset "movieUi/**"; changeset "docker-compose.yml"; triggeredBy "UserIdCause" } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'nexus-cred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
set -e
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
            when { anyOf { triggeredBy 'TimerTrigger'; changeset "postgres-backup/**" } }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-cred']]) {
                    timeout(time: 15, unit: 'MINUTES') {
                        sh '''
set -e

# Vérifier dernière sauvegarde sur S3
LATEST=$(aws s3 ls s3://${S3_BUCKET}/ | sort | tail -n 1 | awk '{print $4}')
NEED_BACKUP=1

if [ ! -z "$LATEST" ]; then
  LATEST_TS=$(date -d "$(echo $LATEST | sed -E 's/.*([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}).*/\\1/')" +%s)
  NOW_TS=$(date +%s)
  DIFF=$((NOW_TS - LATEST_TS))
  if [ $DIFF -lt 86400 ]; then
    echo "🟡 La dernière sauvegarde a moins de 24h, pas de backup nécessaire"
    NEED_BACKUP=0
  fi
fi

if [ $NEED_BACKUP -eq 1 ]; then
  echo "🔵 Lancement du backup PostgreSQL vers S3"
  TS=$(date +%Y-%m-%d_%H-%M-%S)
  FILE=movie_app_$TS.sql

  docker run --rm \
    --network spring-demo \
    -e PGPASSWORD=${POSTGRES_PASS} \
    -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
    -e AWS_DEFAULT_REGION=${AWS_REGION} \
    ${BACKUP_IMAGE} \
    sh -c "
      pg_dump -h ${POSTGRES_HOST} -U ${POSTGRES_USER} ${POSTGRES_DB} > /tmp/$FILE &&
      aws s3 cp /tmp/$FILE s3://${S3_BUCKET}/$FILE
    "
else
  echo "🟢 Backup non nécessaire"
fi
'''
                    }
                }
            }
        }

    }

    post {
        success { echo "✅ PIPELINE COMPLET OPTIMISÉ OK" }
        failure { echo "❌ PIPELINE COMPLET OPTIMISÉ EN ÉCHEC" }
        always { cleanWs() }
    }

}

pipeline {
    agent {
        docker {
            image 'camoudock/camoudock/jenkins-agent:latest'
            args '--user root -v /var/run/docker.sock:/var/run/docker.sock'
        }
    }

    environment {
        /* ========= REGISTRY ========= */
        DOCKER_REPO = "192.168.122.48:5001"
        BACKEND_IMAGE  = "${DOCKER_REPO}/backend-app:latest"
        FRONTEND_IMAGE = "${DOCKER_REPO}/frontend-app:latest"
        BACKUP_IMAGE   = "${DOCKER_REPO}/postgres-backup:1.0.0"

        /* ========= GIT ========= */
        GIT_APP_REPO = "https://github.com/camou92/fullstack-cicd.git"
        DOCKER_COMPOSE_DIR = "."

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
    }

    triggers {
        cron('H 2 * * *')
    }

    stages {

        /* ================= INIT (OBLIGATOIRE) ================= */
        stage('Init') {
            steps {
                echo "🚀 Pipeline démarré"
                sh 'git rev-parse --short HEAD || true'
            }
        }

        /* ================= CLEAN ================= */
        stage('Clean') {
            steps { cleanWs() }
        }

        /* ================= CHECKOUT ================= */
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[url: "${GIT_APP_REPO}"]]
                ])
            }
        }

        /* ================= BACKUP IMAGE ================= */
        stage('Build Backup Docker Image') {
            when {
                anyOf {
                    changeset "postgres-backup/**"
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('postgres-backup') {
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh '''
set -e
docker build -t ${BACKUP_IMAGE} .
echo "$DOCKER_PASS" | docker login 192.168.122.48:5001 -u "$DOCKER_USER" --password-stdin
docker push ${BACKUP_IMAGE}
docker logout 192.168.122.48:5001
'''
                    }
                }
            }
        }

        /* ================= BACKEND ================= */
        stage('Build Backend & Deploy Artifact') {
            when {
                anyOf {
                    changeset "movieApi/**"
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('movieApi') {
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'NEXUS_USER',
                        passwordVariable: 'NEXUS_PASS'
                    )]) {
                        sh '''
set -e
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
mvn clean package -DskipTests
mvn deploy -s settings.xml -DskipTests
'''
                    }
                }
            }
        }

        stage('Build & Push Backend Docker') {
            when {
                anyOf {
                    changeset "movieApi/**"
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('movieApi') {
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh '''
set -e
docker build -t ${BACKEND_IMAGE} .
echo "$DOCKER_PASS" | docker login 192.168.122.48:5001 -u "$DOCKER_USER" --password-stdin
docker push ${BACKEND_IMAGE}
docker logout 192.168.122.48:5001
'''
                    }
                }
            }
        }

        /* ================= FRONTEND ================= */
        stage('Build Frontend') {
            when {
                anyOf {
                    changeset "movieUi/**"
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('movieUi') {
                    sh '''
set -e
npm install
npm run build
'''
                }
            }
        }

        stage('Build & Push Frontend Docker') {
            when {
                anyOf {
                    changeset "movieUi/**"
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('movieUi') {
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh '''
set -e
docker build -t ${FRONTEND_IMAGE} .
echo "$DOCKER_PASS" | docker login 192.168.122.48:5001 -u "$DOCKER_USER" --password-stdin
docker push ${FRONTEND_IMAGE}
docker logout 192.168.122.48:5001
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
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
set -e
echo "$DOCKER_PASS" | docker login 192.168.122.48:5001 -u "$DOCKER_USER" --password-stdin
docker compose pull
docker compose up -d
docker logout 192.168.122.48:5001
'''
                }
            }
        }

        /* ================= BACKUP POSTGRES ================= */
        stage('Backup PostgreSQL to S3') {
            when { triggeredBy 'TimerTrigger' }
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-cred']
                ]) {
                    sh '''
set -e
TS=$(date +%Y-%m-%d_%H-%M-%S)
FILE=movie_app_$TS.sql

docker run --rm \
  --network spring-demo \
  -e PGPASSWORD=${POSTGRES_PASS} \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_DEFAULT_REGION=${AWS_REGION} \
  ${BACKUP_IMAGE} \
  bash -c "
    pg_dump -h ${POSTGRES_HOST} -U ${POSTGRES_USER} ${POSTGRES_DB} > /tmp/$FILE &&
    aws s3 cp /tmp/$FILE s3://${S3_BUCKET}/$FILE
  "
'''
                }
            }
        }
    }

    post {
        success {
            echo "✅ PIPELINE OK — build intelligent, déploiement maîtrisé, backup sécurisé"
        }
        failure {
            echo "❌ PIPELINE KO — vérifier les logs Jenkins"
        }
        always {
            cleanWs()
        }
    }
}

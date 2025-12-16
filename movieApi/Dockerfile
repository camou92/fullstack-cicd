FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY target/*.jar app.jar

# Copier l'agent OTEL téléchargé par Jenkins
COPY opentelemetry-javaagent.jar /opentelemetry-javaagent.jar

EXPOSE 8087

ENTRYPOINT ["java","-javaagent:/opentelemetry-javaagent.jar","-Dotel.exporter.otlp.endpoint=http://tempo:4318","-Dotel.exporter.otlp.protocol=http/protobuf","-Dotel.service.name=movie-back","-jar","app.jar"]

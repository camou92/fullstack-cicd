FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY target/*.jar app.jar

# Télécharger l'agent OTEL
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /opentelemetry-javaagent.jar

EXPOSE 8087

ENTRYPOINT ["java","-javaagent:/opentelemetry-javaagent.jar","-Dotel.exporter.otlp.endpoint=http://tempo:4318","-Dotel.exporter.otlp.protocol=http/protobuf","-Dotel.service.name=movie-back","-jar","app.jar"]

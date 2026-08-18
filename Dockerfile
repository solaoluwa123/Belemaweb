FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

ARG VITE_ENABLE_MOCK_AUTH=false
ENV VITE_ENABLE_MOCK_AUTH=$VITE_ENABLE_MOCK_AUTH

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM maven:3.9.9-eclipse-temurin-17 AS backend-build
WORKDIR /app

COPY spring-wrapper/pom.xml spring-wrapper/pom.xml
RUN mvn -f spring-wrapper/pom.xml -DskipTests dependency:go-offline

COPY spring-wrapper/src spring-wrapper/src
COPY --from=frontend-build /app/frontend/dist/ spring-wrapper/src/main/resources/static/

RUN mvn -f spring-wrapper/pom.xml -DskipTests clean package


FROM tomcat:10.1-jre17-temurin

RUN rm -rf /usr/local/tomcat/webapps/* \
    && groupadd --system tomcatapp \
    && useradd --system --gid tomcatapp --home-dir /usr/local/tomcat --shell /bin/false tomcatapp

COPY --from=backend-build /app/spring-wrapper/target/spring-wrapper-0.0.1-SNAPSHOT.war /usr/local/tomcat/webapps/ROOT.war

RUN chown -R tomcatapp:tomcatapp /usr/local/tomcat

USER tomcatapp

EXPOSE 8080

CMD ["catalina.sh", "run"]

# Spring Boot

## Core Principles
- Check `pom.xml` or `build.gradle` for the Spring Boot version before using features. Spring Boot 3.x requires Java 17+ and uses Jakarta EE namespaces (`jakarta.*` not `javax.*`).
- Follow the existing project's layered architecture: Controller -> Service -> Repository.
- Never inject `ApplicationContext` into a business service — use proper dependency injection.

## Dependency Injection
- Use constructor injection for all mandatory dependencies — never field injection (`@Autowired` on fields).
- Use `@Service`, `@Repository`, `@Controller`/`@RestController` stereotypes correctly.
- Mark services that must not be proxied with `final` — but understand Spring AOP implications.

## Data Access
- Use Spring Data JPA repositories for standard CRUD. Use `@Query` with JPQL for custom queries.
- Always use parameterized queries — never string concatenation in `@Query`.
- Enable lazy loading cautiously — understand the N+1 problem and use `@EntityGraph` or JPQL `JOIN FETCH` for eager loading specific relationships.

## Security (Spring Security)
- Always configure `SecurityFilterChain` explicitly — never rely on Spring Security defaults in production.
- Use `@PreAuthorize` for method-level security with SpEL expressions.
- Use `BCryptPasswordEncoder` for password hashing.
- Disable CSRF only for stateless REST APIs — never for session-based apps.

## Configuration
- Use `application.yml` or `application.properties` for configuration. Use profiles (`@Profile`) for environment-specific beans.
- Never hardcode secrets in configuration files. Use environment variables or Spring Cloud Config / Vault.

## Verification Checklist
- [ ] Is Spring Boot version confirmed before using features?
- [ ] Is constructor injection used for all mandatory dependencies?
- [ ] Are all JPA queries parameterized?
- [ ] Is `BCryptPasswordEncoder` used for passwords?
- [ ] Are secrets loaded from environment variables — not hardcoded in config files?

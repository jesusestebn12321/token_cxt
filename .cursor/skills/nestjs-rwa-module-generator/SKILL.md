---
name: nestjs-rwa-module-generator
description: >-
  Genera la arquitectura completa y lista para producción de un módulo de NestJS
  enfocado en operaciones financieras o tokenización (RWA). Usar cuando el usuario
  solicite crear un nuevo módulo, controlador o servicio que involucre manejo de
  saldos, tokens o datos críticos del backoffice.
---

# nestjs-rwa-module-generator

- **Descripción:** Genera la arquitectura completa y lista para producción de un módulo de NestJS enfocado en operaciones financieras o tokenización (RWA).
- **Cuándo activarla:** Cuando el usuario solicite crear un nuevo módulo, controlador o servicio que involucre manejo de saldos, tokens o datos críticos del backoffice.

## 1. Reglas Técnicas Obligatorias

- Todo payload de entrada debe usar clases DTO con decoradores de `class-validator`.
- Prohibido el uso de `any`. Tipado estricto en el 100% de los métodos.
- Las operaciones financieras o de mutación de estados deben incluir manejo de transacciones con aislamiento y locking.

## 2. Pasos de Ejecución

1. **Definir DTOs:** Crear clases con validaciones estrictas y decoradores de Swagger (`@ApiProperty`).
2. **Implementar Servicio:** Escribir la lógica de negocio pura inyectando el ORM correspondiente y aplicando transacciones atómicas si aplica.
3. **Configurar Controlador:** Exponer los endpoints con sus respectivos verbos HTTP, Guards de autenticación JWT, decoradores de Roles (RBAC) y documentación Swagger.
4. **Registrar en el Módulo:** Conectar el controlador y el servicio dentro del `@Module()`.

## 3. Formato de Respuesta Esperado

Devolver siempre los archivos de código completos, limpios y separados por bloques con su respectiva ruta de archivo sugerida (ej. `src/modules/tokens/tokens.service.ts`), sin comentarios de código incompleto.

Envolver esa entrega en las 4 fases y los 3 bloques de `.cursor/rules/nestjs-agent-workflow.mdc`.

## Documentación y Referencias

- Consultar siempre la documentación oficial de NestJS para validación de DTOs, Guards, Microservices (RabbitMQ/gRPC) y TypeORM/Prisma.
- URL Base de Consulta: https://docs.nestjs.com

Antes de escribir DTOs, guards, pipes o transporte entre servicios, contrastar la API con la doc oficial. En este repositorio la persistencia sigue siendo Mongoose; las páginas de TypeORM/Prisma sirven como referencia de transacciones y patrones, no como stack a introducir.

## Convenciones de este repositorio

Persistencia: Mongoose. JWT, roles y permisos ya son guards globales (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` en `src/app.module.ts`). No repetir `JwtAuthGuard` en el controlador.

Antes de escribir, leer un módulo vecino (`src/modules/wallets/` o `src/modules/users/`) y copiar su forma.

### Árbol de un módulo nuevo

```
src/modules/<nombre>/
  <nombre>.module.ts
  <nombre>.controller.ts
  <nombre>.service.ts
  dto/<accion>.dto.ts
  schemas/<entidad>.schema.ts
  enums/<estado>.enum.ts
```

Registrar el módulo en el array `imports` de `src/app.module.ts`. Añadir el tag Swagger en `src/main.ts` solo si el documento ya lista tags por módulo.

### DTO

Importes y cantidades como `string` decimal, nunca `number`. Mismo patrón que `LockFundsDto`: `@Matches(/^(?!0+(\.0+)?$)\d{1,16}(\.\d{1,18})?$/)`. En el schema, montos con `DecimalProp` de `src/common/database/schema-options.ts`. Schemas con `buildSchemaOptions('<coleccion>')`.

### Servicio

Inyectar `@InjectModel` y, si hay mutación de saldo o estado crítico, `@InjectConnection()`. Envolver la mutación en `runInTransaction` de `src/common/database/transaction.util.ts` y pasar la `ClientSession` a cada query. El débito de saldo sigue el patrón de `WalletsService.lockFunds`: un `findOneAndUpdate` condicional (`$gte` sobre el bucket) dentro de la sesión; si no hay documento, `ConflictException`. Asientos de ledger con `LedgerService.record(session, ...)` en la misma sesión. Ledger y auditoría append-only: `makeImmutable()`.

Excepciones de Nest (`NotFoundException`, `ConflictException`, `BadRequestException`). Ids con `ParseObjectIdPipe` en el controller y `oid()` de `src/common/database/object-id.ts` en el servicio.

### Controlador

```typescript
@ApiTags('Tokens')
@ApiBearerAuth('access-token')
@Controller('tokens')
export class TokensController {
  @Post()
  @Permissions(Permission.TOKENS_WRITE)
  @UseGuards(TwoFactorGuard)
  @AuditAction('TOKEN_CREATED', 'token')
  create(@Body() dto: CreateTokenDto, @CurrentUser('id') adminId: string) {
    return this.tokensService.create(dto, adminId);
  }
}
```

- Lectura: `@Permissions` del enum `src/common/enums/permission.enum.ts`. Si el permiso no existe, agregarlo al enum y a los roles que deban tenerlo.
- Mutación de saldo, estado o dato crítico: además `@UseGuards(TwoFactorGuard)` y `@AuditAction('<ACCION>', '<recurso>')`.
- Listados: `PaginationQueryDto` y tipo de retorno `Paginated<T>`.
- Params de id: `@Param('id', ParseObjectIdPipe)`.

### Cierre

Escribir los archivos en el repo. Sin `any`, sin `TODO`, sin placeholders. Comprobar que el módulo compila con los imports reales del proyecto.

## Contexto
<!-- Link al issue y/o spec con criterios de aceptación. Si no existe spec, este PR no debería abrirse todavía. -->
Issue/Spec: #___

## ¿Qué cambia?
<!-- Descripción breve y técnica. Qué dominio/módulo toca (ej. scheduling, auth, notifications). -->

## ¿Por qué? (si aplica)
<!-- Solo si esto involucra una decisión de negocio o técnica no obvia. Si la decisión es relevante a futuro, agregar un ADR corto en /docs/adr y enlazarlo aquí. -->
ADR relacionado: (enlace o "N/A")

## Cambios en base de datos
- [ ] Este PR incluye migraciones
- [ ] Las migraciones fueron probadas localmente (up y down)
- [ ] N/A

## Pruebas realizadas
- [ ] Camino feliz probado
- [ ] Al menos un caso borde probado (ej. datos inválidos, concurrencia, permisos incorrectos, límites como "0 franjas disponibles")
- [ ] Pruebas automatizadas agregadas/actualizadas (si el estándar del equipo lo requiere para este tipo de lógica)

Describe brevemente los casos probados:
-

## Contrato de API (si aplica)
- [ ] La documentación de la API (endpoint, request/response, códigos de error) fue actualizada
- [ ] Los tipos/interfaces compartidos con frontend fueron actualizados
- [ ] N/A

## Checklist de estándares
- [ ] Sigue la separación de responsabilidades por dominio/módulo ya definida
- [ ] Manejo de errores centralizado (no try/catch sueltos sin propósito)
- [ ] No hay código muerto, `console.log`/`print` de debug, ni comentarios de "TODO" sin issue asociado
- [ ] Se revisó si ya existía una función/utilidad reutilizable antes de crear una nueva

## ¿Esto coincide con la spec original?
- [ ] Sí, se verificó explícitamente contra los criterios de aceptación del issue
- [ ] Hubo cambios respecto a la spec original → se actualizó el documento/issue correspondiente

## Reviewer
- [ ] Persona distinta a quien implementó revisó este PR

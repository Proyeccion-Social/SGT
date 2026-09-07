---

name: Backend Spec

about: Crear una especificación para tareas de backend

title: "[Backend] "

labels: ["backend"]

assignees: []

---



## Título



## Contexto / Problema

<!-- ¿Qué está mal, o qué falta? Si es un bug, describe el comportamiento actual. -->



## Objetivo / Resultado esperado

<!-- Una o dos frases: qué debe pasar cuando esto esté resuelto. -->



## Alcance

**Incluye:**

-



**No incluye (fuera de alcance):**

-



## Reglas de negocio relevantes

<!-- Explícitas, aunque parezcan obvias. Esta sección existe porque la mayoría de bugs vinieron de reglas que solo alguien del equipo conocía. -->

-



## Criterios de aceptación

<!-- Formato Dado/Cuando/Entonces. Todos deben ser verificables por otra persona sin preguntar. -->

1. Dado ___, cuando ___, entonces ___.

2.



## Contrato de API (si aplica)



| Método | Endpoint | Request | Response (éxito) | Errores esperados |

| --- | --- | --- | --- | --- |

| | | | | |



## Casos borde a considerar

<!-- Mínimo uno. Ej: datos inválidos, permisos incorrectos, concurrencia, límites. -->

-



## Dependencias

<!-- Otros módulos, servicios externos, o si depende de que frontend tenga algo listo primero. -->

- N/A



## Cambios en base de datos (si aplica)

- [ ] Requiere migración

- [ ] N/A



## Prioridad / Severidad

- [ ] 🔴 Bloqueante

- [ ] 🟠 Fricción

- [ ] 🟡 Mejora / idea



## Referencias

<!-- Link a documento de contexto de producto, ADR relacionado, issue relacionado. -->

-



---



# ✅ Definition of Done — Backend



Una tarea de backend está **Done** solo si cumple todo lo siguiente:



- [ ] El código cumple con los criterios de aceptación de la spec/issue original (verificado explícitamente, no asumido).

- [ ] Se probó el camino feliz **y** al menos un caso borde relevante (dato inválido, permisos incorrectos, concurrencia, límites).

- [ ] El manejo de errores sigue el patrón centralizado del proyecto, no un `try/catch` aislado.

- [ ] Si se tocó la base de datos: las migraciones fueron probadas (up/down) y no afectan datos existentes de forma destructiva sin aviso explícito.

- [ ] Si se expuso o modificó un endpoint: la documentación de la API está actualizada y los tipos compartidos con frontend también.

- [ ] Si se descubrió o cambió una regla de negocio durante la implementación: quedó documentada en el documento de contexto de producto, no solo en la cabeza de quien la implementó.

- [ ] Si se tomó una decisión técnica no trivial (arquitectura, elección de librería, separación de módulos, etc.), quedó registrada como un ADR corto (contexto → opciones consideradas → decisión → por qué) y enlazada directamente desde este issue.

- [ ] El Pull Request fue revisado por una persona distinta a quien implementó.

- [ ] No quedó código muerto, logs de depuración ni `TODO` sin un issue asociado.



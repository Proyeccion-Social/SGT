---

name: Frontend Spec

about: Crear una especificación para tareas de frontend

title: "[Frontend] "

labels: ["frontend"]

assignees: []

---



## Título



## Contexto / Problema

<!-- ¿Qué está mal, o qué falta? Si es un bug, describe el comportamiento actual (idealmente con captura). -->



## Objetivo / Resultado esperado

<!-- Una o dos frases: qué debe pasar cuando esto esté resuelto. -->



## Alcance



**Incluye:**

-



**No incluye (fuera de alcance):**

-



## Diseño de referencia



Figma:



<!-- Debe incluir versión Desktop y Mobile. Si el diseño aún no tiene versión mobile, este issue no debería empezar a programarse. -->



## Reglas de negocio relevantes



<!-- Ej: qué puede/no puede hacer cada rol en esta pantalla, restricciones de datos, etc. -->



-



## Estados a contemplar



- [ ] Hover / Focus

- [ ] Disabled

- [ ] Loading

- [ ] Error

- [ ] Vacío (Empty State)

- [ ] Éxito

- [ ] N/A (justificar por qué)



## Criterios de aceptación



<!-- Formato Dado/Cuando/Entonces. Todos deben ser verificables por otra persona sin preguntar. -->



1. Dado ___, cuando ___, entonces ___.

2.



## Casos borde a considerar



<!-- Ej: texto muy largo, lista vacía, sin conexión, permisos de rol distinto. -->



-



## Dependencias



<!-- ¿Necesita un endpoint que no existe aún? ¿Depende de otro componente en desarrollo? -->



- N/A



## Prioridad / Severidad



- [ ] 🔴 Bloqueante

- [ ] 🟠 Fricción

- [ ] 🟡 Mejora / idea



## Referencias



<!-- Link al documento de contexto de producto, Design System, issue relacionado, ADR, etc. -->



-



---



# ✅ Definition of Done — Frontend



Una tarea de frontend está **Done** solo si cumple todo lo siguiente:



- [ ] La implementación coincide con el diseño de Figma, verificado visualmente lado a lado (fidelidad), no solo "se ve parecido".

- [ ] Funciona y se ve correctamente en **Desktop y Mobile** (no se aprueba solo con la versión desktop).

- [ ] Todos los estados relevantes del componente están implementados (hover, focus, disabled, loading, error, éxito y vacío), no solo el estado "feliz".

- [ ] Usa los tokens del Design System (colores, tipografía, espaciados); no hay valores hardcodeados ni estilos inline sin justificación.

- [ ] Se verificó que no existía ya un componente o patrón reutilizable antes de crear uno nuevo.

- [ ] Se probó con datos reales de la API (no solo con datos mock), incluyendo al menos un caso borde (lista vacía, texto largo, error de red).

- [ ] Si se descubrió una inconsistencia con lo documentado (por ejemplo, una regla de negocio no reflejada en el diseño), se notificó y se actualizó la fuente correspondiente.

- [ ] Si se tomó una decisión técnica no trivial (patrón de manejo de estado, estrategia de estilos, elección de librería, etc.), quedó registrada como un ADR corto (contexto → opciones consideradas → decisión → por qué) y enlazada directamente desde este issue.

- [ ] El Pull Request fue revisado por una persona distinta a quien implementó, incluyendo la revisión de fidelidad visual.
 

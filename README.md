# Café Claro · Pedidos y pruebas E2E

Aplicación de cafetería con frontend, API y persistencia real en SQLite. Permite consultar precios y disponibilidad, agregar productos, modificar cantidades, quitar artículos y confirmar una orden con un identificador consultable después de recargar.

## Requisitos y arranque

- Node.js **24 LTS** y npm (ver `.nvmrc`). SQLite viene integrado en Node; no se instala un servidor de base de datos.
- Google Chrome para `npm run test:e2e`. Cypress también permite Electron mediante `npx cypress run --browser electron`.
- Internet solo para instalar paquetes y para GitHub Actions. La aplicación y las pruebas no consultan servicios externos.

```bash
npm ci
npm start
```

Abrir **http://127.0.0.1:3000**. El catálogo se crea al iniciar una base de datos vacía. Precios en quetzales (GTQ): latte Q 24.00, americano Q 18.00, croissant Q 16.00 y chocolate Q 22.00 (agotado). La confirmación es para recoger y pagar en la cafetería; no procesa pagos.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm start` | Inicia la app normal; persiste en `data/cafe.sqlite`. |
| `npm run seed` | Restablece la base normal: borra pedidos y restaura el catálogo. |
| `npm run typecheck` | Valida la configuración y los tests TypeScript. |
| `npm run test:api` | Verifica validaciones, transacciones, persistencia y protección del reset. |
| `npm run test:e2e` | Levanta la app de pruebas, espera `/api/health`, ejecuta Cypress en Chrome y cierra el servidor. |
| `npm run start:test` | Inicia la app con `data/test.sqlite` y API de reinicio. |
| `npm run cy:open` | Abre Cypress interactivo; requiere `start:test` en otra terminal. |

Para ejecutar un recorrido solo, iniciar `npm run start:test` y, en otra terminal:

```bash
npx cypress run --browser chrome --spec cypress/e2e/03-fallo-controlado.cy.ts
```

No ejecutar dos servidores en el mismo puerto ni suites concurrentes contra la misma base de prueba. Para trabajos paralelos usar un archivo SQLite y un puerto propios por worker.

## Arquitectura

```text
Navegador: HTML + CSS + JavaScript (public/)
    │ fetch JSON, mismo origen
    ▼
API Express (server/app.js)
    │ transacciones síncronas, consultas parametrizadas
    ▼
SQLite en disco (data/cafe.sqlite o data/test.sqlite)
```

El frontend tiene nombres accesibles, mensajes con `role="alert"` y confirmación con `role="status"`. Los controles se bloquean mientras se confirma para evitar doble clic. La API valida los productos y cantidades y calcula el precio con su propio catálogo: no confía en totales enviados por el navegador. Los importes se guardan como enteros en centavos. La inserción de la orden y la actualización de existencias ocurren en una transacción; un error no deja una compra parcial.

La orden guarda una copia del nombre, precio, cantidad y subtotal de cada línea. Su UUID se devuelve en el POST y se consulta mediante GET. El enlace `/?order=CAF-...` recupera esa orden desde SQLite; el carrito es temporal en memoria. No hay cuentas, pago electrónico ni entrega a domicilio. Es una aplicación de evaluación local, no un sistema de pagos para producción.

| Método y ruta | Función |
| --- | --- |
| `GET /api/health` | Disponibilidad del servidor. |
| `GET /api/products` | Catálogo y stock actual. |
| `POST /api/orders` | Crea una orden: `{ "items": [{ "productId": "latte", "quantity": 2 }] }`. |
| `GET /api/orders/:id` | Recupera una orden persistida. |
| `POST /api/test/reset` | Solo en modo de prueba: limpia y reconstruye datos. |

Respuestas del POST: `201` creada, `400` solicitud inválida, `409` existencias insuficientes. Cantidades: enteros de 1 a 10 por producto; no se aceptan productos duplicados ni carrito vacío.

## Datos independientes y controlables

`cypress/support/e2e.ts` ejecuta `POST /api/test/reset` en **beforeEach**, antes de visitar la interfaz. Cada prueba comienza con 12 lattes, 15 americanos, 8 croissants, 0 chocolates y ninguna orden. No depende de la prueba anterior, de un identificador fijo ni de una limpieza posterior que pueda no ejecutarse al fallar.

El endpoint solo se registra cuando **NODE_ENV=test y ENABLE_TEST_API=true**. `.env.test` contiene únicamente configuración pública local, no secretos. `npm start` no carga ese archivo. La base de pruebas está separada de la base normal y ambas se excluyen de Git. Para reiniciar explícitamente la base de pruebas desde consola:

```bash
node --env-file=.env.test scripts/seed.js
```

## Recorridos Cypress con TypeScript

| Archivo | Preparación y aserciones |
| --- | --- |
| `01-pedido-exitoso.cy.ts` | Agrega 2 lattes y 1 croissant. Comprueba Q 64.00, cuerpo del POST, respuesta 201, UUID, lectura posterior por API, stock y recuperación después de recargar. |
| `02-validacion.cy.ts` | Intenta confirmar vacío y con 0, -1, 1.5 y 11 unidades. Comprueba mensaje y **cero solicitudes POST**; verifica también quitar un producto. |
| `03-fallo-controlado.cy.ts` | Selecciona 2 croissants; otro cliente compra 7 de los 8 mediante `cy.request`. La UI recibe un **409 real**, conserva el pedido y permite cambiar a 1. El reintento devuelve 201 y Q 16.00 persistidos. |

`cy.intercept('POST', '/api/orders').as('createOrder')` observa el tráfico real. `cy.wait('@createOrder')` sincroniza la prueba con esa respuesta y permite validar solicitud y respuesta. En validación, `cy.get('@createOrder.all').should('have.length', 0)` demuestra que la acción no generó un POST, después de observar el mensaje de validación síncrona. No usamos demoras numéricas ni stubs de la API. La compra concurrente de `cy.request` no pertenece al navegador y no es capturada por ese intercept.

Las consultas principales usan roles y nombres accesibles (`findByRole`). Los identificadores y totales, que no son controles, usan `data-cy`. `testIsolation: true` limpia el estado del navegador. Las aserciones reintentables y los alias esperan condiciones observables. `retries: 0` evita esconder fallos con reintentos de toda la prueba.

Las pruebas de API complementan E2E: comprueban que el servidor rechaza entradas inválidas, ignora precios manipulados, no escribe parcialmente si falta stock y permite leer la orden desde otra conexión SQLite.

## Integración continua y evidencia

El workflow [Cypress E2E](../../actions/workflows/e2e.yml) se ejecuta al enviar cambios a `main`, en pull requests y manualmente. Instala con `npm ci`, revisa TypeScript, ejecuta las pruebas de API y levanta el servidor para los tres recorridos en Chrome.

Se habilitan video y capturas automáticas ante fallo. También se toman capturas explícitas de los estados relevantes. `actions/upload-artifact` usa `if: always()` para conservar `cypress/screenshots/` y `cypress/videos/`, incluso si falla una prueba, durante 14 días. Descargar el ZIP desde **Actions → ejecución → Artifacts**. Los videos automáticos de Cypress son evidencia técnica; no son el video de exposición. El PDF, la grabación de pantalla y el guion de la exposición se entregan aparte y no se versionan.

## Dependencias reales y simuladas

- **Reales:** frontend, Express, SQLite, peticiones HTTP, validación, transacción y persistencia. Recursos gráficos hechos con CSS/SVG local, tipografías del sistema.
- **Controlados:** el catálogo se restablece antes de cada prueba; una segunda compra genera determinísticamente falta de stock.
- **Simuladas:** ninguna respuesta de red. No hay pagos ni integraciones de terceros.

## Cuándo elegir otra herramienta

| Herramienta | Cuándo la elegiría |
| --- | --- |
| **Cypress** | Para este reto: recorridos reproducibles, inspección interactiva de comandos y aserciones sobre la red. Es la única suite E2E implementada. |
| **Playwright** | Cuando el requisito incluya probar Chromium, Firefox y WebKit o varios contextos/pestañas. Su espera automática ayuda a sincronizar acciones. |
| **Agent Browser** | Para exploración y automatización de navegación dirigida por agentes desde CLI. Lo usaría como apoyo para investigar la interfaz; convertiría los hallazgos en aserciones deterministas para la regresión. |

Documentación: [intercept y alias](https://docs.cypress.io/api/commands/intercept), [aislamiento de Cypress](https://docs.cypress.io/app/core-concepts/test-isolation), [navegadores de Playwright](https://playwright.dev/docs/browsers), [espera automática de Playwright](https://playwright.dev/docs/actionability), [Agent Browser](https://github.com/vercel-labs/agent-browser).

## Uso de inteligencia artificial

Se utilizó **OpenAI Codex** para implementar la aplicación, proponer y escribir recorridos, revisar selectores, analizar fallos de ejecución y preparar documentación y material de entrega. Las sugerencias se convirtieron en código y aserciones explícitas, con validación mediante TypeScript, API y Cypress. No se utilizan prompts de IA durante las pruebas ni se envían credenciales o datos sensibles al repositorio.

Antes de presentar, el estudiante debe revisar cada prueba y poder explicar: qué reinicia `beforeEach`, por qué 2 × Q 24 + Q 16 = Q 64, qué observa el alias, por qué la compra concurrente provoca 409, cómo se comprueba la persistencia y por qué no hacen falta esperas numéricas. La asistencia de IA no sustituye esa revisión personal.

# Odissey · Patrimonio privado

Plataforma web local para visualizar y administrar tu patrimonio personal: vestimenta, accesorios,
colección de relojes, yates, vehículos, casas, empresas, negocios digitales y fuentes de ingreso.

Se ejecuta en tu navegador mediante `localhost`. **Todos los datos se guardan en tu dispositivo**
(IndexedDB): no hay servidor de base de datos ni nube.

## Requisitos

- Node.js 20 o superior (probado con Node 24).
- Python 3.10 o superior (solo para el backend opcional de procesamiento de imágenes, en fases posteriores).

## Instalación

```bash
npm run setup
```

Instala las dependencias del frontend y, cuando exista, crea el entorno virtual del backend Python.

## Ejecución (un solo comando)

```bash
npm run dev:all
```

- Inicia el frontend en http://127.0.0.1:5173 y abre el navegador.
- Inicia el backend Python en http://127.0.0.1:8765 si está instalado. Si no lo está, lo indica y el frontend sigue funcionando.
- Muestra los registros de ambos servicios con prefijos `[WEB]` y `[API]`.
- `Ctrl + C` detiene ambos procesos.

## Otros comandos

| Comando | Descripción |
|---|---|
| `npm test` | Pruebas unitarias e integración (IndexedDB en memoria; nunca usan tus datos reales) |
| `npm run setup:e2e` | Descarga Chromium para las pruebas en navegador (una sola vez) |
| `npm run test:e2e` | Pruebas en un navegador real con un perfil vacío y temporal |
| `npm run build` | Compilación de producción en `frontend/dist` |
| `npm run preview` | Sirve la compilación de producción en http://127.0.0.1:4173 |

## Tus datos

- Se guardan en IndexedDB **de este navegador y este perfil**. Si borras los datos del sitio, cambias de
  navegador o de perfil, no estarán disponibles.
- Crea copias de seguridad desde **Configuración → Datos y respaldos**. El archivo `.zip` incluye registros,
  fotografías originales, miniaturas, modelos 3D y composiciones, y sirve para trasladar todo a otro dispositivo.
- El servidor de desarrollo solo escucha en `127.0.0.1`; no es accesible desde la red.

Consulta `DOCUMENTACION_PROYECTO_PATRIMONIO.txt` (arquitectura y estado de cada fase) y
`DOCUMENTACION_MEJORAS_CRUD_DASHBOARD_Y_TEMAS.txt` (CRUD, temas, animaciones, dashboard y pruebas de la versión 0.3.0).

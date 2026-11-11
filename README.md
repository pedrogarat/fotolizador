# Fotolizador (por Pedro Garat)

Aplicación web 100% cliente (sin backend ni bases de datos externas) para maquetar fotografías en cuadrículas configurables siguiendo la estructura de `PLANTILLA.docx` y exportarlas en **DOCX** o **PDF** con redimensionado inteligente en el navegador.

## Funcionalidades

- **Carga de fotos**: Arrastra y suelta o selecciona mediante el cuadro de diálogo tradicional.
- **Miniaturas con metadatos EXIF**: Extrae la fecha de captura automáticamente, permite rotar 90°, reordenar manualmente arrastrando y editar pies de foto individuales.
- **Ordenación y agrupación**: Ordena por fecha de captura, fecha de modificación, nombre (orden natural), tamaño o manualmente (ascendente/descendente), y agrupa por mes, año, prefijo o inicial del nombre.
- **Título y pie de página**: Personaliza el título del encabezado (con línea inferior como en `PLANTILLA.docx`) y el formato de numeración (`Páxina X de Y` / `Página X de Y`).
- **Pie de foto flexible**: Ocultable o configurable (fecha de captura `Fecha: dd/mm/aa`, fecha de modificación, nombre o plantilla personalizada `{fecha}`, `{hora}`, `{nombre}`, `{indice}`).
- **Cuadrícula (Grid) adaptable**: Por defecto `2 × 3`, ajustable de `1` a `6` columnas y filas, en A4 vertical u horizontal; las fotos se escalan manteniendo su proporción.
- **Redimensionado en el navegador**: Ajusta la resolución máxima y calidad JPEG antes de exportar para reducir drásticamente el peso del DOCX y PDF.
- **Persistencia local**: Fotos almacenadas en `IndexedDB` y configuración en `localStorage` del navegador.

## Desarrollo local

```bash
npm install
npm run dev
```

## Publicación en GitHub Pages

El repositorio incluye el flujo [.github/workflows/deploy.yml](.github/workflows/deploy.yml) y `base: './'` en [vite.config.ts](vite.config.ts).

1. Sube el proyecto a tu repositorio en GitHub (rama `main`).
2. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
3. Cada push a `main` compilará y publicará la web automáticamente.


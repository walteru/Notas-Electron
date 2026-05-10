# Notas Electron

App de escritorio en **Electron** para gestionar notas Markdown organizadas por proyectos, con interfaz minimalista de tema oscuro y navegación tipo vim.

Cada proyecto es un archivo `.md` dentro de la carpeta `proyectos/`, lo que hace que las notas sean **portables, versionables con git y editables con cualquier editor externo**.

## Características

- Lista de proyectos en sidebar, ordenada alfabéticamente.
- Editor de texto plano con visor de líneas numeradas.
- Búsqueda global a través de todas las notas (con número de línea).
- Atajos de teclado tipo vim para navegar sin tocar el mouse.
- Menú contextual nativo (cortar / copiar / pegar / deshacer / rehacer).
- Zoom in / out / reset desde la API expuesta por `preload.js`.
- Aislamiento de contexto activado (`contextIsolation: true`, `nodeIntegration: false`) — el renderer no tiene acceso directo a Node.

## Atajos de teclado

| Tecla | Acción            |
|-------|-------------------|
| `q`   | Salir             |
| `n`   | Nueva nota        |
| `e`   | Editar            |
| `p`   | Nuevo proyecto    |
| `d`   | Eliminar          |
| `/`   | Buscar            |
| `r`   | Refrescar         |

## Requisitos

- Node.js 18+ y npm.
- Linux, macOS o Windows (cualquier plataforma soportada por Electron 42).

## Instalación

```bash
git clone git@github.com:walteru/Notas-Electron.git
cd Notas-Electron
npm install
```

## Uso

```bash
npm start
```

Las notas se guardan como archivos `.md` en `proyectos/`. Esa carpeta **no está en `.gitignore`**, así que si clonas el repo en otra máquina y haces `git pull`, tus notas viajan con el código. Si prefieres que las notas no se versionen, descomenta `proyectos/*.md` en `.gitignore`.

## Estructura del proyecto

```
.
├── main.js          # Proceso principal de Electron + handlers IPC
├── preload.js       # Puente seguro entre renderer y main
├── src/
│   ├── index.html   # UI
│   ├── style.css    # Estilos (tema oscuro)
│   └── renderer.js  # Lógica de UI y atajos
├── proyectos/       # Notas Markdown del usuario
└── package.json
```

## Licencia

MIT — ver [LICENSE](LICENSE).

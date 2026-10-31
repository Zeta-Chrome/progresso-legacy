# Progresso

Progresso is a productivity application that helps you track your progress across different skills and tasks.

## Features

- Add and manage skills and tasks.
- Track your progress and time spent.
- Visualize your progress using calendars and charts.

## Installation

Download the package for your Linux distribution from the [Releases](https://github.com/6162-code-656C/Progresso-electron/releases) page.

| Distribution | Package | Installation |
|---|---|---|
| Debian / Ubuntu | `.deb` | `sudo apt install ./progresso_*.deb` |
| Fedora / RHEL | `.rpm` | `sudo dnf install ./Progresso-*.rpm` |
| Arch Linux | `.pacman` | `sudo pacman -U ./Progresso-*.pacman` |
| Other Linux distributions | `.AppImage` | `chmod +x Progresso-*.AppImage && ./Progresso-*.AppImage` |

## Development

Clone the repository and install the dependencies:

```bash
git clone https://github.com/6162-code-656C/Progresso-electron.git
cd Progresso-electron
npm install
```

Start the application:

```bash
npm start
```

To run with automatic reload on file changes:

```bash
npm install --save-dev electronmon
npx electronmon .
```

## Building

Progresso uses [electron-builder](https://www.electron.build/) to package the application for Linux.

You can build an individual package format using the following commands:

| Target | Command | Output |
|---|---|---|
| AppImage | `npm run dist:appimage` | `.AppImage` |
| Debian / Ubuntu | `npm run dist:deb` | `.deb` |
| Fedora / RHEL | `npm run dist:rpm` | `.rpm` |
| Arch Linux | `npm run dist:arch` | `.pacman` |

For example, to build an RPM package:

```bash
npm run dist:rpm
```

You can build multiple formats independently without changing the application source code or package configuration.

All generated packages are placed in the `dist/` directory.

### Build requirements

You need Node.js and npm installed.

Some package formats also require distribution-specific packaging utilities on the build machine. If a required utility is missing, electron-builder will report the error.

For cross-distribution releases, build and test each package format in an appropriate environment.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

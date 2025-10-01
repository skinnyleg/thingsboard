# VS Code Java Development Setup

## Java Language Server Cache Configuration

This project is configured to use local cache directories for Maven and Gradle to avoid re-downloading dependencies, especially useful when working with Docker containers.

### Cache Directories

The following cache directories are configured:

- **Maven (m2)**: `~/.m2/repository`
- **Gradle**: `~/.gradle` (or `$GRADLE_USER_HOME` if set)
- **npm**: `~/.npm`

### Docker Volume Configuration

When working with Docker containers, mount these cache directories as volumes to persist dependencies across container rebuilds:

#### Docker Compose Example

```yaml
version: '3.8'

services:
  thingsboard-dev:
    image: your-dev-image
    volumes:
      - .:/workspace
      # Cache volumes
      - ~/.m2:/root/.m2
      - ~/.gradle:/root/.gradle
      - ~/.npm:/root/.npm
    environment:
      - MAVEN_OPTS=-Dmaven.repo.local=/root/.m2/repository
      - GRADLE_USER_HOME=/root/.gradle
      - NPM_CONFIG_CACHE=/root/.npm
```

#### Docker Run Example

```bash
docker run -it --rm \
  -v $(pwd):/workspace \
  -v ~/.m2:/root/.m2 \
  -v ~/.gradle:/root/.gradle \
  -v ~/.npm:/root/.npm \
  -e MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository" \
  -e GRADLE_USER_HOME="/root/.gradle" \
  -e NPM_CONFIG_CACHE="/root/.npm" \
  your-dev-image
```

### VS Code Dev Container

If using VS Code Dev Containers (`.devcontainer/devcontainer.json`):

```json
{
  "name": "ThingsBoard Dev",
  "mounts": [
    "source=${localEnv:HOME}/.m2,target=/root/.m2,type=bind,consistency=cached",
    "source=${localEnv:HOME}/.gradle,target=/root/.gradle,type=bind,consistency=cached",
    "source=${localEnv:HOME}/.npm,target=/root/.npm,type=bind,consistency=cached"
  ],
  "containerEnv": {
    "MAVEN_OPTS": "-Dmaven.repo.local=/root/.m2/repository",
    "GRADLE_USER_HOME": "/root/.gradle",
    "NPM_CONFIG_CACHE": "/root/.npm"
  }
}
```

### Benefits

1. **Faster builds**: Dependencies are cached and reused across container restarts
2. **Reduced bandwidth**: No need to re-download dependencies
3. **Consistent environment**: Same cache used across multiple projects
4. **IDE performance**: Java Language Server can access all dependencies quickly

### Required Extensions

- [Language Support for Java(TM) by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java)
- [Maven for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-maven) (optional)
- [Gradle for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-gradle) (optional)

### Troubleshooting

If the Java Language Server is not picking up dependencies:

1. Reload the Java Language Server: `Ctrl+Shift+P` → "Java: Clean Java Language Server Workspace"
2. Verify cache directories are mounted correctly in the container
3. Check that environment variables are set correctly
4. Ensure the cache directories have proper permissions (readable/writable)

### Cache Directory Structure

```
~/.m2/
├── repository/          # Maven dependencies
└── settings.xml         # Maven settings (optional)

~/.gradle/
├── caches/             # Gradle dependency cache
├── wrapper/            # Gradle wrapper distributions
└── daemon/             # Gradle daemon files

~/.npm/
├── _cacache/           # npm package cache
└── _logs/              # npm logs
```

#!/usr/bin/env bash
set -eu

# ---------- Localizar .tool-versions ----------
# Procura no diretório do script, depois sobe a árvore até a raiz
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

find_tool_versions() {
  if [ -f "$SCRIPT_DIR/.tool-versions" ]; then
    printf '%s\n' "$SCRIPT_DIR/.tool-versions"
    return 0
  fi
  if [ -f "./.tool-versions" ]; then
    printf '%s\n' "./.tool-versions"
    return 0
  fi
  return 1
}

TOOL_VERSIONS_FILE=""
if TOOL_VERSIONS_FILE="$(find_tool_versions "$SCRIPT_DIR")"; then
  echo "📄 Usando $TOOL_VERSIONS_FILE"
else
  echo "⚠️ .tool-versions não encontrado — instalará a versão mais recente" >&2
fi

# ---------- Extrair versão do Deno ----------
DENO_VERSION=""
if [ -n "$TOOL_VERSIONS_FILE" ]; then
  DENO_VERSION="$(awk '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*deno[[:space:]]+/ { print $2; exit }
  ' "$TOOL_VERSIONS_FILE")"
fi

# Normaliza: remove prefixo "v" se existir
DENO_VERSION="${DENO_VERSION#v}"

# Valida formato (apenas dígitos e pontos)
case "$DENO_VERSION" in
  ''|*[!0-9.]*)
    if [ -n "$DENO_VERSION" ]; then
      echo "⚠️ Versão inválida em .tool-versions: '$DENO_VERSION'" >&2
    fi
    DENO_VERSION=""
    ;;
esac

# ---------- PATH e detecção do Deno instalado ----------
export PATH="${HOME:-/root}/.deno/bin:/root/.deno/bin:/usr/local/bin:$PATH"

INSTALLED_VERSION=""
if command -v deno >/dev/null 2>&1; then
  INSTALLED_VERSION="$(deno --version 2>/dev/null | head -n 1 | awk '{print $2}')"
fi

# ---------- Instalar / reinstalar se necessário ----------
if [ -n "$DENO_VERSION" ]; then
  if [ "$INSTALLED_VERSION" = "$DENO_VERSION" ]; then
    echo "✅ Deno $DENO_VERSION já instalado"
  else
    if [ -n "$INSTALLED_VERSION" ]; then
      echo "🔄 Deno $INSTALLED_VERSION encontrado, reinstalando $DENO_VERSION..."
    else
      echo "📥 Instalando Deno $DENO_VERSION (unattended)..."
    fi
    (curl -fsSL https://deno.land/install.sh || curl -fsSL https://github.com/denoland/deno_install/raw/master/install.sh) \
      | sh -s -- -y "v$DENO_VERSION"
  fi
else
  if [ -z "$INSTALLED_VERSION" ]; then
    echo "📥 Instalando Deno (versão mais recente)..."
    (curl -fsSL https://deno.land/install.sh || curl -fsSL https://github.com/denoland/deno_install/raw/master/install.sh) \
      | sh -s -- -y
  fi
fi

# ---------- Symlinks (Debian/root-friendly) ----------
if [ -w /usr/local/bin ] && [ -x "${HOME:-/root}/.deno/bin/deno" ]; then
  ln -sf "${HOME:-/root}/.deno/bin/deno" /usr/local/bin/deno || true
fi

echo "✅ Deno ready: $(deno --version | head -n 1)"

# ---------- denoDir ----------
DENO_DIR_PATH="${DENO_DIR:-$(deno info --json \
  | sed -n 's/.*"denoDir": *"\([^"]*\)".*/\1/p')}"
echo "     denoDir: ${DENO_DIR_PATH}"

export PORT=3000

echo "🤹 Checking TaskJuggler (tj3) installation..."
if ! command -v tj3 >/dev/null 2>&1; then
  echo "Installing ruby, ruby-dev, build-essential..."
  DEBIAN_FRONTEND=noninteractive apt-get update -y && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
    ruby ruby-dev build-essential
  echo "Installing taskjuggler gem..."
  gem install taskjuggler --no-document
fi

TJ3_BIN=$(command -v tj3 || find / -name tj3 2>/dev/null | head -n 1)
if [ -n "$TJ3_BIN" ]; then
  if [ "$TJ3_BIN" != "/usr/local/bin/tj3" ]; then
    ln -sf "$TJ3_BIN" /usr/local/bin/tj3
  fi
  if [ "$TJ3_BIN" != "/usr/bin/tj3" ]; then
    ln -sf "$TJ3_BIN" /usr/bin/tj3
  fi
fi

if command -v tj3 >/dev/null 2>&1; then
  echo "✅ TaskJuggler ready: $(tj3 --version)"
fi

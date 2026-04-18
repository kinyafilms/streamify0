#!/bin/bash

# Streamify Setup Script
# Checks for and installs necessary dependencies for development.

echo "🚀 Starting Streamify Setup..."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# 1. Check for FFmpeg (CRITICAL for Transcoding)
if command_exists ffmpeg; then
  echo "✅ FFmpeg is already installed."
else
  echo "⚠️  FFmpeg is missing. Attempting to install..."
  
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash / Cygwin)
    echo "🔍 Checking for Administrative privileges..."
    net session > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "--------------------------------------------------"
      echo "❌ ERROR: ADMINISTRATIVE PRIVILEGES REQUIRED"
      echo "This script must install FFmpeg/Chocolatey, which requires Admin rights."
      echo "Please restart Git Bash as an Administrator and try again."
      echo "--------------------------------------------------"
      exit 1
    fi

    if ! command_exists choco; then
      echo "📦 Chocolatey not found. Installing..."
      powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
      # Refresh path for current session if possible (or just use absolute path for choco if known)
      export PATH="$PATH:/c/ProgramData/chocolatey/bin"
    fi

    if ! command_exists ffmpeg; then
      echo "📦 Installing FFmpeg via Chocolatey..."
      choco install ffmpeg -y
    else
      echo "✅ FFmpeg is already installed."
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command_exists brew; then
      echo "📦 Installing FFmpeg via Homebrew..."
      brew install ffmpeg
    else
      echo "❌ Error: Homebrew not found. Please install Homebrew: https://brew.sh/"
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "📦 Installing FFmpeg via apt..."
    sudo apt update && sudo apt install -y ffmpeg
  else
    echo "❌ Unsupported OS for automatic FFmpeg installation. Please install FFmpeg manually."
  fi
fi

# 2. Check for Docker
if command_exists docker; then
  echo "✅ Docker is already installed."
else
  echo "⚠️  Docker is missing. It is required for the database and storage. Please download it from: https://www.docker.com/products/docker-desktop/"
fi

# 3. Check for pnpm
if command_exists pnpm; then
  echo "✅ pnpm is already installed."
else
  echo "⚠️  pnpm is missing. Installing via npm..."
  npm install -g pnpm
fi

# 4. Install Project Dependencies
echo "📦 Installing project dependencies..."
pnpm install

# 5. Initialize Infrastructure (Optional)
echo "🐳 Pulling Docker images..."
docker-compose pull

echo "--------------------------------------------------"
echo "✨ Setup complete! Streamify is ready for development."
echo "👉 Start infrastructure: docker-compose up -d"
echo "👉 Start dev server: pnpm dev"
echo "--------------------------------------------------"

const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')

const HOST = '127.0.0.1'
const PORT = Number(process.env.AIGUMENT_PORT || 5000)
const DEV_FRONTEND_URL = process.env.AIGUMENT_FRONTEND_URL || 'http://127.0.0.1:3000'

let backendProcess = null
let mainWindow = null

function getLogFilePath() {
  const logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  return path.join(logDir, 'backend.log')
}

function resolveBackendCommand() {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, 'backend', 'AIgumentBackend.exe'),
      args: [],
    }
  }

  const builtExe = path.join(app.getAppPath(), 'dist', 'backend', 'AIgumentBackend', 'AIgumentBackend.exe')
  if (fs.existsSync(builtExe)) {
    return {
      command: builtExe,
      args: [],
    }
  }

  const venvPython = path.join(app.getAppPath(), 'backend', 'venv', 'Scripts', 'python.exe')
  return {
    command: fs.existsSync(venvPython) ? venvPython : 'python',
    args: [path.join(app.getAppPath(), 'backend', 'main.py')],
  }
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })

      request.on('error', retry)
      request.setTimeout(2000, () => {
        request.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for the local AIgument service to start.'))
        return
      }
      setTimeout(attempt, 500)
    }

    attempt()
  })
}

function canReachUrl(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(Boolean(response.statusCode && response.statusCode < 500))
    })

    request.on('error', () => resolve(false))
    request.setTimeout(timeoutMs, () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function startBackend() {
  const { command, args } = resolveBackendCommand()
  const logFile = getLogFilePath()
  const tempDir = path.join(app.getPath('userData'), 'tmp')
  fs.mkdirSync(tempDir, { recursive: true })
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })
  backendProcess = spawn(command, args, {
    cwd: app.isPackaged ? process.resourcesPath : app.getAppPath(),
    env: {
      ...process.env,
      AIGUMENT_HOST: HOST,
      AIGUMENT_PORT: String(PORT),
      TMP: tempDir,
      TEMP: tempDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  backendProcess.stdout.on('data', (chunk) => {
    logStream.write(chunk)
  })
  backendProcess.stderr.on('data', (chunk) => {
    logStream.write(chunk)
  })

  const startupError = new Promise((_, reject) => {
    backendProcess.once('error', (error) => {
      reject(new Error(`无法启动本地后端进程: ${error.message}\n日志: ${logFile}`))
    })
  })

  backendProcess.once('exit', (code, signal) => {
    logStream.end(`\n[backend-exit] code=${code ?? 'null'} signal=${signal ?? 'null'}${os.EOL}`)
    if (code !== 0) {
      const message = `本地服务未能正常启动，退出码: ${code ?? 'unknown'}\n日志: ${logFile}`
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox('AIgument 启动失败', message)
        app.quit()
      }
    }
  })

  await Promise.race([
    waitForServer(`http://${HOST}:${PORT}/health`),
    startupError,
  ])
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: 'AIgument',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  resolveFrontendUrl()
    .then((url) => mainWindow.loadURL(url))
    .catch((error) => {
      dialog.showErrorBox(
        'AIgument 前端未就绪',
        error instanceof Error ? error.message : 'Unknown frontend startup error'
      )
      app.quit()
    })
}

async function resolveFrontendUrl() {
  const backendUrl = `http://${HOST}:${PORT}`
  if (app.isPackaged) {
    return backendUrl
  }

  const builtFrontendIndex = path.join(app.getAppPath(), 'src', 'static', 'dist', 'index.html')
  if (fs.existsSync(builtFrontendIndex)) {
    return backendUrl
  }

  if (await canReachUrl(DEV_FRONTEND_URL)) {
    return DEV_FRONTEND_URL
  }

  throw new Error(
    '未找到前端构建产物，也无法连接到开发服务器。请先运行 `npm --prefix frontend run build`，或启动 Vite 开发服务后重试。'
  )
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
  }
  backendProcess = null
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', stopBackend)

app.whenReady().then(async () => {
  try {
    await startBackend()
    createWindow()
  } catch (error) {
    dialog.showErrorBox(
      'AIgument 启动失败',
      error instanceof Error ? error.message : 'Unknown startup error'
    )
    app.quit()
  }
})

# Claude Code CLI 자동 설치 및 검증 지침

> 이 문서는 **Codex가 저장소를 clone한 뒤 직접 읽고 실행하기 위한 작업 지시서**입니다.  
> Codex는 사용자의 운영체제를 감지하고, 해당 환경에 맞는 Claude Code CLI를 설치한 다음, `env_settings.txt`의 인증 정보를 현재 검증 프로세스에만 주입하여 정상 동작을 확인해야 합니다.

---

## 1. 목표

Codex는 다음 작업을 순서대로 수행합니다.

1. 현재 저장소 루트에서 `env_settings.txt`를 찾습니다.
2. 해당 파일이 Git에 커밋되지 않도록 보호합니다.
3. 운영체제를 감지합니다.
4. Anthropic의 공식 native installer로 Claude Code CLI의 stable 채널을 설치합니다.
5. `claude --version`과 `claude doctor`를 실행합니다.
6. `env_settings.txt`의 토큰을 현재 프로세스에만 주입합니다.
7. `claude -p`로 최소 API 호출을 한 번 실행하여 인증과 응답을 검증합니다.
8. 토큰을 환경변수에서 제거하고 결과만 보고합니다.

---

## 2. Codex 실행 원칙

Codex는 아래 규칙을 반드시 지켜야 합니다.

- 사용자에게 운영체제를 다시 묻지 말고 직접 감지합니다.
- 이미 Claude Code가 설치되어 있으면 재설치하지 말고 검증부터 수행합니다.
- npm 기반 설치보다 공식 native installer를 우선합니다.
- 관리자 권한이나 `sudo`는 기본적으로 사용하지 않습니다.
- 토큰 원문을 터미널, 로그, Markdown, 오류 메시지에 출력하지 않습니다.
- 토큰을 `.zshrc`, `.bashrc`, PowerShell profile, 시스템 환경변수 등에 영구 저장하지 않습니다.
- `env_settings.txt`를 Git에 추가하거나 커밋하지 않습니다.
- API 검증은 파일 수정이나 셸 실행이 필요 없는 짧은 비대화형 요청으로 제한합니다.
- 설치나 검증에 실패하면 성공했다고 보고하지 않습니다.
- 한 플랫폼에서 다른 플랫폼용 명령을 실행하지 않습니다.

---

## 3. 필요한 저장소 구조

```text
repository-root/
├── claude_auto_install.md
└── env_settings.txt
```

`env_settings.txt`의 기본 형식은 다음과 같습니다.

```text
token="YOUR_ANTHROPIC_API_KEY"
```

이 문서에서 `token`은 기본적으로 **Anthropic Console에서 발급한 API key**로 해석하며, 실행 시 `ANTHROPIC_API_KEY`에 연결합니다.

Claude 구독 계정에서 `claude setup-token`으로 발급한 OAuth token을 사용하는 경우에만 다음과 같이 선택적으로 지정할 수 있습니다.

```text
token="YOUR_CLAUDE_CODE_OAUTH_TOKEN"
auth_type="oauth_token"
```

지원하는 `auth_type` 값은 다음 두 가지입니다.

```text
api_key
oauth_token
```

`auth_type`이 생략되면 `api_key`로 처리합니다.

---

## 4. 비밀 파일 보호

설치 전에 다음 사항을 적용합니다.

1. `.gitignore`에 아래 항목이 없다면 추가합니다.

```gitignore
env_settings.txt
```

2. `env_settings.txt`가 이미 Git index에 올라가 있다면 로컬 파일은 유지하고 index에서만 제거합니다.

```bash
git rm --cached --ignore-unmatch env_settings.txt
```

PowerShell에서도 동일하게 실행할 수 있습니다.

```powershell
git rm --cached --ignore-unmatch env_settings.txt
```

3. 토큰이 과거 커밋에 포함된 적이 있다면 설치를 계속할 수는 있지만, 최종 보고에 다음 경고를 포함합니다.

```text
경고: env_settings.txt가 과거 Git 커밋에 포함되었다면 해당 키를 즉시 폐기하고 새 키를 발급해야 합니다.
```

---

## 5. 플랫폼 선택 규칙

Codex는 현재 환경을 확인한 뒤 아래 블록 중 **정확히 하나만** 실행합니다.

| 감지 환경 | 실행할 블록 |
|---|---|
| macOS | A. macOS / Linux / WSL |
| Linux | A. macOS / Linux / WSL |
| WSL 1 또는 WSL 2 | A. macOS / Linux / WSL |
| Native Windows PowerShell | B. Native Windows PowerShell |
| Windows의 Git Bash | PowerShell을 호출하여 B 블록 실행 |

WSL에서는 Windows용 installer를 실행하지 않습니다.  
Native Windows에서는 Bash용 installer를 실행하지 않습니다.

---

# A. macOS / Linux / WSL 자동 설치

Codex는 저장소 루트에서 아래 스크립트를 실행합니다.

```bash
set -euo pipefail

SETTINGS_FILE="./env_settings.txt"
CLAUDE_BIN=""
TOKEN=""
AUTH_TYPE="api_key"

log() {
  printf '[Claude Setup] %s\n' "$1"
}

fail() {
  printf '[Claude Setup] ERROR: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  unset TOKEN
  unset ANTHROPIC_API_KEY
  unset CLAUDE_CODE_OAUTH_TOKEN
}
trap cleanup EXIT

log "플랫폼을 감지합니다."

OS_NAME="$(uname -s 2>/dev/null || true)"
case "$OS_NAME" in
  Darwin)
    PLATFORM="macOS"
    ;;
  Linux)
    if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
      PLATFORM="WSL"
    else
      PLATFORM="Linux"
    fi
    ;;
  *)
    fail "이 블록은 macOS, Linux 또는 WSL에서만 실행할 수 있습니다: ${OS_NAME:-unknown}"
    ;;
esac

log "감지된 플랫폼: $PLATFORM"

[ -f "$SETTINGS_FILE" ] || fail "현재 디렉터리에 env_settings.txt가 없습니다."

# 비밀 파일을 Git에서 보호합니다.
if [ -d ".git" ] || git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  touch .gitignore
  if ! grep -qxF 'env_settings.txt' .gitignore; then
    printf '\nenv_settings.txt\n' >> .gitignore
    log ".gitignore에 env_settings.txt를 추가했습니다."
  fi

  git rm --cached --ignore-unmatch env_settings.txt >/dev/null 2>&1 || true

  if git log --all --format=%H -- env_settings.txt 2>/dev/null | grep -q .; then
    log "경고: env_settings.txt의 과거 커밋 기록이 감지되었습니다. 사용 중인 키를 폐기하고 재발급해야 합니다."
  fi
fi

# 정확히 token="..." 형식에서 값을 읽습니다.
TOKEN="$(
  sed -nE 's/^[[:space:]]*token[[:space:]]*=[[:space:]]*"([^"]+)"[[:space:]]*$/\1/p' \
    "$SETTINGS_FILE" | head -n 1
)"

AUTH_TYPE_VALUE="$(
  sed -nE 's/^[[:space:]]*auth_type[[:space:]]*=[[:space:]]*"([^"]+)"[[:space:]]*$/\1/p' \
    "$SETTINGS_FILE" | head -n 1
)"

if [ -n "$AUTH_TYPE_VALUE" ]; then
  AUTH_TYPE="$AUTH_TYPE_VALUE"
fi

[ -n "$TOKEN" ] || fail 'env_settings.txt에서 token="..." 값을 읽지 못했습니다.'

case "$AUTH_TYPE" in
  api_key|oauth_token)
    ;;
  *)
    fail 'auth_type은 "api_key" 또는 "oauth_token"이어야 합니다.'
    ;;
esac

log "인증 정보 형식을 확인했습니다. 토큰 원문은 출력하지 않습니다."

# Claude Code 설치 여부를 확인합니다.
if command -v claude >/dev/null 2>&1; then
  CLAUDE_BIN="$(command -v claude)"
  log "Claude Code가 이미 설치되어 있습니다: $CLAUDE_BIN"
else
  command -v curl >/dev/null 2>&1 || fail "curl이 필요하지만 설치되어 있지 않습니다."

  log "Anthropic 공식 native installer의 stable 채널을 설치합니다."
  curl -fsSL https://claude.ai/install.sh | bash -s stable

  # native installer의 기본 설치 경로를 현재 프로세스 PATH에 추가합니다.
  export PATH="$HOME/.local/bin:$PATH"

  if command -v claude >/dev/null 2>&1; then
    CLAUDE_BIN="$(command -v claude)"
  elif [ -x "$HOME/.local/bin/claude" ]; then
    CLAUDE_BIN="$HOME/.local/bin/claude"
  else
    fail "설치는 완료되었지만 claude 실행 파일을 찾지 못했습니다."
  fi
fi

# 새 터미널에서도 claude를 찾을 수 있도록 필요한 경우에만 PATH를 보완합니다.
if ! command -v claude >/dev/null 2>&1 && [ -x "$HOME/.local/bin/claude" ]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

if [ "$CLAUDE_BIN" = "$HOME/.local/bin/claude" ]; then
  PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

  case "${SHELL:-}" in
    */zsh)
      PROFILE_FILE="$HOME/.zshrc"
      ;;
    */bash)
      PROFILE_FILE="$HOME/.bashrc"
      ;;
    *)
      PROFILE_FILE=""
      ;;
  esac

  if [ -n "$PROFILE_FILE" ]; then
    touch "$PROFILE_FILE"
    if ! grep -qxF "$PATH_LINE" "$PROFILE_FILE"; then
      printf '\n%s\n' "$PATH_LINE" >> "$PROFILE_FILE"
      log "새 터미널용 PATH 설정을 $PROFILE_FILE에 추가했습니다."
    fi
  fi
fi

log "버전을 확인합니다."
CLAUDE_VERSION="$("$CLAUDE_BIN" --version 2>&1)" || fail "claude --version 실행에 실패했습니다."
printf '[Claude Setup] Version: %s\n' "$CLAUDE_VERSION"

log "설치 진단을 실행합니다."
set +e
DOCTOR_OUTPUT="$("$CLAUDE_BIN" doctor 2>&1)"
DOCTOR_EXIT=$?
set -e

printf '%s\n' "$DOCTOR_OUTPUT"
if [ "$DOCTOR_EXIT" -ne 0 ]; then
  log "claude doctor가 경고 또는 오류를 보고했습니다. API 검증은 계속 수행합니다."
fi

log "비대화형 API 인증 검증을 실행합니다."

VERIFY_PROMPT='Reply with exactly this text and nothing else: CLAUDE_CODE_OK'

set +e
if [ "$AUTH_TYPE" = "oauth_token" ]; then
  VERIFY_OUTPUT="$(
    CLAUDE_CODE_OAUTH_TOKEN="$TOKEN" \
      "$CLAUDE_BIN" \
      --bare \
      -p "$VERIFY_PROMPT" \
      --output-format text \
      --max-turns 1 \
      --no-session-persistence \
      2>&1
  )"
  VERIFY_EXIT=$?
else
  VERIFY_OUTPUT="$(
    ANTHROPIC_API_KEY="$TOKEN" \
      "$CLAUDE_BIN" \
      --bare \
      -p "$VERIFY_PROMPT" \
      --output-format text \
      --max-turns 1 \
      --no-session-persistence \
      2>&1
  )"
  VERIFY_EXIT=$?
fi
set -e

# 혹시 오류 출력에 토큰이 포함되더라도 제거합니다.
SAFE_VERIFY_OUTPUT="${VERIFY_OUTPUT//$TOKEN/***REDACTED***}"

if [ "$VERIFY_EXIT" -ne 0 ]; then
  printf '%s\n' "$SAFE_VERIFY_OUTPUT" >&2
  fail "Claude Code API 인증 또는 응답 검증에 실패했습니다."
fi

if ! printf '%s' "$VERIFY_OUTPUT" | grep -q 'CLAUDE_CODE_OK'; then
  printf '%s\n' "$SAFE_VERIFY_OUTPUT"
  fail "API 호출은 종료되었지만 예상한 검증 문자열을 받지 못했습니다."
fi

log "API 인증과 Claude 응답 검증에 성공했습니다."
log "설치 완료: 이제 프로젝트 디렉터리에서 'claude'를 실행할 수 있습니다."
```

---

# B. Native Windows PowerShell 자동 설치

Codex는 저장소 루트에서 **PowerShell**로 아래 스크립트를 실행합니다.

```powershell
$ErrorActionPreference = "Stop"

$SettingsFile = Join-Path (Get-Location) "env_settings.txt"
$Token = $null
$AuthType = "api_key"
$ClaudeBin = $null

function Write-SetupLog {
    param([string]$Message)
    Write-Host "[Claude Setup] $Message"
}

function Stop-Setup {
    param([string]$Message)
    throw "[Claude Setup] ERROR: $Message"
}

try {
    if (-not $IsWindows -and $env:OS -ne "Windows_NT") {
        Stop-Setup "이 블록은 Native Windows PowerShell에서만 실행할 수 있습니다."
    }

    Write-SetupLog "감지된 플랫폼: Native Windows"

    if (-not (Test-Path -LiteralPath $SettingsFile -PathType Leaf)) {
        Stop-Setup "현재 디렉터리에 env_settings.txt가 없습니다."
    }

    # 비밀 파일을 Git에서 보호합니다.
    $InsideGit = $false
    try {
        git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -eq 0) {
            $InsideGit = $true
        }
    }
    catch {
        $InsideGit = $false
    }

    if ($InsideGit) {
        $GitIgnore = Join-Path (Get-Location) ".gitignore"

        if (-not (Test-Path -LiteralPath $GitIgnore)) {
            New-Item -ItemType File -Path $GitIgnore | Out-Null
        }

        $IgnoreLines = Get-Content -LiteralPath $GitIgnore -ErrorAction SilentlyContinue
        if ($IgnoreLines -notcontains "env_settings.txt") {
            Add-Content -LiteralPath $GitIgnore -Value "`nenv_settings.txt"
            Write-SetupLog ".gitignore에 env_settings.txt를 추가했습니다."
        }

        git rm --cached --ignore-unmatch env_settings.txt *> $null

        $History = git log --all --format=%H -- env_settings.txt 2>$null
        if ($History) {
            Write-SetupLog "경고: env_settings.txt의 과거 커밋 기록이 감지되었습니다. 사용 중인 키를 폐기하고 재발급해야 합니다."
        }
    }

    # token="..." 및 선택적 auth_type="..." 값을 읽습니다.
    foreach ($Line in Get-Content -LiteralPath $SettingsFile) {
        if ($Line -match '^\s*token\s*=\s*"([^"]+)"\s*$') {
            $Token = $Matches[1]
        }
        elseif ($Line -match '^\s*auth_type\s*=\s*"([^"]+)"\s*$') {
            $AuthType = $Matches[1]
        }
    }

    if ([string]::IsNullOrWhiteSpace($Token)) {
        Stop-Setup 'env_settings.txt에서 token="..." 값을 읽지 못했습니다.'
    }

    if ($AuthType -notin @("api_key", "oauth_token")) {
        Stop-Setup 'auth_type은 "api_key" 또는 "oauth_token"이어야 합니다.'
    }

    Write-SetupLog "인증 정보 형식을 확인했습니다. 토큰 원문은 출력하지 않습니다."

    $ExistingClaude = Get-Command claude -ErrorAction SilentlyContinue

    if ($ExistingClaude) {
        $ClaudeBin = $ExistingClaude.Source
        Write-SetupLog "Claude Code가 이미 설치되어 있습니다: $ClaudeBin"
    }
    else {
        Write-SetupLog "Anthropic 공식 native installer의 stable 채널을 설치합니다."

        $Installer = Invoke-RestMethod -Uri "https://claude.ai/install.ps1"
        & ([scriptblock]::Create($Installer)) stable

        $LocalBin = Join-Path $env:USERPROFILE ".local\bin"
        $ExpectedClaude = Join-Path $LocalBin "claude.exe"

        # 현재 PowerShell 프로세스에서 즉시 찾을 수 있도록 PATH를 새로 구성합니다.
        $ProcessPaths = @($env:Path -split ";" | Where-Object { $_ })
        if ($ProcessPaths -notcontains $LocalBin) {
            $env:Path = "$LocalBin;$env:Path"
        }

        # 사용자 PATH에도 idempotent하게 추가합니다.
        $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $UserPaths = @($UserPath -split ";" | Where-Object { $_ })

        if ($UserPaths -notcontains $LocalBin) {
            $NewUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) {
                $LocalBin
            }
            else {
                "$UserPath;$LocalBin"
            }

            [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
            Write-SetupLog "새 PowerShell 창용 사용자 PATH에 $LocalBin 을 추가했습니다."
        }

        $InstalledClaude = Get-Command claude -ErrorAction SilentlyContinue
        if ($InstalledClaude) {
            $ClaudeBin = $InstalledClaude.Source
        }
        elseif (Test-Path -LiteralPath $ExpectedClaude -PathType Leaf) {
            $ClaudeBin = $ExpectedClaude
        }
        else {
            Stop-Setup "설치는 완료되었지만 claude.exe를 찾지 못했습니다."
        }
    }

    Write-SetupLog "버전을 확인합니다."
    $ClaudeVersion = & $ClaudeBin --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Stop-Setup "claude --version 실행에 실패했습니다."
    }
    Write-Host "[Claude Setup] Version: $ClaudeVersion"

    Write-SetupLog "설치 진단을 실행합니다."
    & $ClaudeBin doctor
    $DoctorExit = $LASTEXITCODE

    if ($DoctorExit -ne 0) {
        Write-SetupLog "claude doctor가 경고 또는 오류를 보고했습니다. API 검증은 계속 수행합니다."
    }

    Write-SetupLog "비대화형 API 인증 검증을 실행합니다."

    $VerifyPrompt = "Reply with exactly this text and nothing else: CLAUDE_CODE_OK"

    $PreviousApiKey = $env:ANTHROPIC_API_KEY
    $PreviousOAuthToken = $env:CLAUDE_CODE_OAUTH_TOKEN

    try {
        if ($AuthType -eq "oauth_token") {
            Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
            $env:CLAUDE_CODE_OAUTH_TOKEN = $Token
        }
        else {
            Remove-Item Env:CLAUDE_CODE_OAUTH_TOKEN -ErrorAction SilentlyContinue
            $env:ANTHROPIC_API_KEY = $Token
        }

        $VerifyOutput = & $ClaudeBin `
            --bare `
            -p $VerifyPrompt `
            --output-format text `
            --max-turns 1 `
            --no-session-persistence `
            2>&1

        $VerifyExit = $LASTEXITCODE
    }
    finally {
        if ($null -eq $PreviousApiKey) {
            Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
        }
        else {
            $env:ANTHROPIC_API_KEY = $PreviousApiKey
        }

        if ($null -eq $PreviousOAuthToken) {
            Remove-Item Env:CLAUDE_CODE_OAUTH_TOKEN -ErrorAction SilentlyContinue
        }
        else {
            $env:CLAUDE_CODE_OAUTH_TOKEN = $PreviousOAuthToken
        }
    }

    $SafeVerifyOutput = (($VerifyOutput | Out-String).Replace($Token, "***REDACTED***")).Trim()

    if ($VerifyExit -ne 0) {
        if ($SafeVerifyOutput) {
            Write-Error $SafeVerifyOutput
        }
        Stop-Setup "Claude Code API 인증 또는 응답 검증에 실패했습니다."
    }

    if (($VerifyOutput | Out-String) -notmatch "CLAUDE_CODE_OK") {
        if ($SafeVerifyOutput) {
            Write-Host $SafeVerifyOutput
        }
        Stop-Setup "API 호출은 종료되었지만 예상한 검증 문자열을 받지 못했습니다."
    }

    Write-SetupLog "API 인증과 Claude 응답 검증에 성공했습니다."
    Write-SetupLog "설치 완료: 새 PowerShell 창 또는 프로젝트 디렉터리에서 'claude'를 실행할 수 있습니다."
}
finally {
    $Token = $null
    Remove-Variable Token -ErrorAction SilentlyContinue
}
```

---

## 6. Windows Git Bash에서 실행 중인 경우

Codex가 Windows의 Git Bash에서 실행되고 있다면 Bash용 installer를 실행하지 말고, 현재 저장소 경로에서 PowerShell을 열어 B 블록을 실행합니다.

운영체제 확인 예시:

```bash
uname -s
```

출력에 `MINGW`, `MSYS`, `CYGWIN` 등이 포함되면 Native Windows 환경으로 취급합니다.

Codex는 필요한 경우 다음 방식으로 PowerShell을 호출할 수 있습니다.

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass
```

그 뒤 B 블록의 PowerShell 스크립트를 실행합니다.

---

## 7. 성공 판정 기준

다음 조건을 모두 만족해야 성공입니다.

- `claude` 실행 파일을 찾을 수 있습니다.
- `claude --version`이 종료 코드 0으로 완료됩니다.
- `claude doctor`가 실행됩니다.
- 인증 환경변수를 현재 프로세스에만 설정할 수 있습니다.
- 다음 명령에 대응하는 비대화형 요청이 성공합니다.

```text
claude --bare -p "Reply with exactly this text and nothing else: CLAUDE_CODE_OK"
```

- 응답에 `CLAUDE_CODE_OK`가 포함됩니다.
- 검증 후 토큰 환경변수가 제거되거나 실행 전 상태로 복원됩니다.

`claude doctor`가 경고를 반환했지만 API 검증이 성공한 경우에는 **설치 성공 + doctor 경고**로 보고합니다. 경고 내용을 숨기지 않습니다.

---

## 8. Codex의 최종 보고 형식

Codex는 설치가 끝나면 아래 정보만 사용자에게 보고합니다.

```text
Claude Code CLI 설치 및 검증 결과

- Platform: macOS / Linux / WSL / Windows
- Installation: newly installed / already installed
- Claude Code version: <version>
- claude doctor: passed / warning / failed
- Authentication type: Anthropic API key / Claude Code OAuth token
- API verification: passed / failed
- Token persisted to shell profile: no
- env_settings.txt protected by .gitignore: yes / no
- Next command: claude
```

토큰 자체, 토큰 앞부분, 토큰 길이, 토큰의 hash는 보고하지 않습니다.

---

## 9. 오류 처리

### `env_settings.txt`가 없는 경우

설치 작업을 중단하고 다음만 보고합니다.

```text
env_settings.txt가 현재 저장소 루트에 없습니다.
token="..." 형식으로 파일을 만든 뒤 다시 실행하세요.
```

### 토큰이 비어 있는 경우

```text
env_settings.txt의 token 값이 비어 있습니다.
```

### 인증 실패

가능한 원인은 다음과 같습니다.

- Anthropic API key가 만료되었거나 폐기됨
- API credit 또는 조직 권한 부족
- OAuth token을 API key로 잘못 지정함
- 네트워크, 프록시 또는 방화벽 문제
- 지원되지 않는 지역에서 접속
- 계정 또는 조직이 비활성화됨

Codex는 토큰 원문을 출력하지 않은 상태에서 CLI가 반환한 오류를 요약합니다.

### `claude` 명령을 찾지 못하는 경우

- macOS/Linux/WSL: `~/.local/bin/claude` 존재 여부 확인
- Windows: `%USERPROFILE%\.local\bin\claude.exe` 존재 여부 확인
- 현재 프로세스 PATH를 갱신한 뒤 다시 확인
- 그래도 없으면 설치 실패로 보고

---

## 10. 보안 주의사항

- 수업용 공용 저장소에 실제 API key를 절대 커밋하지 않습니다.
- 학생별 key를 사용하거나, 교육용 조직에서 학생별 spend limit을 설정하는 방식을 권장합니다.
- 하나의 공용 key를 여러 학생에게 배포하면 유출, 과금 폭주, 사용자별 추적 불가 문제가 발생할 수 있습니다.
- key가 GitHub에 한 번이라도 push되었다면 `.gitignore`에 추가하는 것만으로는 충분하지 않습니다. 기존 key를 폐기하고 새 key를 발급해야 합니다.
- 설치 검증 요청도 API 비용을 소량 사용합니다.
- 로그 수집 시스템이 있는 교육 환경에서는 `env_settings.txt` 내용과 프로세스 환경변수를 수집하지 않도록 설정합니다.

---

## 11. 공식 문서 기준

이 지침은 다음 Anthropic 공식 문서의 설치 및 인증 방식을 기준으로 작성되었습니다.

- Claude Code setup: `https://code.claude.com/docs/en/setup`
- Claude Code authentication: `https://code.claude.com/docs/en/iam`
- Claude Code CLI reference: `https://code.claude.com/docs/en/cli-reference`
- Claude Code troubleshooting: `https://code.claude.com/docs/en/troubleshooting`

공식 설치 명령이나 인증 변수 이름이 변경될 수 있으므로, 교육 시작 전 위 문서를 다시 확인합니다.
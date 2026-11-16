const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {childOf, run, compilerPath, copyRuntime, zipDirectory, combineExecutable} = require('./package-game.cjs');

const app = path.resolve(__dirname, '..');
const runtimeExe = process.env.KOTOBA_ELECTRON_EXE || require('electron');
const runtime = path.dirname(runtimeExe);
const output = path.resolve(process.env.KOTOBA_OUTPUT_DIR || path.join(app, 'releases'));
fs.mkdirSync(output, {recursive:true});
if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('工作台安装包目前仅支持 Windows x64 构建');
const {version} = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const executable = path.join(output, `Kotoba-Studio-${version}-Windows-x64-Setup.exe`);

function replaceRequired(source, before, after) {
  if (!source.includes(before)) throw Error('打包模板已变化，缺少 ' + before);
  return source.replace(before, after);
}

async function build() {
  const work = childOf(output, fs.mkdtempSync(path.join(output, '.workbench-build-')));
  try {
    const payload = path.join(work, 'payload');
    console.log('准备工作台及 Windows 运行环境');
    await copyRuntime(runtime, runtimeExe, payload);
    fs.renameSync(path.join(payload, 'GamePlayer.exe'), path.join(payload, 'Kotoba Studio.exe'));
    const destination = path.join(payload, 'resources', 'app');
    fs.mkdirSync(destination, {recursive: true});
    for (const name of ['desktop', 'dist', 'package.json']) {
      fs.cpSync(path.join(app, name), path.join(destination, name), {
        recursive: true,
        filter: source => path.basename(source) !== 'build-current-game.cjs'
      });
    }
    fs.copyFileSync(path.join(app, 'LICENSE'), path.join(destination, 'LICENSE'));
    fs.copyFileSync(path.join(app, 'LICENSE'), path.join(payload, 'LICENSE.KotobaStudio.txt'));
    fs.cpSync(path.join(app, 'assets', 'effect-presets'), path.join(payload, '特效预设'), {recursive: true});
    const guide = fs.readFileSync(path.join(app, 'docs', '使用说明.md'), 'utf8');
    fs.writeFileSync(path.join(payload, '使用说明.md'),
      guide + '\n\n安装版的工程库和个人设置保存在 `%APPDATA%\\KotobaStudio`。可通过开始菜单打开 Kotoba Studio。\n', 'utf8');

    console.log('压缩工作台文件');
    const archive = path.join(work, 'workbench.zip');
    await zipDirectory(payload, archive);
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    const cacheKey = hash.digest('hex').slice(0, 24);
    let launcher = fs.readFileSync(path.join(__dirname, 'GameLauncher.cs'), 'utf8');
    launcher = replaceRequired(launcher, '__CACHE_KEY__', cacheKey);
    launcher = replaceRequired(launcher, 'Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"KotobaGameCache")',
      'testing ? Path.Combine(Path.GetDirectoryName(exe), ".workbench-install-check") : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"KotobaStudio")');
    launcher = replaceRequired(launcher, 'Path.Combine(cacheRoot,CacheKey)', 'Path.Combine(cacheRoot,"app-"+CacheKey)');
    launcher = launcher.replaceAll('GamePlayer.exe', 'Kotoba Studio.exe').replaceAll('KotobaGameExtract-', 'KotobaStudioSetup-');
    launcher = replaceRequired(launcher, '"game.html"', '"dist","index.html"');
    launcher = replaceRequired(launcher, 'var forwarded=new List<string>();', 'if(!testing) InstallShortcut(player, cache);\n    var forwarded=new List<string>();');
    launcher = replaceRequired(launcher, '[STAThread] static int Main', `static void InstallShortcut(string player, string directory) {
    string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
    Directory.CreateDirectory(programs);
    dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
    dynamic shortcut = shell.CreateShortcut(Path.Combine(programs, "Kotoba Studio.lnk"));
    shortcut.TargetPath = player;
    shortcut.WorkingDirectory = directory;
    shortcut.Description = "Kotoba Studio · Galgame 制作工作台";
    shortcut.Save();
  }
  [STAThread] static int Main`);
    launcher = launcher.replaceAll('游戏启动失败：', '工作台安装或启动失败：').replaceAll('"游戏",MessageBoxButtons', '"Kotoba Studio 安装程序",MessageBoxButtons');
    const source = path.join(work, 'WorkbenchSetup.cs');
    const compiled = path.join(work, 'setup.exe');
    fs.writeFileSync(source, launcher, 'utf8');
    console.log('生成单文件安装程序');
    await run(compilerPath(), ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/codepage:65001',
      '/reference:System.IO.Compression.dll', '/reference:System.Windows.Forms.dll', '/reference:Microsoft.CSharp.dll', '/out:' + compiled, source]);
    await combineExecutable(compiled, archive, executable);
    console.log(executable);
    console.log('安装包大小：' + fs.statSync(executable).size + ' 字节');
  } finally {
    childOf(output, work);
    if (!path.basename(work).startsWith('.workbench-build-')) throw Error('无效的构建目录');
    fs.rmSync(work, {recursive: true, force: true});
  }
}

build().catch(error => { console.error(error.message); process.exitCode = 1; });

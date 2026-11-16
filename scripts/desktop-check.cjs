const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('桌面集成检查目前在 Windows 上运行');
const root=path.resolve(__dirname,'..'),report=path.join(root,'artifacts','verification','verification.json');
fs.rmSync(report,{force:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(require('electron'),[root,'--self-test'],{env,windowsHide:true,encoding:'utf8',timeout:180000});
if(result.error){console.error(result.error.message);process.exit(1)}
if(!fs.existsSync(report)){console.error(result.stderr||'没有生成桌面检查报告');process.exit(1)}
const value=JSON.parse(fs.readFileSync(report,'utf8'));
if(result.status!==0||!value.ok){console.error(value.error||result.stderr);process.exit(1)}
console.log(`桌面检查通过：${value.checks.length} 项。报告：artifacts/verification/verification.json`);

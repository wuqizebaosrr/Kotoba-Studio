const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {publicFiles}=require('./public-files.cjs'),{childOf,zipDirectory}=require('../desktop/package-game.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts'),version=require('../package.json').version;
(async()=>{
  const scan=spawnSync(process.execPath,[path.join(__dirname,'scan-public.cjs')],{stdio:'inherit'});if(scan.status!==0)process.exit(1);
  fs.mkdirSync(output,{recursive:true});const work=fs.mkdtempSync(path.join(output,'.publish-build-'));
  try{
    const destination=path.join(work,'Kotoba-Studio');fs.mkdirSync(destination);
    const files=publicFiles(root);
    for(const relative of files){const to=childOf(destination,path.join(destination,relative));fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,relative),to)}
    const archive=path.join(output,`Kotoba-Studio-${version}-GitHub-source.zip`);fs.rmSync(archive,{force:true});
    await zipDirectory(work,archive);fs.writeFileSync(path.join(output,'public-file-manifest.json'),JSON.stringify({version,files},null,2));console.log(archive);
  }finally{childOf(output,work);if(!path.basename(work).startsWith('.publish-build-'))throw Error('无效临时目录');fs.rmSync(work,{recursive:true,force:true})}
})().catch(error=>{console.error(error.message);process.exitCode=1});

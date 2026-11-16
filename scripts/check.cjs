const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');let count=0;
for(const directory of ['desktop','dist','scripts','tests']){
  for(const entry of fs.readdirSync(path.join(root,directory),{recursive:true,withFileTypes:true})){
    if(!entry.isFile()||! /\.(?:cjs|mjs|js)$/.test(entry.name))continue;
    const file=path.join(entry.parentPath,entry.name),result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0){console.error(result.stderr||result.error);process.exit(result.status||1)}count++;
  }
}
console.log(`语法检查通过：${count} 个脚本`);

const fs=require('node:fs'),path=require('node:path');
const directories=['desktop','dist','scripts','tests','docs','assets','.github'];
const files=['package.json','package-lock.json','README.md','CHANGELOG.md','THIRD_PARTY.md','LICENSE','.gitignore','.gitattributes'];
function publicFiles(root){
  const result=[];
  const walk=relative=>{for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const name=path.join(relative,entry.name);if(entry.isSymbolicLink())throw Error('发布文件不能是符号链接：'+name);if(entry.isDirectory())walk(name);else result.push(name)}};
  for(const directory of directories)if(fs.existsSync(path.join(root,directory)))walk(directory);
  for(const file of files)if(fs.existsSync(path.join(root,file)))result.push(file);
  return result.sort();
}
module.exports={publicFiles};

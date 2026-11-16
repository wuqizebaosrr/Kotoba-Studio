const fs=require('node:fs'),path=require('node:path');
const {publicFiles}=require('./public-files.cjs'),root=path.resolve(__dirname,'..'),problems=[];
for(const file of publicFiles(root)){
  if(/\.kotoba\.json$|(?:^|[/\\])(?:data|stories|test-data)(?:[/\\])|(?:recovery|active-project|api-assistant)\.json$|\.(?:exe|dll|zip|pem|key)$/.test(file))problems.push(file+': 不应进入源码的文件');
  if(!/\.(?:js|cjs|mjs|json|md|txt|yml|yaml|html|css|svg)$/.test(file))continue;
  const text=fs.readFileSync(path.join(root,file),'utf8');
  if(/(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(text))problems.push(file+': 疑似真实密钥');
  if(/[A-Z]:[\\/]+(?:Users|Documents and Settings)[\\/]|(?:^|\n)(?:GITHUB_TOKEN|OPENAI_API_KEY)\s*=\s*[^\s]/.test(text))problems.push(file+': 个人用户路径或直接填写的凭据');
}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`公开副本检查通过：${publicFiles(root).length} 个文件；未发现所检查的个人路径、工程文件和密钥标记。`);

using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Collections.Generic;
class GameLauncher {
  const string CacheKey="__CACHE_KEY__";
  static string Quote(string value) { var b=new StringBuilder("\"");int slashes=0;foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='\"'){b.Append('\\',slashes*2+1);b.Append(c);}else{b.Append('\\',slashes);b.Append(c);}slashes=0;}b.Append('\\',slashes*2);b.Append('"');return b.ToString(); }
  [STAThread] static int Main(string[] args) { bool testing=Array.IndexOf(args,"--self-test")>=0;try {
    string exe=System.Reflection.Assembly.GetExecutingAssembly().Location;
    string cacheRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"KotobaGameCache");Directory.CreateDirectory(cacheRoot);
    string cache=Path.Combine(cacheRoot,CacheKey),player=Path.Combine(cache,"GamePlayer.exe");
    using(var mutex=new Mutex(false,"Local\\KotobaGameExtract-"+CacheKey)){if(!mutex.WaitOne(TimeSpan.FromMinutes(5)))throw new Exception("等待游戏文件准备超时。");try{
      if(!File.Exists(Path.Combine(cache,".ready"))||!File.Exists(player)){
        if(Directory.Exists(cache)){cache+="-"+Guid.NewGuid().ToString("N");player=Path.Combine(cache,"GamePlayer.exe");}Directory.CreateDirectory(cache);
        using(var file=File.OpenRead(exe)){if(file.Length<24)throw new Exception("游戏文件不完整。");file.Seek(-24,SeekOrigin.End);var reader=new BinaryReader(file);string magic=Encoding.ASCII.GetString(reader.ReadBytes(16));long offset=reader.ReadInt64();if(magic!="KOTOBA-GAME-V1!!"||offset<=0||offset>=file.Length-24)throw new Exception("游戏数据校验失败。");
          using(var payload=new PayloadStream(file,offset,file.Length-offset-24))using(var zip=new ZipArchive(payload,ZipArchiveMode.Read)){
            string safeRoot=Path.GetFullPath(cache)+Path.DirectorySeparatorChar;foreach(var entry in zip.Entries){string dest=Path.GetFullPath(Path.Combine(cache,entry.FullName));if(!dest.StartsWith(safeRoot,StringComparison.OrdinalIgnoreCase))throw new Exception("游戏文件路径无效。");if(entry.Name.Length==0){Directory.CreateDirectory(dest);continue;}Directory.CreateDirectory(Path.GetDirectoryName(dest));using(var input=entry.Open())using(var output=new FileStream(dest,FileMode.CreateNew,FileAccess.Write)){input.CopyTo(output);}}
          }
        }
        if(!File.Exists(player)||!File.Exists(Path.Combine(cache,"resources","app","game.html")))throw new Exception("游戏运行文件缺失。");File.WriteAllText(Path.Combine(cache,".ready"),CacheKey);
      }
    }finally{mutex.ReleaseMutex();}}
    var forwarded=new List<string>();foreach(string arg in args)forwarded.Add(Quote(arg));var start=new ProcessStartInfo(player,String.Join(" ",forwarded.ToArray()));start.WorkingDirectory=cache;start.UseShellExecute=false;var child=Process.Start(start);child.WaitForExit();return child.ExitCode;
  }catch(Exception ex){if(!testing)MessageBox.Show("游戏启动失败："+ex.Message,"游戏",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;} }
}
class PayloadStream:Stream {
  readonly Stream source;readonly long origin,length;long position;
  public PayloadStream(Stream stream,long offset,long count){source=stream;origin=offset;length=count;position=0;source.Position=offset;}
  public override bool CanRead{get{return true;}}public override bool CanSeek{get{return true;}}public override bool CanWrite{get{return false;}}public override long Length{get{return length;}}public override long Position{get{return position;}set{Seek(value,SeekOrigin.Begin);}}
  public override int Read(byte[] buffer,int offset,int count){count=(int)Math.Min(count,length-position);if(count<=0)return 0;source.Position=origin+position;int result=source.Read(buffer,offset,count);position+=result;return result;}
  public override long Seek(long offset,SeekOrigin where){long next=where==SeekOrigin.Begin?offset:where==SeekOrigin.Current?position+offset:length+offset;if(next<0||next>length)throw new IOException("Invalid payload offset");position=next;source.Position=origin+next;return next;}
  public override void Flush(){}public override void SetLength(long value){throw new NotSupportedException();}public override void Write(byte[] b,int o,int c){throw new NotSupportedException();}
}

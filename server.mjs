/** Loopback-only, dependency-free static preview. Not a public hosting server. */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.env.SERVE_DIST === '1' ? 'dist' : '.');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be from 1 to 65535');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const server = http.createServer(async (req,res) => {
  const headers = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':csp,'Cache-Control':'no-store','X-Frame-Options':'DENY'};
  const send = (code,text) => {res.writeHead(code,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':text);};
  if (!['GET','HEAD'].includes(req.method)) return send(405,'Method Not Allowed');
  try {
    const url = new URL(req.url,'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    if(decoded.includes('\0') || decoded.includes('\\')) return send(400,'Invalid path');
    const parts = decoded.split('/').filter(Boolean);
    if(parts.some(p=>p.startsWith('.') || p==='..'))return send(403,'Forbidden');
    const filename=parts.length===0?'index.html':parts.join('/');
    const ext=path.extname(filename);
    if(!Object.hasOwn(mime,ext))return send(404,'Not Found');
    const absolute=path.resolve(root,filename);
    if(!absolute.startsWith(root+path.sep))return send(403,'Forbidden');
    const info=await stat(absolute);
    if(!info.isFile()||info.size>5_000_000)return send(404,'Not Found');
    const content=await readFile(absolute);
    res.writeHead(200,{...headers,'Content-Type':mime[ext],'Content-Length':content.byteLength});res.end(req.method==='HEAD'?'':content);
  }catch{return send(404,'Not Found');}
});
server.listen(port,host,()=>console.log(`ResearchOS TECT at http://${host}:${port}/ (local only)`));

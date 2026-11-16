/** Dependency-free distribution packaging of only the browser assets. */
import { mkdir, cp, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dst=path.join(root,'dist');
await rm(dst,{recursive:true,force:true});await mkdir(dst,{recursive:true});
for(const filename of ['index.html','styles.css'])await copyFile(path.join(root,filename),path.join(dst,filename));
await cp(path.join(root,'src'),path.join(dst,'src'),{recursive:true});
console.log('Browser distribution generated at dist/');

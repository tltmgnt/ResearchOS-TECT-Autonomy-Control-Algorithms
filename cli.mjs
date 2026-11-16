#!/usr/bin/env node
/** Reproducible offline execution. Use only trusted local input study files. */
import { readFile, writeFile } from 'node:fs/promises';
import { analyzeStudy, validateStudy, resultsCSV, markdownReport } from './src/model.mjs';
import path from 'node:path';
const args=process.argv.slice(2);
if(args.length<1||args.length>2){console.error('Usage: node cli.mjs <study.json> [results.json|results.csv|report.md]');process.exitCode=2;}
else{
  try{
    const file=await readFile(args[0]);if(file.length>1_000_000)throw new Error('Study JSON exceeds 1 MB');
    const study=validateStudy(JSON.parse(file.toString('utf8')));
    const output=analyzeStudy(study);
    let content=JSON.stringify(output,null,2)+'\n';
    if(args[1]){
      const ext=path.extname(args[1]).toLowerCase();
      if(ext==='.csv')content=resultsCSV(output);
      else if(ext==='.md')content=markdownReport(study,output);
      else if(ext!=='.json')throw new Error('Output extension must be .json, .csv or .md');
      await writeFile(args[1],content,{flag:'wx',mode:0o600});
      console.log(`Saved ${args[1]}`);
    }else process.stdout.write(content);
  }catch(err){console.error(`Experiment failed: ${err.message}`);process.exitCode=1;}
}

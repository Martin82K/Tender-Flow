// Isolated runtime regression: real electron-updater + loopback fixtures.
// No Electron UI, user profile, installer execution, or remote downloads.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = process.cwd();
const requireDesktop = Module.createRequire(path.join(root, 'desktop/package.json'));
const { NsisUpdater } = requireDesktop('electron-updater');
const { ElectronHttpExecutor } = requireDesktop('electron-updater/out/electronHttpExecutor');
const yaml = requireDesktop('js-yaml');
const originalLoad = Module._load;
Module._load = function(id, parent, isMain) {
  if (id === 'electron') return { app: { isPackaged: true, getVersion: () => '1.9.26' }, ipcMain: { handle() {} } };
  return originalLoad.call(this, id, parent, isMain);
};
class LocalExecutor extends ElectronHttpExecutor {
  createRequest(options, callback) { return http.request({ ...options, agent: false }, callback); }
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-update-runtime-'));
const payload = Buffer.from('Non-executable updater checksum test fixture.');
const hash = crypto.createHash('sha512').update(payload).digest('base64');
let versions = ['1.9.27', '1.10.0'], unavailable = -1, corrupt = false;
const downloaded = [];
const errors = [];
const server = http.createServer((req, res) => {
  const source = req.url.startsWith('/primary/') ? 0 : 1;
  if (source === unavailable) { res.writeHead(404); return res.end('missing'); }
  if (req.url.includes('latest.yml')) {
    res.setHeader('content-type', 'text/yaml');
    return res.end(yaml.dump({version:versions[source],releaseDate:'2026-09-07T00:00:00Z',path:'fixture.exe',sha512:hash,files:[{url:'fixture.exe',sha512:hash,size:payload.length}]}));
  }
  downloaded.push(source);
  res.end(corrupt ? Buffer.from('Corrupted payload') : payload);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const { AutoUpdaterService } = require(path.join(root, 'desktop/dist/services/autoUpdater.js'));
  const reports = [];
  for (const scenario of [
    { name: 'newer legacy', versions: ['1.9.27','1.10.0'], selected: 1 },
    { name: 'equal prefers primary', versions: ['1.9.27','1.9.27'], selected: 0 },
    { name: 'legacy private', versions: ['1.9.27','1.9.28'], unavailable: 1, selected: 0 },
    { name: 'primary unavailable', versions: ['1.9.27','1.9.28'], unavailable: 0, selected: 1 },
    { name: 'bad checksum blocks install', versions: ['1.9.28','1.9.27'], corrupt: true, selected: 0 },
  ]) {
    versions = scenario.versions; unavailable = scenario.unavailable ?? -1; corrupt = !!scenario.corrupt; downloaded.length = 0; errors.length = 0;
    const data = path.join(work, String(reports.length));fs.mkdirSync(data);
    const config = path.join(data, 'app-update.yml');fs.writeFileSync(config, 'updaterCacheDirName: isolated-cache\n');
    const adapter = { version:'1.9.26',name:'isolated-test',isPackaged:true,appUpdateConfigPath:config,userDataPath:data,baseCachePath:data,whenReady:async()=>{},onQuit(){},quit(){throw Error('Must not install')},relaunch(){throw Error('Must not relaunch')} };
    Object.defineProperty(process,'platform',{configurable:true,value:'win32'});
    const sources = ['primary','legacy'].map(name => {
      const updater = new NsisUpdater(undefined, adapter);
      updater.httpExecutor = new LocalExecutor();
      updater.setFeedURL({provider:'generic',url:`${base}/${name}/`});
      updater.disableDifferentialDownload = true; updater.disableWebInstaller = true;
      updater.logger = {info(){},warn(){},error: message => errors.push(message),debug(){}};
      return updater;
    });
    Object.defineProperty(process,'platform',{configurable:true,value:'win32'});
    const service = new AutoUpdaterService(sources);
    Object.defineProperty(process,'platform',platform);
    assert.equal(await service.checkForUpdates(), true);
    await service.downloadUpdate();
    assert.deepEqual(downloaded,[scenario.selected]);
    assert.equal(service.getStatus().status, scenario.corrupt ? 'error' : 'downloaded');
    assert.equal(errors.length, scenario.corrupt || scenario.unavailable !== undefined ? 1 : 0);
    reports.push({scenario:scenario.name,status:service.getStatus().status,downloads:downloaded.slice()});
  }
  console.log(JSON.stringify(reports,null,2));
})().catch(e => {console.error(e);process.exitCode=1}).finally(() => {
  server.close();fs.rmSync(work,{recursive:true,force:true});Module._load=originalLoad;
});

const { SmartSpectraSDK, ProcessingStatus, breathingMetrics, cardioMetrics, faceMetrics } = require('@smartspectra/node-sdk');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
const { ExhaleDetector, BlinkDetector } = require('../signals.cjs');
async function main() {
  if(!process.env.SMARTSPECTRA_API_KEY || !process.argv[2]) throw new Error('Usage: SMARTSPECTRA_API_KEY=… npm run smoke -- /path/to/face.mp4');
  const sdk=new SmartSpectraSDK({apiKey:process.env.SMARTSPECTRA_API_KEY,requestedMetrics:[...breathingMetrics,...cardioMetrics,...faceMetrics],enableTelemetry:false});
  let pulse=false,breathing=false,exhales=0,blinks=0,failed=false,source=null,chestAt=-Infinity,running=false;
  const exhale=new ExhaleDetector(),blink=new BlinkDetector();
  let settle;
  const done=new Promise(resolve=>{settle=resolve;});
  sdk.on('processingStatus',status=>{console.log('processing',status);if(status===ProcessingStatus.kRunning)running=true;if((running && status===ProcessingStatus.kIdle) || status===ProcessingStatus.kError)settle();});
  sdk.on('validationStatus',(code,ts,hint)=>console.log('validation',code,hint));
  sdk.on('error',(code,message)=>{console.error(`SDK error ${code}: ${message}${code===13?' — metric not authorized; use a key with cardio/face access':''}`);failed=true;settle();});
  sdk.on('metrics',buf=>{
    const m=decodeMetrics(buf),upper=m.breathing?.upperTrace||[],lower=m.breathing?.lowerTrace||[];
    if(upper.length)chestAt=Number(upper.at(-1).timestamp)/1000;
    const next=upper.length?'chest':lower.length && Number(lower.at(-1).timestamp)/1000-chestAt>1500?'abdomen':source;
    if(next!==source){exhale.reset();source=next;}
    for(const s of source==='chest'?upper:lower)if(exhale.push(s.value,Number(s.timestamp)/1000)){exhales++;console.log('exhale',exhales);}
    for(const s of m.face?.blinking||[])if(s.stable&&blink.push(s.detected,Number(s.timestamp)/1000)){blinks++;console.log('blink gesture',blinks);}
    for(const s of m.cardio?.pulseRate||[])if(s.confidence>0){pulse=true;console.log(`pulse ${s.value.toFixed(1)} bpm (${s.confidence}% confidence)`);}
    if(m.breathing?.rate?.some(s=>s.confidence>0))breathing=true;
  });
  const timer=setTimeout(()=>{console.error('FAIL: timed out after 180s');failed=true;settle();},180000);
  try {sdk.useFile(require('node:path').resolve(process.argv[2]));sdk.start();await done;}
  finally {clearTimeout(timer);await sdk.destroy();}
  console.log(`Summary: exhales=${exhales}, blinkGestures=${blinks}, pulse=${pulse}, breathing=${breathing}`);
  if(failed||!pulse||!breathing)throw new Error('FAIL: no confident pulse/breathing readings, or SDK error');
  console.log('OK: real SDK pulse and breathing readings appeared');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

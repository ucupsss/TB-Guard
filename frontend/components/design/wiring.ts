import type {Wire} from './engineering';
export function completeWiring():Wire[]{
 const wires:Wire[]=[];
 const add=(id:string,from:string,to:string,signal:string,pin:string)=>wires.push({id,from,to,signal,pin,enabled:true});
 for(let i=0;i<3;i++){
  const m='mic'+i;
  add(m+'-vdd',m,'regulator','VDD → regulated 3.3 V','3V3');add(m+'-gnd',m,'regulator','GND → common ground','GND');
  add(m+'-sck',m,'carrier','SCK → I2S bit clock','I2S_BCLK · GPIO TBD');add(m+'-ws',m,'carrier','WS → I2S frame clock','I2S_WS · GPIO TBD');
  add('audio'+i,m,'carrier','SD → I2S data input',i<2?'DATA_A':'DATA_B');
  add(m+'-lr',m,'regulator','L/R → '+(i===1?'3.3 V (right slot)':'GND (left slot)'),i===1?'3V3':'GND');
 }
 add('oled-vcc','oled','regulator','VCC → supply (confirm OLED module voltage)','3V3 · VERIFY');add('oled-gnd','oled','regulator','GND → common ground','GND');
 add('oled-sda','oled','carrier','SDA → I2C data; pull-up to 3.3 V','I2C_SDA · GPIO TBD');add('oled-scl','oled','carrier','SCL → I2C clock; pull-up to 3.3 V','I2C_SCL · GPIO TBD');
 for(let i=0;i<3;i++){add('switch'+i,'button'+i,'carrier','Switch COM → input; pull-up / debounce required','BUTTON_'+(i+1)+' · GPIO TBD');add('switch'+i+'-gnd','button'+i,'regulator','Switch NO → ground','GND');}
 add('battery-plus','battery','protection','Cell + → protection B+','CELL+');add('battery-minus','battery','protection','Cell − → protection B−','CELL−');
 add('charge-plus','charger','protection','Charger BAT+ → protection P+','PACK+');add('charge-minus','charger','protection','Charger BAT− → protection P−','PACK−');
 add('reg-input','protection','regulator','Protected P+ → regulator VIN','PACK+');add('reg-ground','protection','regulator','Protected P− → regulator GND','GND');
 add('carrier-power','regulator','carrier','Regulated OUT → carrier 3V3 (verify carrier input)','3V3');add('carrier-ground','regulator','carrier','GND → carrier ground','GND');
 add('esp-power','carrier','esp','Carrier 3V3 → WROOM 3V3; local decoupling','3V3');add('esp-ground','carrier','esp','Carrier GND → WROOM GND / exposed pad','GND');
 for(const name of ['I2S_BCLK','I2S_WS','DATA_A','DATA_B','I2C_SDA','I2C_SCL','BUTTON_1','BUTTON_2','BUTTON_3','BUZZER','BAT_ADC'])add('carrier-'+name,'carrier','esp','Carrier net '+name+' → WROOM GPIO; verify schematic',name+' · GPIO TBD');
 add('driver-gpio','carrier','driver','Control GPIO → driver gate/base via suitable resistor','BUZZER · GPIO TBD');add('driver-gnd','driver','regulator','Driver source/emitter → common ground','GND');
 add('buzzer-positive','buzzer','regulator','Buzzer + → rated supply (verify buzzer voltage)','3V3 · VERIFY');add('buzzer-negative','buzzer','driver','Buzzer − → switched sink; flyback if inductive','SWITCHED_RETURN');
 add('sense-input','protection','sense','P+ → divider top resistor','PACK+');add('sense-ground','sense','regulator','Divider bottom → ground; RC filter','GND');add('sense-adc','sense','carrier','Divider midpoint → protected ADC input','BAT_ADC · GPIO TBD');
 return wires;
}
export function wireColor(w:Wire){if(w.pin==='GND'||w.pin==='CELL−'||w.pin==='PACK−')return '#728b9e';if(/3V3|CELL\+|PACK\+/.test(w.pin))return '#ed9c84';if(w.signal.startsWith('SD'))return '#c2a5ee';if(w.signal.startsWith('SCK'))return '#eccb77';if(w.signal.startsWith('WS'))return '#74d8c6';return '#83bce3'}

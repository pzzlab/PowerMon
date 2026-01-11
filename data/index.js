
var Chan = 0, Tmr = 0, Errors = 0, XhrReq = 0, Cyc = 10, Nxtcyc = 10;
var VMin = 0, VMax= 0, WMax = [0,0], Lmin = 0, ClkMin = -1;
var Http , Day = 0, Month = 0, day = 1, month = 1;
 
// 	---- AT OPEN PAGE ----
function EntryPage() 
{Tmr = setTimeout(Cyclic, 100);}				// start cyclic timer

//	---- CYCLIC LOOP ----
function Cyclic()										
{
 // Popup if too many errors
 if (Errors >= 15)	{alert('Too many consecutive errors (15)\n(unstable connection?) Try To Reload Page'); Errors = 0;return;}
 // delay during boot is lower
 if (Cyc >= 10) dly = 500; else dly = 250;
 // expiried idle time after selected day/mon, update log



 // communication hander: write(read) the goto an 
 switch (Cyc)
		{
		 case 0:	// Idle state, do nothing
					break;

		 case 10:	// Read the  Data block 
					NxtCyc = 10;	
					Xhr(250,'Read?Data',true,DecodeData);
					Cyc = 0; 
					break;

		 case 40:	// writing Manual Data, wait until done (nxt cyc is the previous)
					Xhr(250,'Write?Man',false,WriteDone,'',TMan); dly = 500;
					Cyc	 = 0;
					break;

		 case 90:	// Write Command #90 (service) to device (parse MCP msg)
					NxtCyc = 10;
					SendCmd(90);
				    Cyc = 0; 
					break;
						
		}
 // Reload cycic timer
 if (Tmr) clearTimeout(Tmr);	Tmr = setTimeout(Cyclic, dly);
}

function DecodeData(http)	// ---- DECODE AND DISPLAY DATA BLOCK ----
{
 pf=[0,0], am=[0,0], w=[0,0], wr=[0,0], whi=[0,0], who=[0,0], tm=[0,0], wmx=[0,0], 
 el=[0,0], whic=[0,0], whoc=[0,0], dbg=[0,0,0,0,0,0,0,0], valid=false;
 // TClock decoding
 a = new Uint8Array(http.response);	ofs = 0;
 Year	= a.slice(ofs, ofs + 1);	ofs ++;
 Month	= a.slice(ofs, ofs + 1);	ofs ++;
 Day	= a.slice(ofs, ofs + 1);	ofs ++;
 hour	= a.slice(ofs, ofs + 1);	ofs ++;
 min 	= a.slice(ofs, ofs + 1);	ofs ++;
 sec	= a.slice(ofs, ofs + 1);	ofs ++; 
 a = new Uint16Array(http.response);ofs /=2;	
 yday	= a.slice(ofs, ofs + 1);	ofs ++;
 // Temp,Hum,Flags,_
 temp	= a.slice(ofs, ofs + 1);	ofs ++; 	
 hum	= a.slice(ofs, ofs + 1);	ofs ++;
 flags	= a.slice(ofs, ofs + 1);	ofs +=2; 	
 // Mcp.Data
 stat	= a.slice(ofs, ofs + 1);	ofs +=2;
 v		= a.slice(ofs, ofs + 1);	ofs ++;
 VMin  	= a.slice(ofs, ofs + 1);	ofs ++;	
 VMax 	= a.slice(ofs, ofs + 1);	ofs ++;
 hz  	= a.slice(ofs, ofs + 1);	ofs ++;
 a = new Int16Array(http.response);
 pf		= a.slice(ofs, ofs + 2);	ofs +=2;
 a = new Uint16Array(http.response);
 am		= a.slice(ofs, ofs + 2);	ofs +=2;
 w  	= a.slice(ofs, ofs + 2);	ofs +=2; 
 WMax   = a.slice(ofs, ofs + 2); 	ofs +=2; 
 wr		= a.slice(ofs, ofs + 2);	ofs +=2; 
 a = new Uint32Array(http.response);ofs /= 2;
 whi	= a.slice(ofs, ofs + 2);	ofs +=2; 
 who	= a.slice(ofs, ofs + 2);	ofs +=2; 
 a = new Uint16Array(http.response);ofs *= 2;	
 comms	= a.slice(ofs, ofs + 1);	ofs ++; 
 lost	= a.slice(ofs, ofs + 1);	ofs ++; 
 chk   	= a.slice(ofs, ofs + 1);	ofs ++; 
 nack  	= a.slice(ofs, ofs + 1);	ofs ++; 
 time	= a.slice(ofs, ofs + 4);	ofs +=4;
 a = new Uint8Array(http.response);	ofs *= 2;
 ofs += 2; // .hour,.min
 device	= a.slice(ofs, ofs + 1);	ofs ++; 
 valid	= a.slice(ofs, ofs + 1);	ofs ++;
 a = new Uint16Array(http.response); ofs /= 2;
 rssi 	= a.slice(ofs, ofs + 1);	ofs ++;		
 // Data
 wmx	= a.slice(ofs, ofs + 2);	ofs +=2;
 tm		= a.slice(ofs, ofs + 2);	ofs +=2;
 el		= a.slice(ofs, ofs + 2);	ofs +=2; ofs++;	// filler (cmd,_)
 a = new Uint32Array(http.response);ofs /= 2;
 whic	= a.slice(ofs, ofs + 2);	ofs +=2;
 whoc	= a.slice(ofs, ofs + 2);	ofs +=2;
 a = new Uint8Array(http.response);	ofs *= 4;
 deb	= a.slice(ofs, ofs + 12);	ofs +=12;	// filler to 128 bytes (debug)
 
 // filler unused
 
 ClkMin = Number(min);
 
 // update the datetime,temp and hum.
 document.getElementById('dat' ).innerHTML = Day  + "-" + Month + "-" + (Number(Year) + Number(1900));
 document.getElementById('tim' ).innerHTML = hour + ":" + min.toString().padStart(2,'0') + "." + Number(sec).toString().padStart(2,'0');
 document.getElementById('temp').innerHTML = (temp/10).toFixed(1) + "\xb0C";  
 document.getElementById('hum' ).innerHTML = hum + "%";
 // Show the runtime data if recognized
 if (valid && ((device == '65') || (device == '78')))	
  {
   	// enable CH0-1
	document.getElementById('ch0').disabled = false; 
   	if (device == '78') {document.getElementById('ch1').disabled = false;}
	if (Chan >= 0)
		{
		document.getElementById('volt').innerHTML 	= (v/10).toFixed(1);
		document.getElementById('hz'  ).innerHTML 	= (hz/1000).toFixed(1);
		document.getElementById('pf'  ).innerHTML	= (pf[Chan]  / 32767).toFixed(2);
		document.getElementById('a'	  ).innerHTML	= (am[Chan]  / 1000).toFixed(3);
		document.getElementById('w'	  ).innerHTML	= (w[Chan]   / 10).toFixed(1);
		document.getElementById('wmx' ).innerHTML	= (wmx[Chan] / 10).toFixed(1);
		document.getElementById('tm'  ).innerHTML	= (tm[Chan]  >> 8) + ":" + (tm[Chan] & 0x7f) .toString().padStart(2,'0')
		document.getElementById('t'	  ).innerHTML	= (el[Chan]  / 60).toFixed(0) + ":" + (el[Chan] % 60) .toString().padStart(2,'0')
		document.getElementById('ei'  ).innerHTML	= (whic[Chan] / 1000).toFixed(2);
		document.getElementById('eo'  ).innerHTML	= (whoc[Chan] / 1000).toFixed(2);
		}
  } 
//  else		
//   {document.getElementById('dvhz').innerHTML = '** Unknown Device **';}

  Cyc = NxtCyc;
} 


function SetChan(n)	// ---- SET CHANNEL ----
{
 Chan = n; document.getElementById('ch'+n+1).checked = true;
}

function WhKwh(v)
{
 if (Math.abs(v) >= 1000) 	v = (v/1000).toFixed(3).padStart(8,' ') + 'Kwh'; 
  else 						v = Number(v).toFixed(3).padStart(8,' ') + 'Wh';
 return(v);
}


//	---- COMMONS ----
// callback of any write data , return back to ciclic call state
function WriteDone(http)  {Cyc = NxtCyc;}	

// send a cmd?with number and argument
function SendCmd(cmd,arg)								
{
 if (cmd == 90)	// service command
   {		
 	txt = document.getElementById('cmd').value.toLowerCase();
	hist = document.getElementById("hlog");
	opt = document.createElement("option"); opt.text = txt; hist.add(opt,0);
	Xhr(2000,'Cmd?90',false,CmdResp,false,txt);
	}
	 else 	    // generic command (Cmd?cmd=arg)
	Xhr(250,'Cmd?'+ cmd, false,WriteDone,false,arg); 
}

// callback of SendCmd (90)
function CmdResp(http)  						
{
 resp = document.getElementById("hresp");
 opt = document.createElement("option"); 	   opt.text = http.responseText; resp.add(opt,0);	
 document.getElementById('cmd').value = "";   Cyc = NxtCyc;
}


// 	---- XMLHttpReq GENERIC ----
function Xhr(tmt,cmd,binary,callback,param,value)
{
 if ((http = new XMLHttpRequest()) != null)
  {
    XhrReq++; if (value != undefined) cmd += '=' + value;
	http.timeout = tmt * 4; http.responseType = '';
	http.open("GET", cmd, true); if (binary) http.responseType = 'arraybuffer';
	http.onloadend = function ()	
		{if (!http.status) return;  Cyc = NxtCyc; Errors = 0; if (callback && (http.status == 200))	callback(http,param);}
	http.ontimeout = function ()  
		{Cyc = NxtCyc; Errors++; console.log('Timeout');}
	if (value != undefined)		http.send(value); 
	 else						http.send(); 
 }
 return(true);
}

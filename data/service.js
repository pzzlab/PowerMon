var Tmr, Errors = 0, XhrReq = 0, Cyc = 10, Nxtcyc = 10, EveryN = 0, Auth = 0, VMin = 0, VMax= 0;
var Http , NewHostName = '', ReloadPage = 0, Device = '';
 
// 	---- AT OPEN PAGE ----
function EntryPage()								
{
 document.getElementById('hlp').checked = false;
 document.getElementById('regs').checked = false;
 Tmr = setTimeout(Cyclic, 100);				// start cyclic timer
}

//	---- CYCLIC LOOP ----
function Cyclic()										
{
 // Popup if too many errors
 if (Errors >= 15)	{alert('Too many consecutive errors (15)\n(unstable connection?) Try To Reload Page'); Errors = 0;return;}
 // delay during boot is lower
 if (Cyc >= 10) dly = 500; else dly = 250;
 // delay to reloag with new hostname
 if (ReloadPage) {ReloadPage--; if (!ReloadPage) window.location.hostname = NewHostName;}

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
 pf=[0,0], am=[0,0], w=[0,0], wr=[0,0], el=[0,0], dbg=[0,0,0,0,0,0,0,0], valid=false;
 // TClock decoding
 a = new Uint16Array(http.response);ofs = 6;
 flags	= a.slice(ofs, ofs + 1);	ofs +=2; 	
 // Mcp.Data
 stat	= a.slice(ofs, ofs + 1);	ofs +=2;
 v		= a.slice(ofs, ofs + 1);	ofs +=3;
 hz  	= a.slice(ofs, ofs + 1);	ofs ++;
 a = new Int16Array(http.response);
 pf		= a.slice(ofs, ofs + 2);	ofs +=2;
 a = new Uint16Array(http.response);
 am		= a.slice(ofs, ofs + 2);	ofs +=2;
 w  	= a.slice(ofs, ofs + 2);	ofs +=14; 
 comms	= a.slice(ofs, ofs + 1);	ofs ++; 
 lost	= a.slice(ofs, ofs + 1);	ofs ++; 
 chk   	= a.slice(ofs, ofs + 1);	ofs ++; 
 nack  	= a.slice(ofs, ofs + 1);	ofs ++; 
 time	= a.slice(ofs, ofs + 4);	ofs +=4;
 a = new Uint8Array(http.response);	ofs *= 2;
 ofs += 2; // .hour,.min
 Device	= a.slice(ofs, ofs + 1);	ofs ++; 
 valid	= a.slice(ofs, ofs + 1);	ofs ++;
 a = new Int16Array(http.response); ofs /= 2;
 rssi 	= a.slice(ofs, ofs + 1);	ofs +=16;		
 a = new Uint8Array(http.response);	ofs *= 2;
 deb	= a.slice(ofs, ofs + 12);	ofs +=12;	// filler to 128 bytes (debug)
 
 // filler unused
 Auth  	= flags & 0x3;	// copy Ws::Auth(copied into Data) to JS var
 
 
 // Show the runtime data if recognized
 if (valid && ((Device == '65') || (Device == '78')))	
  {
   document.getElementById('dvhz').innerHTML = 'Mcp39F511' + String.fromCharCode(Device) + '&nbsp&nbsp&nbsp'
   											 + (v/10).toFixed(1) + 'V / ' + (hz/1000).toFixed(2) + 'Hz';
   // Show the runtime data
   for (i = 0; i < 2; i++)
     {
	  document.getElementById('pf'	+ Number(i)).innerHTML	= (pf[i]  / 32767).toFixed(2);
	  document.getElementById('a'	+ Number(i)).innerHTML	= (am[i]  / 1000).toFixed(3);
	  document.getElementById('w'	+ Number(i)).innerHTML	= (w[i]   / 10).toFixed(1);
	 }
  } 
  else		{document.getElementById('dvhz').innerHTML = '** Unknown Device **';}
 // Counters
 document.getElementById('dbgcomm').value = 'Comm(Err) ' + XhrReq  + '(' + Errors + '); Req(Lost,Chk,Nack) ' 
										  + comms + '(' + lost + ',' + chk + ',' + nack +') RSSI '+ rssi;
  Cyc = NxtCyc;
} 


// Confirmation for clear log
function EeErase()	{if (confirm('Are You Sure to clear ALL energy data stored into device?')) SendCmd(3,0);}

// 	---- SERVICE ----
// hlog.OnClick copy content to Cmd
function HClick(idx)								
{
 h 	 =	document.getElementById("hlog");
 txt = h.options[h.selectedIndex].text;
 c	 = document.getElementById('cmd');
 c.value = txt; c.focus();
}


// Cmd.OnKeyDown, send the arg. on Cmd
function CmdKdn()	
{
 txt = document.getElementById('cmd').value;
 if (txt.substr(0,6) == 'hostn=')	{ChangeHostName(txt.substr(6)); return;}
  else 								Cyc = 90;
}

// OnKeyDown host input, change the hostname
function ChangeHostName(newname)	
{
 // check if newname is a valid hostname
 if (newname.length < 3) {alert('Hostname too short'); return;}
 for (i = 0; i < newname.length; i++)
	{	
	 c = newname.charCodeAt(i);
	 if ((c != 45) && ((c < 48) || (c > 57 && c < 97)  || (c > 122)))
		{alert('Only a..z chars and - permitted'); return;}
	}
 if (confirm ('Are You Sure to change the actual hostname to ' + newname + '?\n(You will be disconnected)')
  && confirm ('Are You Really Sure to change?\n(the operation cannot be undone)\n'
              +'after some seconds the device will reconnect with new name'))	
{ SendCmd(11,newname); NewHostName = newname; ReloadPage = 50;}				// start timer to reload page
}	

// Show/Hide help window
function Help(wich)									
{
 switch (wich)
		{
	 	 case 'h':	// help commands
					txt = document.getElementById('htxt'); chk = document.getElementById('hlp');
					
					
					if (chk.checked) 
						{
						 RdTxtFile('HLP.txt',txt);	
						 txt.style.display = 'block';
						}
					 else			 txt.style.display = 'none'; 
					break;
		 case 'r':	// help regs
					txt = document.getElementById('rtxt'); chk = document.getElementById('regs');
					if (chk.checked) 
					 {
 					  if (Device == '65') 	RdTxtFile('MCP39F511A.def',txt);
					   else
						if (Device == '78') RdTxtFile('MCP39F511N.def',txt);
						 else				txt.innerText = "Unknown Device";
					  txt.style.display = 'block';
					 }
					 else					txt.style.display = 'none'; 
					break;
			}
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
 document.getElementById("hresp").value = http.responseText;
 //opt = document.createElement("option"); 	   opt.text = http.responseText; resp.add(opt,0);	
 document.getElementById('cmd').value = "";   Cyc = NxtCyc;
}

// Get a text FILE and display on OUT (textarea)
function RdTxtFile(file, out)				
{
 var rawFile = new XMLHttpRequest();
 rawFile.open("GET", file, false);
 rawFile.onreadystatechange = function ()
 {
  if (rawFile.readyState === 4)
     {
	  if(rawFile.status === 200 || rawFile.status == 0)	{out.value = rawFile.responseText;}
     }
 }
 rawFile.send(null);
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

const NMIN = 15; 
Months = [31,28,31,30,31,30,31,31,30,31,30,31];
var Tmr, Errors = 0, XhrReq = 0, Cyc = 10, NxtCyc = 10, Dly = 500;
var Chart, Wh = [0], VMin = 0, VMax= 0, WMax = [0,0], X = 0, Y = 0, Lmin = -1,  ClkMin = -1, LogIdx = 0;
var Http , Day = 0, Month = 0, day = 1, month = 1, GetLog = 0, Chan = 0;
 
// 	---- AT OPEN PAGE ----
function EntryPage()								
{
 Chart = document.getElementById('chart').getContext('2d'); 
 Tmr = setTimeout(Cyclic, 100);				// start cyclic timer
 GetLog = -1;								// Force to read at first cycle after scan
}

//	---- CYCLIC LOOP ----
function Cyclic()										
{
 // Popup if too many errors
 if (Errors >= 15)	{alert('Too many consecutive errors (15)\n(unstable connection?) Try To Reload Page'); Errors = 0;return;}
 // expiried idle time after selected day/mon, update log
 
 
 // communication hander: write(read) the goto an 
 switch (Cyc)
		{
		 case 0:	// Idle state, do nothing
					break;

		 case 10:	// Read the  Data block then display chart
		 			NxtCyc = 10;	
		 			if (GetLog > 0)	{GetLog--; if (!GetLog) {Cyc = 20; break;}}
					// update log @ every 5 minutes reforcing actual date
					if ((Lmin != ClkMin) && !(ClkMin % 5))
						{Lmin = ClkMin; NavigateLog(0);}
					Xhr(250,'Read?Data',true,DecodeData);
					Cyc = 0; 
					break;

		 case 20:	// Write Command #2 LogIdx codified as byte with month << 8 + day
					NxtCyc = 30;
//					document.getElementById('msg').value  = "Send Date";
					SendCmd(10,LogIdx);
					Cyc = 0; 
					break;

 		 case 30:	// Read the Data block and display chart
					NxtCyc = 10;	
//					document.getElementById('msg').value  = "Loading...";
					Xhr(250,'Read?Log',true,DecodeLog);
					Cyc = 0; 
					break;

		}
 // Reload cycic timer
 if (Tmr) clearTimeout(Tmr);	Tmr = setTimeout(Cyclic, Dly);
}

function DecodeData(http)	// ---- DECODE AND DISPLAY DATA BLOCK ----
{
 var month,day,clkmin;
 // TClock decoding (skip year, read obly month and day)
 a = new Uint8Array(http.response);	ofs = 1;
 month	= a.slice(ofs, ofs + 1);	ofs ++;
 day	= a.slice(ofs, ofs + 1);	ofs += 2;
 clkmin	= a.slice(ofs, ofs + 1);	ofs += 78;
// get device type
 device = a.slice(ofs, ofs + 1);	ofs += 1;
 Month = Number(month); Day = Number(day); ClkMin = Number(clkmin);
 document.getElementById('ch0').disabled = false; 
 if (device == '78') {document.getElementById('ch1').disabled = false;}

 // start reading log at first cycle after scan
 if (GetLog == -1) NavigateLog(0);
 Cyc = NxtCyc;
} 


function DecodeLog(http)	// ---- DECODE AND DISPLAY Log structure ----
{
 Http = http;		// save for later use
 PlotChart();		
 Cyc	= NxtCyc;	// return to cyclic state
} 

// 	---- LOG AND GRAPH ----
function NavigateLog(idx)						
{
 if (!idx) {day = Day; month = Month;}			// get actual
 day += Number(idx);							// uses local static
 if (day > Months[month-1]) {day = 1; month++;}
  else if (day <= 0) {month--; if (month <= 0) month = 12; day = Months[month-1]; }
 if (month > 12) month = may = 1;
 if (month <= 0) {month = 12; day = 1;}
 LogIdx = month * 256 + day;	
 X = undefined;							
 document.getElementById('isdy').innerHTML = String(day + '/' + month);
 GetLog = 2;									// idle time for other button selected 
} 

// callback of canvas "onclick"
function ChartClick() 							
{
 rect = Chart.canvas.getBoundingClientRect();
 X = window.event.clientX - rect.left; Y = window.event.clientY - rect.top;
 PlotChart();  
}

function WhKwh(v,len)
{
 if (Math.abs(v) >= 1000) 	v = (v/1000).toFixed(3).padStart(len,' ') + 'Kwh'; 
  else 						v = Number(v).toFixed(0).padStart(len,' ') + 'Wh';
 return(v);
}

// Plot the chart on the canvas
function PlotChart()								
{
 if (Http == undefined) return;
 wht = 0, wmax = 0,tm = [0,0,0,0], y = 0;
 // TClock decoding
 a = new Uint8Array(Http.response); ofs = 0;
 mo		= a.slice(ofs, ofs + 1);	ofs ++;
 dy		= a.slice(ofs, ofs + 1);	ofs ++;
 a = new Uint16Array(Http.response);ofs /=2;	
 vmin  	= a.slice(ofs, ofs + 1);	ofs ++;	
 vmax 	= a.slice(ofs, ofs + 1);	ofs ++;
 wmax	= a.slice(ofs, ofs + 1); 	ofs +=2; 
 tm		= a.slice(ofs, ofs + 4);	ofs +=4;  	// minmax time
 ofs +=55; 	// unused filler
 a = new Int16Array(Http.response);	
 Wh	    = a.slice(ofs, ofs + 192);				// log records [96[2]]
// normalize the values to +/-32767 (-1 will be zero)
 for (i = Chan; i < 192; i+=2) {if (Wh[i] < 0) Wh[i]++;}

 if (Wh == undefined) return;
 k = 0; grd = 24; maxidx = 192; maxidx2 = maxidx / 2;
 awh = 0, max = 1, scy = 0;
 h = Chart.canvas.clientHeight;  w = Chart.canvas.clientWidth; 
 dx = Math.floor(w / maxidx2);	xlim = maxidx2 * dx; 	dg = Math.floor(xlim / grd); 
 Chart.canvas.fillStyle = 'black';		Chart.clearRect(0,0,Chart.canvas.clientWidth, h * 2);
 // scan to calc max values 
 for (i = Chan; i < maxidx; i+=2) 
   {awh = Math.abs(Wh[i]); if (max < awh) max = awh; wht += Wh[i];}
 // calc.y scaling then plot bars
 scy = (h-2) / max;
 xlim -= dx; if (X < 0) X = 0; if (X > xlim) X = xlim;
 idx = Math.floor(X / dx) * 2; // *2 because samp * 2
 cx = undefined; v = 0;
 // plot bars
 for (x = 0, i = Chan; i < maxidx; i+=2, x += dx)
  {
   awh = -Math.abs(Wh[i]) * scy; 
   if (i == idx)		{Chart.fillStyle = 'gray'; cx = x + 1; v = Wh[i];}
    else				 
	 if (Wh[i] > 0)		 Chart.fillStyle = 'red';
	  else				 Chart.fillStyle = 'green'; 
	   Chart.fillRect(x, h, dx, awh);
  }

 Chart.font = '14px arial'; Chart.textAlign = 'center'; Chart.fillStyle = 'yellow';		
 // plot the grid labels	
 for (g = dg, i = 1; i < grd; i++, g += dg)	Chart.fillText(i+k,g,h -2);
 t = ''; idx /= 2;	// natural index value	
 if (cx)
  {	
   n  = idx * NMIN; 
   m  = Math.floor(n % 60); 
   hr = Math.floor(n / 60);
   t  = String(hr) + '.' + String(m).padStart(2,'0');
   if (m == 45) {hr++; m = -15;}
   t += '->' + hr + '.' +String(m + NMIN).padStart(2,'0') + ':' + WhKwh(v,4);
   g = idx * dx;
   y = h - Math.abs(Wh[idx * 2 + Chan]) * scy;
   if (y > h - 14) y = h - 14;
    else if (y < 14) y = 14;
   tw = Chart.measureText(t).width;
   if (cx < tw)Chart.textAlign = 'left'; 
    else 
 	 if (cx + tw >= w)	Chart.textAlign = 'right';
   Chart.fillText(t,cx,y);
   }
  
 dt  = 'Day: ' + dy + '/' + mo ;
 txt = dt + '\t'
 	 + 'Vmin ' + (vmin / 10).toFixed(1).padStart(4,' ') 
	 + 'V  (' + (tm[0] >> 8).toString() + '.' + (tm[0] & 0x7f).toString().padStart(2,'0') + ')\t'
	 + '\t Vmax ' + (vmax / 10).toFixed(1).padStart(4,' ')
	 + 'V  (' + (tm[1] >> 8) + '.' + (tm[1] & 0x7f).toString().padStart(2,'0') + ')'
 txt += '\tTot'+ WhKwh(wht,8);
 e   = WhKwh(max,8); txt += '\t Max ' + e;
 txt += '\t PMax ' + Number(wmax/10000).toFixed(3).padStart(7,' ') 
	 + 'Kw  (' + (tm[2+Chan] >> 8).toString().padStart(2,' ') + '.' + (tm[2+Chan] & 0x7f).toString().padStart(2,'0') + ')'
 Chart.textAlign = 'left'; 
 if (y < 28) Chart.fillText(txt,4,h-28); else Chart.fillText(txt,4,14);
}

function SetChan(n)	// ---- SET CHANNEL ----
{
 Chan = n; document.getElementById('Chan'+n+1).checked = true;
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

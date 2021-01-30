/** Added in addition to original Node-Red source, for audio system visualization
 * this file is intended to work as an interface between Node-Red flow and Arduino
 * vim: set ts=4:
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
RED.arduino = (function() {
	var serverIsActive = false;
	
    var defSettings = {
        useExportDialog: false,
		IOcheckAtExport: true,
		WriteJSONtoExportedFile: true,
		WebServerPort: 8080,
		WebSocketServerPort: 3000,
        ProjectName: "TeensyAudioDesign",
        Board: {},
		CodeIndentations: 4,
		StandardIncludeHeader: "#include <Arduino.h>\n"
							  +	"#include <Audio.h>\n"
							  + "#include <Wire.h>\n"
							  + "#include <SPI.h>\n"
							  + "#include <SD.h>\n"
                              + "#include <SerialFlash.h>\n",
                              
                
    }
    // Object.assign({}, ) is used to ensure that the defSettings is not overwritten
	var _settings = {
		useExportDialog: defSettings.useExportDialog,
		IOcheckAtExport: defSettings.IOcheckAtExport,
		WriteJSONtoExportedFile: defSettings.WriteJSONtoExportedFile,
		WebServerPort: defSettings.WebServerPort,
		WebSocketServerPort: defSettings.WebSocketServerPort,
        ProjectName: defSettings.ProjectName,
        Board: {Platform: "", Board: "", UsbType: "", CpuSpeed: "", Optimize: "", Keyboard: "",},
        
		CodeIndentations: defSettings.CodeIndentations,
		StandardIncludeHeader: defSettings.StandardIncludeHeader,
    }
    var boardSettings = { 
        get Platform() { return _settings.Board.Platform; },
        set Platform(value) { _settings.Board.Platform = value; RED.storage.update(); },

        get Board() { return _settings.Board.Board; },
        set Board(value) { _settings.Board.Board = value; RED.storage.update(); },

        get UsbType() { return _settings.Board.UsbType; },
        set UsbType(value) { _settings.Board.UsbType = value; RED.storage.update();},

        get CpuSpeed() { return _settings.Board.CpuSpeed; },
        set CpuSpeed(value) { _settings.Board.CpuSpeed = value; RED.storage.update();},

        get Optimize() { return _settings.Board.Optimize; },
        set Optimize(value) { _settings.Board.Optimize = value; RED.storage.update();},

        get Keyboard() { return _settings.Board.Keyboard; },
        set Keyboard(value) { _settings.Board.Keyboard = value; RED.storage.update(); },
    }
	var settings = {
		get useExportDialog() { return _settings.useExportDialog; },
		set useExportDialog(state) { _settings.useExportDialog = state; RED.storage.update();},

		get IOcheckAtExport() { return _settings.IOcheckAtExport; },
		set IOcheckAtExport(state) { _settings.IOcheckAtExport = state; RED.storage.update();},

		get WriteJSONtoExportedFile() { return _settings.WriteJSONtoExportedFile; },
		set WriteJSONtoExportedFile(state) { _settings.WriteJSONtoExportedFile = state; RED.storage.update();},

		get WebServerPort() { return parseInt(_settings.WebServerPort); },
		set WebServerPort(value) { _settings.WebServerPort = parseInt(value);RED.storage.update(); },

		get WebSocketServerPort() { return parseInt(_settings.WebSocketServerPort); },
		set WebSocketServerPort(value) { _settings.WebSocketServerPort = parseInt(value); StartWebSocketTerminal_Connection(); RED.storage.update();},

		get ProjectName() { return _settings.ProjectName; },
		set ProjectName(value) { _settings.ProjectName = value;  RED.storage.update(); RED.main.updateProjectsMenu();},

		get CodeIndentations() { return parseInt(_settings.CodeIndentations); },
		set CodeIndentations(value) { _settings.CodeIndentations = parseInt(value); RED.storage.update();},

		get StandardIncludeHeader() { return _settings.StandardIncludeHeader; },
        set StandardIncludeHeader(value) { _settings.StandardIncludeHeader = value; RED.storage.update();},
        
        get Board() { return boardSettings; },
        set Board(value) { boardSettings = value; console.error(" set boardSettings(value)");},

	};

	var settingsCategory = { label:"Arduino", expanded:false, popupText: "Currently only Arduino Export Settings", bgColor:"#006468", headerBgColor:"#17A1A5", headerTextColor:"#FFFFFF", menuItems:[{label:"saveSettingsEditorAsJson",iconClass:"fa fa-copy", action:saveSettingsEditorAsJson}] };

	var settingsEditor = {
		export: {label:"Export", expanded:true, bgColor:"#17A1A5",
			items: {
                servers: {label:"Server settings", expanded:false, bgColor:"#006468", 
                    items: {
                        WebServerPort:           { label:"Web Server Port", type:"number"},
				        WebSocketServerPort:     { label:"Terminal Capture Web Socket Server Port", type:"number"},
                    },
                },
                board: {label:"Board settings", expanded:false, bgColor:"#006468", 
                    items: {
                        "Board.Platform":           { label:"Platform", type:"combobox", options:["teensy", "arduino", "esp"], optionTexts:["Teensy", "Arduino", "Espressif"], popupText:"currently only teensy is supported,<br> as there is no real interface<br>to upload the different boards.txt files needed" },
                        uploadBoardsFile:        { label:"Upload Boards File", type:"button", isFileInput:true, buttonClass:"btn-primary btn-sm", action: uploadBoardFileCurrentPlatform},
                        "Board.Board":           { label:"Board", type:"combobox", options:["teensy30", "teensy40", "teensy41"], optionTexts:["Teensy 3.0", "Teensy 4.0", "Teensy 4.1"] },
                        options: {label:"Options", expanded:true, bgColor:"#17A1A5", 
                            items: {
                                "Board.UsbType":         { label:"USB Type", type:"combobox", options:["Serial", "Midi"], popupText: "this is just a demo and have no functionality" },
                                "Board.CpuSpeed":        { label:"CPU Speed", type:"combobox", options:["600", "500"] , popupText: "this is just a demo and have no functionality"},
                                "Board.Optimize":        { label:"Optimize", type:"combobox", options:["o2std", "osstd"], optionTexts:["Faster", "Smallest Code"], popupText: "this is just a demo and have no functionality"},
                                "Board.Keyboard":        { label:"Keyboard Layout", type:"combobox", popupText: "this is just a demo and have no functionality"},
                            },
                        },
                    },
                },
				useExportDialog:         { label:"Force Show export dialog", type:"boolean"},
				IOcheckAtExport:         { label:"IO check At Export", type:"boolean"},
				WriteJSONtoExportedFile: { label:"Write JSON at exported file", type:"boolean"},
				
				CodeIndentations:        { label:"export code indentations", type:"number", popupText: "Defines the 'base' number of indentations that is used when exporting to class structure."},
				ProjectName:             { label:"Project Name", type:"string", popupText: "Project Name is used as the default file names for zip-file export and JSON-save to file.<br>"+
																						"It's also used at the default savename for the autosave function,<br>when replacing the whole design with a template design.<br>"+
																						"<br>When naming a tab with  [ProjectName].ino (not including the []),<br>that defines it's the main ino-file when it's exported to Arduino IDE."},
				StandardIncludeHeader:   { label:"Global Includes", type:"multiline", popupText: "Here is the global export includes<br>This text is included at the top of every autogenerated code-file"},
			}
		},
		
    };

    function uploadBoardFileCurrentPlatform(e)
    {
        var file = e.target.files[0];
		if (!file) {
		  return;
        }
        var reader = new FileReader();
		reader.onload = function(e) {
          var contents = e.target.result;
          console.warn(file);
          RED.arduino.boardsParser.writeToIndexedDB(settings.Board.Platform + "." + file.name, contents);
		};
        reader.readAsText(file);
    }
    
    function saveSettingsEditorAsJson() {
        RED.main.download("arduino.settingsEditor.json", JSON.stringify(settingsEditor, null, 4));
    }

	function startConnectedChecker()
	{
		checkIfServerIsActive(); // run once first
		window.setInterval(function () {
			checkIfServerIsActive();
	    }, 10000);
	}
	function checkIfServerIsActive()
	{
		httpGetAsync("cmd=ping", 
			function(rt) {
				serverIsActive = true;
				//console.log("serverIsActive" + rt);
			},
			function(st) {
				serverIsActive = false;
				//console.log("serverIsNotActive" + st);
			});
	}

    function httpPostAsync(data)
	{
		const t0 = performance.now();
		var xhr = new XMLHttpRequest();
		//console.warn("httpPostAsync:" + data);
		const url = 'http://localhost:' + settings.WebServerPort;
		xhr.open("POST", url, true);
		xhr.onloadend = function () {
			console.warn("response:" + xhr.responseText);
			const t1 = performance.now();
			console.log('httpPostAsync took: ' + (t1-t0) +' milliseconds.');
		  };
		xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		xhr.timeout = 2000;
		xhr.send(data); 
	}
	function httpGetAsync(queryString, cbOnOk, cbOnError)
	{
		var xmlHttp = new XMLHttpRequest();
		const url = 'http://localhost:' + settings.WebServerPort;
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState != 4) return; // wait for timeout or response
			if (xmlHttp.status == 200)
			{
				if (cbOnOk != undefined)
					cbOnOk(xmlHttp.responseText);
				else
					console.warn(cbOnOk + "response @ " + queryString + ":\n" + xmlHttp.responseText);
			}
			else if (cbOnError != undefined)
				cbOnError(xmlHttp.status);
			else
				console.warn(queryString + " did not response = " + xmlHttp.status);
		};
		xmlHttp.open("GET", url + "?" + queryString, true); // true for asynchronous 
		xmlHttp.timeout = 2000;
		xmlHttp.send(null);
	}

	var wsClientTerminal;
    function StartWebSocketTerminal_Connection()
    {
		if (!('WebSocket' in window)){ console.error('Upgrade your browser. This Browser is NOT supported WebSocket (used by terminal capture)'); return;}

		if (wsClientTerminal != null)
			wsClientTerminal.close();
		wsClientTerminal = new WebSocket("ws://127.0.0.1:" + settings.WebSocketServerPort);
		wsClientTerminal.onmessage = function (msg) {
			if (msg.data == 'reload') window.location.reload();
			else
			{
				//console.log(msg.data);
				RED.bottombar.show('output'); // '<span style="color:#000">black<span style="color:#AAA">white</span></span>' + 
				var dataToAdd = msg.data.replace('style="color:#FFF"', 'style="color:#000"');//.replace("[CR][LF]", "<br>").replace("[CR]", "<br>").replace("[LF]", "<br>");
				//console.warn(dataToAdd);
				RED.bottombar.info.addContent(dataToAdd);
			}
		};
		wsClientTerminal.onopen = function (ev) {
			RED.bottombar.info.setContent("");
		};
	}
	

    $('#btn-verify-compile').click(function() {RED.bottombar.info.setContent(""); httpGetAsync("cmd=compile"); });
	$('#btn-compile-upload').click(function() {RED.bottombar.info.setContent(""); httpGetAsync("cmd=upload"); });
	//$('#btn-get-design-json').click(function() { httpGetAsync("cmd=getFile&fileName=GUI_TOOL.json", GetGUI_TOOL_JSON_response,NOtresponse); });
	$('#btn-get-design-json').click(function() { httpGetAsync("cmd=getFile&fileName=GUI_TOOL.json", GetGUI_TOOL_JSON_response,NOtresponse); });
	function GetGUI_TOOL_JSON_response(responseText) { RED.storage.loadContents(responseText); }
	function NOtresponse(text) {console.log("GetGUI_TOOL_JSON_ not response"); }
    
    return {
        defSettings:defSettings,
		settings:settings,
		settingsCategory:settingsCategory,
        settingsEditor:settingsEditor,
        
        serverIsActive: function() { return serverIsActive;},
		startConnectedChecker:startConnectedChecker,
		httpPostAsync:httpPostAsync,
		httpGetAsync:httpGetAsync,
		StartWebSocketConnection:StartWebSocketTerminal_Connection,
	};
})();
/* public domain
 * vim: set ts=4:
 */

RED.storage = (function() {
	function update() {
		RED.addClassTabsToPalette(); //Jannik
		RED.refreshClassNodes(); //Jannik
		// TOOD: use setTimeout to limit the rate of changes?
		if (localStorage) {
			var nns = RED.nodes.createCompleteNodeSet();
			localStorage.setItem("audio_library_guitool", JSON.stringify(nns));
			console.log("localStorage write");
			
		}
	}
	function load() {
		if (localStorage) {
			var data = localStorage.getItem("audio_library_guitool");
			console.log("localStorage read");// + data);
			if (data) RED.nodes.import(data, false);
			else
				RED.nodes.createNewDefaultWorkspace();
		}
	}
	function loadFile(data) {
		console.log("loadFile:" +data);
		localStorage.setItem("audio_library_guitool", data);
		window.location.reload();
		
				
	}
	function clear() {
		// TOOD: use setTimeout to limit the rate of changes?
		if (localStorage) {
			localStorage.removeItem("audio_library_guitool");
			//console.log("localStorage write");
		}
	}
	return {
		update: update,
		load: load,
		loadFile:loadFile,
		clear: clear
	}
})();

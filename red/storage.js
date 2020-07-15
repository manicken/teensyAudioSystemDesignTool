/* public domain
 * vim: set ts=4:
 */

RED.storage = (function() {
	function update() {
		RED.nodes.addClassTabsToPalette(); //Jannik
		RED.nodes.refreshClassNodes(); //Jannik
		
		// TOOD: use setTimeout to limit the rate of changes?
		// (Jannik say that is not needed because it's better to save often, not to loose any changes)
		// it's only needed when we move objects with keyboard, 
		// but then the save timeOut should be at keyboard move function not here.
		// TODO: save when using keyboard to move nodes.
		
		if (localStorage)
		{
			var nns = RED.nodes.createCompleteNodeSet();
			localStorage.setItem("audio_library_guitool",JSON.stringify(nns));
			console.log("localStorage write");
		}
	}
	function allStorage() {

		var archive = [],
			keys = Object.keys(localStorage),
			i = 0, key;
	
		for (; key = keys[i]; i++) {
			archive.push( key + '=' + localStorage.getItem(key));
		}
	
		return archive;
	}
	function load() {
		if (localStorage) {
			console.warn(allStorage());
			var data = localStorage.getItem("audio_library_guitool");
			console.log("localStorage read: " );//+ data);
			if (data)
				RED.nodes.import(data, false);
			else
				RED.nodes.createNewDefaultWorkspace();
		}
	}
	function loadFile(data) {// TODO: rename to loadContents
		console.log("loadFile:" +data);
		localStorage.setItem("audio_library_guitool", data);
		window.location.reload();
		
				
	}
	function clear() {
		// TOOD: use setTimeout to limit the rate of changes?
		if (localStorage)
		{
			localStorage.removeItem("audio_library_guitool");
			//console.log("localStorage write");
		}
	}
	return {
		update: update,
		load: load,
		loadFile:loadFile, // TODO: rename to loadContents
		clear: clear
	}
})();

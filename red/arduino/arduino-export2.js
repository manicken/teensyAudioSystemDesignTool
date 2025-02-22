
/** this file is only for developing the new export system
 * and it's structure may change drastically
 */

RED.arduino.export2 = (function () {
    'use strict';
    /** @type {CompleteExport} */
    var currentExport = {};

    function init() // called from main.js @ init()
    {
        RED.main.SetPopOver("#menu-export2", "(under development<br>this is gonna be the new export when completed)", "right");
        RED.main.SetPopOver("#btn-export-simple2", "(under development)", "right");
        RED.main.SetPopOver("#btn-export-class2", "(under development)", "right");
        RED.main.SetPopOver("#btn-export-class-dev2", "(development test only)", "right");
        RED.main.SetPopOver("#btn-export-class-zip2", "(under development)", "right");
        RED.main.SetPopOver("#btn-export-osc-simple2", "(under development)", "right")
        RED.main.SetPopOver("#btn-export-osc-class2", "(under development)", "right")
    }
    $('#btn-export-simple2').click(function () { Export({compositeExport:true}); });
    $('#btn-export-class2').click(function () { Export({classExport:true}); });
    $('#btn-export-class-dev2').click(function () { Export({compositeExport:true, classExport:true}); });
    $('#btn-export-class-zip2').click(function () { Export({classExport:true, generateZip:true}); });
    $('#btn-export-osc-simple2').click(function () { Export({compositeExport:true, oscExport:true}); });
    $('#btn-export-osc-class2').click(function () { Export({classExport:true, oscExport:true}); });
    
    
    /**
     * This is the main entry point for all exports
     * @param {ExportOptions} options 
     */
    function Export(options) {
        const t0 = performance.now();
        RED.storage.update(); // sort is made inside update
        options = new ExportOptions(options); // sets other defaults
        currentExport = new CompleteExport(options);
        let coex = currentExport; // short 'alias'
        coex.allFiles.push(new ExportFile("GUI_TOOL.json", JSON.stringify(JSON.parse(coex.jsonString), null, 4))); // JSON beautifier
        if (options.compositeExport == true) {
            //coex.ac.staticType = true; // allways true for SIMPLE FLAT
            export_workspace(coex, RED.nodes.currentWorkspace); 
        }
        else if (options.classExport == true) {
            
            //coex.allFiles.push(new ExportFile("preferences.txt", RED.arduino.board.export_arduinoIDE())); // skip for now as it don't properly work for the moment
            //coex.allFiles.push(new ExportFile("platformio.ini", RED.arduino.board.export_platformIO())); // skip for now as it don't properly work for the moment
            export_classBased(coex);
        }
        else { // failsafe
            RED.notify("Error export mode not selected", "warning", null, 3000);
            return;
        }

        if (coex.mixervariants != undefined && coex.mixervariants.length > 0) {
            coex.globalCppFiles.push(...Mixers.Export.GetFiles("Mono", coex.mixervariants, options.compositeExport));
        }
        if (coex.mixerStereoVariants != undefined && coex.mixerStereoVariants.length > 0) {
            coex.globalCppFiles.push(...Mixers.Export.GetFiles("Stereo", coex.mixerStereoVariants, options.compositeExport));
        }
        console.error("@export as class RED.arduino.serverIsActive=" + RED.arduino.serverIsActive());

        // only show dialog when server is not active and not generating zip
        // or when export modes: SIMPLE_FLAT or CLASS_SINGLE
        let useExportDialog = true;/*((RED.arduino.settings.useExportDialog == true) ||
                               (options.generateZip == false));*/
        coex.finalize();
        if (useExportDialog == true) 
            ShowExportDialog(coex);

        const t1 = performance.now();
        console.log('arduino-export-save2 took: ' + (t1 - t0) + ' milliseconds.');

        if (options.generateZip == false)
            SendToHttpBridge(coex); // allways try to POST but not when exporting to zip
        else if (options.generateZip == true)
            GenerateZip(coex);
    }

    /**
     * 
     * @param {CompleteExport} coex 
     */
    function export_classBased(coex)
    {
        for (var wsi = 0; wsi < RED.nodes.workspaces.length; wsi++)
        {
            var ws = RED.nodes.workspaces[wsi];
            if (ws.export == false)
                continue; // this skip export
            if (RED.nodes.getNodeInstancesOfType(ws.label).length == 0 && ws.isMain == false && ws.isAudioMain == false)
                continue; // don't export classes/tabs not in use
            
            export_workspace(coex, ws);
        }
    }

    /**
     * 
     * @param {CompleteExport} coex
     * @param {REDWorkspace} ws
     */
    function export_workspace(coex, ws) {
        var wse = new WorkspaceExport(ws);
        coex.keywords.push({token:ws.label, type:"KEYWORD2"});

        // add nodes (Audio objects, special nodes, class nodes)
        for (var i = 0; i < ws.nodes.length; i++) {
            var n = ws.nodes[i];

            if (checkAndAddNonAudioObject(n, wse, coex.globalCppFiles)) {
                //continue;
            }
            else if (n.type == "AudioMixer" && coex.mixervariants != undefined && coex.options.oscExport == false) {
                var inputCount = RED.export.links.getDynInputDynSize(n);
                if (inputCount != 4) { // 4 input variant is allready in the audio lib

                    if (!coex.mixervariants.includes(inputCount)) {
                        coex.mixervariants.push(inputCount);
                    } 

                    var includeName = '#include "mixers.h"';
                    if (!wse.userIncludes.includes(includeName)) wse.userIncludes.push(includeName);
                }
            }
            else if (n.type == "AudioMixerStereo" && coex.mixerStereoVariants != undefined && coex.options.oscExport == false) {
                // for future implementation
            }
            // Audio Control/class node without any IO
            // TODO. add special identifier to AudioControl objects
            // both to make this code clearer and to sort non Audio Control objects in a different list

            else if (/*(n.outputs <= 0) && (n.inputs <= 0) && */(n._def.inputs <= 0) && (n._def.outputs <= 0)) { 
                var typeName = getTypeName(n, coex.options);
                var name = getName(n, coex.options);
                var comment = (n.comment!=undefined && n.comment.trim().length != 0)?n.comment:"";
                wse.audioControlObjects.push(new ExportObject(typeName, name, comment));
            }
            else // Audio Processing Node and Class node that have IO
            { 
                //console.log(n);
                var typeName = getTypeName(n, coex.options);
                var name = getName(n, coex.options);
                var comment = (n.comment!=undefined && n.comment.trim().length != 0)?n.comment:"";
                wse.audioObjects.push(new ExportObject(typeName, name, comment));
            }

            if (n._def.classWs != undefined && (wse.depends.includes(n.type) == false)) // (h4yn0nnym0u5e) keep track of class dependencies so we can export in valid order
				wse.depends.push(n.type);
        }

        // add audio connections

        for (var i = 0;i<ws.links.length; i++) {
            var link = ws.links[i];

            if (link.source.type == "TabInput" || link.target.type == "TabOutput") continue;
            if (link.source.type == "LinkIn" || link.target.type == "LinkOut") continue;

            if (link.source.type.startsWith("Junction") == true) continue; // skip wires going from Junctions as then we can preserve the wire/link order


            RED.export.links2.generateAndAddExportInfo(link);
            if (link.export != undefined)
                wse.AudioConnections.push(...link.export)
            else // failsafe
                wse.AudioConnections.push({invalid:"// invalid path: " + link.ToString()})

            // TODO make sure that generateAndAddExportInfo also takes care of junctions

        }

        var exportFile = WorkspaceExportToExportFile(wse, coex.options);
        exportFile.header = getCppHeader(coex.jsonString, wse.workspaceIncludes.join("\n") + "\n ", coex.options.generateZip);
        coex.wsCppFiles.push(exportFile);
    }

    /**
     * 
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options
     */
    function WorkspaceExportToExportFile(wse, options)
    {
        console.log(wse);
        var mi_indent = TEXT.getNrOfSpaces(options.classExportIdents);
        
        var newWsCpp = new ExportFile(wse.fileName, "");
        newWsCpp.className = wse.className;
        newWsCpp.depends = wse.depends; // h4yn0nnym0u5e class depending sorter

        newWsCpp.body += GetClassCommentsCppCode(wse);
        var instancesCppCode = [];
        instancesCppCode.push(...GetExportObjectsCppCode(wse.audioObjects, options, "// AudioStream and AudioClass instances\n"));
        instancesCppCode.push(...GetExportObjectsCppCode(wse.audioControlObjects, options, "// AudioControl instances\n"));
        instancesCppCode.push(...GetVariablesCppCode(wse, options, "// Variables\n"));

        if (wse.isMain == false && options.classExport==true)
        {
            newWsCpp.body += "class " + wse.className + " " + wse.ws.extraClassDeclarations +"\n{\npublic:\n";
            newWsCpp.body += TEXT.incrementLines(instancesCppCode, mi_indent).join('\n') + "\n";
            newWsCpp.body += mi_indent + GetAudioConnectionsArrayInstanceCppCode(wse, options) + "\n";
            newWsCpp.body += "\n";
            newWsCpp.body += TEXT.incrementLines(GetConstructorCppCode(wse, options), mi_indent).join('\n') + "\n";
            newWsCpp.body += TEXT.incrementLines(GetDestructorCppCode(wse, options), mi_indent).join('\n') + "\n";
            newWsCpp.body += GetClassFunctions(wse, options) + "\n";
            newWsCpp.body += "};\n"; // end of class
            newWsCpp.body += wse.eofCode.join("\n") + "\n"; // after end of class code
        }
        else
        {
            newWsCpp.body += instancesCppCode.join('\n') + "\n";
            newWsCpp.body += "\n";
            newWsCpp.body += GetAudioConnectionsCppCode(wse, options).join('\n') + "\n"; // this would contain all audio connections when exporting to simple plain export
            newWsCpp.body += GetClassFunctions(wse, options);
        }

        //newWsCpp.header = RED.arduino.export2.getCppHeader(ce.jsonString, wse.workspaceIncludes.join("\n") + "\n ", ce.generateZip);
        
        newWsCpp.footer = RED.arduino.export2.getCppFooter();
        
        return newWsCpp;
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetVariablesCppCode(wse, options, comment)
    {
        if (wse.variables.length == 0) return [];
        var cpp = [];
        cpp.push(comment);
        cpp.push(...wse.variables);
        return cpp;
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetClassFunctions(wse, options)
    {
        var classFunctions = wse.functions.join('\n');
        if (classFunctions.trim().length > 0) {
            if (newWsCpp.isMain == false && options.classExport==true)
                return "\n" + TEXT.incrementTextLines(classFunctions, options.classExportIdents);
            else
                return "\n" + classFunctions;
        }
        return "";
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetAudioConnectionsCppCode(wse, options)
    {
        var cpp = [];
        for (var i = 0; i < wse.AudioConnections.length; i++) {
            //console.log(wse.AudioConnections[i]);
            if (wse.AudioConnections[i].invalid == undefined)
                cpp.push(wse.AudioConnections[i].GetCppCode(options, i));
            else
                cpp.push(wse.AudioConnections[i].invalid); // contains info as a comment
        }
        return cpp;
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetConstructorCppCode(wse, options)
    {
        var cpp = [];
        var constructorBody = [];
        var mi_indent = TEXT.getNrOfSpaces(options.classExportIdents);

        constructorBody.push(...TEXT.incrementLines(GetAudioConnectionsCppCode(wse, options), mi_indent));
        constructorBody.push(...TEXT.incrementLines(wse.constructorCode, mi_indent));
        if (constructorBody.length == 0 && options.oscExport == false) return []; // skip generating empty constructors for non OSC exports

        if (options.oscExport == false)
            cpp.push(wse.className + "() {");
        else {
            cpp.push(wse.className + "(const char* _name,OSCAudioGroup* parent) : ");
            cpp.push("  OSCAudioGroup(_name,parent), // construct our base class instance");
            cpp.push(mi_indent + "OSCAudioGroup& grp = *this;");
        }

        if (wse.totalAudioConnectionCount != 0)
            cpp.push(mi_indent + "int pci = 0; // used only for adding new patchcords");
        cpp.push(...constructorBody);
        cpp.push("}\n");
        return cpp;
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetDestructorCppCode(wse, options)
    {
        if (wse.ws.generateCppDestructor == false) return [];
        var cpp = [];
        var mi_indent = TEXT.getNrOfSpaces(options.classExportIdents);
        cpp.push("~" + wse.className + "() { // destructor (this is called when the class-object is deleted)");
        if (wse.totalAudioConnectionCount != 0) {
            cpp.push(mi_indent + "for (int i = 0; i < " + wse.totalAudioConnectionCount + "; i++) {");
            cpp.push(mi_indent + mi_indent + "patchCord[i]->disconnect();");
            cpp.push(mi_indent + mi_indent + "delete patchCord[i];");
            cpp.push(mi_indent + "}");
        }
        cpp.push(...TEXT.incrementLines(wse.destructorCode, mi_indent));
        cpp.push("}");
        return cpp;
    }

    /**
     * @param {WorkspaceExport} wse 
     * @param {ExportOptions} options 
     */
    function GetAudioConnectionsArrayInstanceCppCode(wse, options) 
    {
        if (wse.totalAudioConnectionCount == 0) return "";
        var typeName = getAudioConnectionTypeName(options);
        var padding = TEXT.getNrOfSpaces(32 - typeName.length);
        var name = (options.dynamicConnections==false?"*":"") + "patchCord[" + wse.totalAudioConnectionCount + "];";
        var comment = "// total patchCordCount:" + wse.totalAudioConnectionCount + " including array typed ones.";
        return `${typeName} ${padding} ${name} ${comment}`;
    }

    /**
     * @param {WorkspaceExport} wse 
     */
    function GetClassCommentsCppCode(wse)
    {
        if (wse.classComments.length > 0)
            return "/**\n" + wse.classComments.join('\n  *') + " */\n";
        else
            return "";
    }

    /**
     * @param {ExportObject[]} exportObjects 
     * @param {ExportOptions} options 
     * @returns 
     */
    function GetExportObjectsCppCode(exportObjects, options, comment)
    {
        var padding =  new ExportObjectPaddingSizes(options.instanceDeclarationsMinPadding, 0, exportObjects);
        var cpp = [];
        if (exportObjects.length == 0) return cpp;
        cpp.push(comment);
        for (var i = 0; i < exportObjects.length; i++) {
            cpp.push(exportObjects[i].Finalize(padding));
        }
        return cpp;
    }

    /**
     * @param {REDNode} node 
     * @param {WorkspaceExport} wse 
     * @param {CompleteExport} completeExport 
     * @returns 
     */
    function checkAndAddNonAudioObject(node,wse,completeExport) {
        if (node.type == "ClassComment") {
            wse.classComments.push(" * " + node.name);
        }
        else if (node.type == "Function") {
            wse.functions.push(node.comment); // we use comment field for function-data
        }
        else if (node.type == "Variables") {
            wse.variables.push(node.comment); // we use comment field for vars-data
        }
        else if (node.type == "PointerArray") {// this is special thingy that was before real-node, now it's obsolete, it only generates more code
            wse.arrayNodes.push({ type: node.objectType, name: node.name, cppCode: node.arrayItems, objectCount: node.arrayItems.split(",").length });
        }
        else if (node._def.classWs != undefined) {
            var includeName = '#include "' + node.type + '.h"';
            if (!wse.workspaceIncludes.includes(includeName)) wse.workspaceIncludes.push(includeName);
            return false;
        }
        else if (node.type == "IncludeDef") {
            var includeName = '#include ' + node.name;
            if (!wse.userIncludes.includes(includeName)) wse.userIncludes.push(includeName);
        }
        else if (node.type == "ConstValue") {
            wse.variables.push("const static " + node.valueType + " " + node.name + " = " + node.value + ";");
        }
        else if (node.type == "ConstructorCode") {
            wse.constructorCode.push(node.comment);
        }
        else if (node.type == "DestructorCode") {
            wse.destructorCode.push(node.comment);
        }
        else if (node.type == "EndOfFileCode") {
            wse.eofCode.push(node.comment);
        }
        else if (node.type == "CodeFile") // very special case
        {
            if (node.comment.length != 0) {
                var wsFile = new ExportFile(node.name, node.comment);
                wsFile.header = "\n// ****** Start Of Included File:" + node.name + " ****** \n";
                wsFile.footer = "\n// ****** End Of Included file:" + node.name + " ******\n";
                completeExport.globalCppFiles.push(wsFile);
            }

            var includeName = '#include "' + node.name + '"';
            if (includeName.toLowerCase().endsWith(".c") || includeName.toLowerCase().endsWith(".cpp")) return true; // return true because type taken care of

            if (!wse.userIncludes.includes(includeName)) wse.userIncludes.push(includeName);
        }
        else if (node.type == "DontRemoveCodeFiles") {
            var files = node.comment.split("\n");
            for (var fi = 0; fi < files.length; fi++) {
                var wsFile = new ExportFile(files[fi].trim(), "");
                wsFile.overwrite_file = false;
                completeExport.allFiles.push(wsFile); // push special files to the beginning 
            }
        }
        else if (node.type == "Comment") {
            // don't do anything with comments for now, they are mostly visual objects to comment things
            // maybe TODO bind a comment to a object, then the comment could be added to that object 
        }
        else if (node.type == "group") {
            // don't do anything with groups, they are only virtual objects
            // future TODO have group to represent class for simple projects, or to show the contents of class objects directly
        }
        else if (node._def.nonObject != undefined) {
            // this represents other virtual objects:
            // Junctions, TabInput, TabOutput, BusJoin, BusSplit, LinkIn, LinkOut
        }
        else
            return false;
        return true;
    }

    /**
     * This is only for the moment to get special type AudioMixer<n>, AudioMixerNNN or AudioStreamObject
     * @param {REDNode} node
     * @param {ExportOptions} options
     */
     function getTypeName(node, options)
     {
        if (node.type == "AudioStreamObject") // special case
            var cpp = node.subType?node.subType:"// warning AudioStreamObject subType not set";
        else
            var cpp = node.type;

        if (node._def.dynInputs != undefined && options.oscExport == false)
        {
            var dynInputSize = RED.export.links.getDynInputDynSize(node).toString();

            if (options.UseAudioMixerTemplate == true)
                dynInputSize = '<' + dynInputSize + '>'; // include the template def.

            cpp += dynInputSize;
        }

        if ( options.oscExport == true)
            cpp = cpp.replace("Audio", "OSCAudio");

        //cpp += " "; // add at least one space
        //for (var j = cpp.length; j < 32; j++) cpp += " ";
        return cpp;
    }

    /**
     * @param {REDNode} node
     * @param {ExportOptions} options
     */
    function getName(node, options) {
        console.log(node);
        if (options.oscExport == true) {
            if (node.isArray != undefined)
                var name = node.isArray.name;
            else
                var name = node.name;

            if (node._def.dynInputs != undefined)
                name += '{"' +name+ '", ' + RED.export.links.getDynInputDynSize(node) + "}";
            else
                name += '{"' +name+ '"}';
            return name;
        }
        else
        {
            if (node.isArray != undefined)
                return node.isArray.newName;
            return node.name;
        }
    }

    /** @param {ExportOptions} options */
    function getAudioConnectionTypeName(options) {
        if (options.oscExport == false)
            return "AudioConnection";
        else
            return "OSCAudioConnection";
    }

    /** @param {CompleteExport} ce */
    function GenerateZip(ce)
    {
        
        const t1 = performance.now();
        var zip = new JSZip();
        let useSubfolder = RED.arduino.settings.ZipExportUseSubFolder;
        let subFolder = /*(mainFileName != "") ? mainFileName : */RED.arduino.settings.ProjectName;
        for (var i = 0; i < ce.allFiles.length; i++) {
            var file = ce.allFiles[i];

            if (file.overwrite_file == false) continue; // don't include in zip as it's only a placeholder for existing files
            
            if (useSubfolder == false)
                zip.file(file.name, file.contents);
            else
                zip.file(subFolder + "\\" + file.name, file.contents);
        }
        var compression = (RED.arduino.settings.ZipExportCompress==true)?"DEFLATE":"STORE";
        zip.generateAsync({ type: "blob", compression}).then(function (blob) {
            const t2 = performance.now();
            console.log('arduino-export-toZip took: ' + (t2 - t1) + ' milliseconds.');
            RED.main.showSelectNameDialog(RED.arduino.settings.ProjectName + ".zip", function (fileName) { saveAs(blob, fileName); }); // saveAs is from FileSaver.js
        });
    }

    /** @param {CompleteExport} ce */
    function SendToHttpBridge(ce)
    {
        //ce.finalize(); // makes this export ready for Http Post export
        RED.arduino.httpPostAsync(ce.getPostJSON());
    }

    const ONE_FILE_MERGE = "COMPOSITE";
    function ExportDialogFileSelected(fileName) 
    {
        if (fileName == ONE_FILE_MERGE) { // special case
            $("#node-input-export").val(currentExport.compositeContents);
        }
        else
        {
            var files = currentExport.allFiles;
            for (var i=0;i<files.length;i++) {
                var file = files[i];
                if (file.name == fileName)
                {
                    $("#node-input-export").val(file.contents);
                    break;
                }
            }
            
        }
        console.log("file selected:" + fileName);
    }

    /** @param {CompleteExport} coex */
    function ShowExportDialog(coex)
    {
        generateCompleteExportCompositeContents(coex);
        console.log(coex);
        
        var filesNames = [ONE_FILE_MERGE];
        for (var i = 0;i<coex.allFiles.length; i++)
            filesNames.push(coex.allFiles[i].name);
        RED.view.dialogs.showExportDialog(getKeyByValue(CPP_EXPORT_MODE, coex.exportMode), coex.compositeContents, " Source Code:", undefined, undefined, {cb:ExportDialogFileSelected, files:filesNames});
    }

    /** @param {CompleteExport} coex */
    function generateCompleteExportCompositeContents(coex) {
        // time to generate the final result
        var cpp = "";
        cpp = getCppHeader(coex.jsonString, undefined, false); // false mean zip mode, which in this case appends the design JSON to the export 
        // first add global files
        for (var i = 0; i < coex.globalCppFiles.length; i++)
        {
            if (coex.globalCppFiles[i].name == "mixers.cpp")
            { // special case
                cpp += coex.globalCppFiles[i].body.replace('#include "mixers.h"', '') + "\n"; // don't use that here as it generates compiler error
            }
            else if (coex.globalCppFiles[i].name == "mixers.h") 
            { // special case
                cpp += coex.globalCppFiles[i].header + "\n" + coex.globalCppFiles[i].body + "\n"; // to include the copyright note
            }
            else
            {
                cpp += coex.globalCppFiles[i].body;
            }
        }
        // second add cpp files in dependency order
        // credits to h4yn0nnym0u5e for the dependency order sorting
        var exportComplete = false;
        var exported = [];
        var skipDependencyCheck = coex.options.compositeExport;
        while (exportComplete==false)
        {
            exportComplete = true;
            
            for (var fi = 0; fi < coex.wsCppFiles.length; fi++) {
                var exportFile = coex.wsCppFiles[fi];

                if (exportFile.isExported == false) {
                    // check that anything we depend on has already been added
                    var skip = false;
                    if (skipDependencyCheck == false) {
                        for (var di =0;di<exportFile.depends.length ;di++) {
                            var depend = exportFile.depends[di];
                            if (exported.includes(depend) == false)
                            {
                                exportComplete = false;
                                skip = true;
                                break;
                            }
                        }
                        if (skip==true)
                            continue;
                    }
                    cpp += exportFile.body;
                    exportFile.isExported = true;
                }
                if (exportFile.className != undefined)
                    exported.push(exportFile.className);
                else
                    console.error("exportFile.className == undefined");
            }
        }
        cpp += getCppFooter();
        console.log(exported.join(', '));

        coex.compositeContents = cpp;
    }

    function getCppHeader(jsonString, includes, generateZip) {
        if (includes == undefined)
            includes = "";
        var returnStr = RED.arduino.settings.StandardIncludeHeader
            + includes + "\n"
            + "// " + RED.arduino.settings.ProjectName + ": begin automatically generated code\n";
        // don't include JSON in files when exporting as zip, 
        // the zip contains the json as separate file.
        // this makes the zip generating much faster
        if (RED.arduino.settings.WriteJSONtoExportedFile == true && generateZip == false)
            returnStr += "// the following JSON string contains the whole project, \n// it's included in all generated files.\n"
                + "// JSON string:" + jsonString + "\n\n";
        return returnStr;
    }

    function getCppFooter() {
        return "// " + RED.arduino.settings.ProjectName + ": end automatically generated code\n";
    }

    return {
        init,
        Export,
        getCppFooter,
        getCppHeader,
        getAudioConnectionTypeName,
        get currentExport() {return currentExport;} 
    };
})();

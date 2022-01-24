
RED.export.links = (function () {


    $('#btn-deploy-osc-group-links').click(testFinalLinksExport);

    function testFinalLinksExport() {
        
        RED.export.project = RED.nodes.createCompleteNodeSet({newVer:true}); // true mean we get the new structure

        var foundMains = RED.export.findMainWs(RED.export.project);
        var mainWorkSpaceIndex;

        if (foundMains == undefined) {
            RED.main.verifyDialog("Warning", "Audio Main Entry Tab not set", "Please set the Audio Main Entry tab<br> double click the tab that you want as the main and check the 'Audio Main File' checkbox.<br><br>note. if you select many tabs as audio main only the first is used.", function() {});
            return;
        }

        if (foundMains.items.length > 1) { // multiple AudioMain found
            if (foundMains.mainSelected != -1)
                mainWorkSpaceIndex = foundMains.mainSelected;
            else
                mainWorkSpaceIndex = foundMains.items[0]; // get the first one
        }
        else
            mainWorkSpaceIndex = foundMains.items[0]; // get the only one
        var ws = RED.export.project.workspaces[mainWorkSpaceIndex];
        var links = [];
        getClassConnections(ws, links, "");
        RED.export.updateNames(links);
        links = RED.export.expandArrays(links);
        RED.export.fixTargetPortsForDynInputObjects(links);
        var exportDialogText = RED.export.printLinksDebug(links);

        RED.view.dialogs.showExportDialog("OSC Export to Dynamic Audio Lib", exportDialogText, " OSC messages: ", {okText:"send", tips:"this just shows the messages to be sent, first in JSON format then in RAW format"},
        function () {RED.notify("<strong>Nothing sent (development test only)</strong>", "success", null, 2000);});
    }

    function getClassConnections(class_ws, links, currPath) {
        //console.log("*******************************************");
        console.error("getClassConnections  path: \"" + currPath + "\"");
        
        for (var ni = 0; ni < class_ws.nodes.length; ni++) {
            var node = RED.nodes.node(class_ws.nodes[ni].id);

            if (node._def.nonObject != undefined) continue;
            if (node.type == "TabInput") continue; 
            
            var isArray = RED.export.isNameDeclarationArray(node.name, node.z, true);
            console.warn(isArray);
            var ws = RED.export.isClass(node.type)

            if (ws) {

                if (isArray) {
                    for (var ai = 0; ai < isArray.arrayLength; ai++) {
                        links.push({invalid:currPath + "/" + isArray.name + "/i" + ai});
                        
                        getClassConnections(ws, links, currPath + "/" + isArray.name + "/i" + ai);
                        isArray.i = ai;
                        links.pushArray(getNodeLinks(node, currPath, isArray));
                    }
                }
                else {
                    getClassConnections(ws, links, currPath + "/" + node.name);
                    links.pushArray(getNodeLinks(node, currPath));
                }
            } else {

                if (isArray) {
                    for (var ai = 0; ai < isArray.arrayLength; ai++) {
                        isArray.i = ai;
                        links.pushArray(getNodeLinks(node, currPath, isArray)); 
                    }
                }
                else {
                    links.pushArray(getNodeLinks(node, currPath)); 
                }
            }
        }
    }

    // TODO. fix so this function allow both currPath and object arrays in both source and target
    function getNodeLinks(node, currPath, isArray) {
        var nodeLinks = RED.nodes.links.filter(function(l) { return (l.source === node) && (l.target.type != "TabOutput"); });
        nodeLinks.sort(function (a,b) {return a.target.y-b.target.y});

        console.error(node.name + " links:\n" + RED.export.printLinksDebug(nodeLinks));
        
        var newLinks = [];
        for (var li = 0; li < nodeLinks.length; li++) {
            var l = RED.export.copyLink(nodeLinks[li], currPath);

            console.warn(RED.export.printLinkDebug(l));
            ws = RED.export.isClass(l.source.type)
            if (ws)
            {
                RED.export.getFinalSource(l,ws);

                if (isArray != undefined) {
                    l.sourcePath = l.sourcePath.replace(isArray.newName, isArray.name + "/i" + isArray.i);
                }
            }
            ws = RED.export.isClass(l.target.type);
            if (ws)
            {
                RED.export.getFinalTarget_s(ws,l, newLinks, currPath);
            }
            else {
                
                newLinks.push(l);
            }

        }
        
        return newLinks;
    }

    return {
        getClassConnections
    };
})();
//The project that led me to swear to fight the javascript menace in every quarter it has not already won.
//~mako yass

"use strict";

//it's shim time. The time of procession of shame for javascript. Dip your heads.

function elementLocation(el){
	var parent = el.parentElement
	if(parent === null){
		return {x:el.offsetLeft, y:el.offsetTop};
	}else{
		var o = elementLocation(parent);
		return {x:el.offsetLeft+o.x, y:el.offsetTop+o.y};
	}
}

// function elementLocation(el){
// 	return {x: el.clientLeft, y:el.clientTop}
// }

function pointWithinElement(el, point){
	var elor = elementLocation(el);
	return (point.x >= elor.x && point.x < elor.x + el.offsetWidth && point.y >= elor.y && point.y < elor.y + el.offsetHeight)
}

function clearEl(el){
	while(el.firstChild)
		el.removeChild(el.firstChild);
}

Storage.prototype.setObject = function(key, value){
	this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key, defaultValue){
	var value = this.getItem(key);
	return value? JSON.parse(value) : defaultValue;
}

var requestAnimFrame =
	window.requestAnimationFrame       ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame    ||
	window.msRequestAnimationFrame     ||
	function( callback ){
		window.setTimeout(callback, 1000 / 60);
	};

function subclass(base){
	_subclass.prototype = base.prototype;
	return new _subclass();
}
function _subclass(){}

String.prototype.hashCode = function(){
		var hash = 0, i, char;
		if (this.length == 0) return hash;
		for (var i = 0, l = this.length; i < l; i++) {
				char  = this.charCodeAt(i);
				hash  = ((hash<<5)-hash)+char;
				hash |= 0; // Convert to 32bit integer
		}
		return hash;
};

//shim time is over, now real code begin

var graff;
var editor;
var graph;
var navigationBackstack = []; //because for some reason history wont let us access data about that. They probably said "security" and then stopped thinking about it.
var previousPosition;
var standardAppTitle = "The Manifold Realms";
var lightTheme = true;
var nodeQueueLimit = 47;
var nodeQueueCount = 0;
var nodeQueueEye = 0; //nodeQueue[nodeQueueEye] is front.
var nodeQueue = new List(); //list of graph nodes
var themeChanges = new List(); //list of functions that update elements when the theme changes
var autoCompletions = [
	'back',
	'edit'
];
var loadingMode = false;
var currentPosition = null;
var ld = function(l,d){return function(){return lightTheme?l:d}};
var backgroundColor = ld('rgb(250,250,250)','rgb(0,0,0)');
var foregroundColor = ld('rgb(10,10,10)','rgb(240,240,240)');
var treadedNodeColor = ld('rgb(187,200,191)','rgb(78,90,96)');
var selectedNodeColor = ld('rgb(142,168,153)','rgb(96,139,142)');
var untreadedNodeColor = ld('rgb(219,219,219)','rgb(76,76,76)');
var unreadableNodeColor = ld('rgb(250,250,250)','rgb(0,0,0)');
var communistBear = 87;
var userData = null;
/*
userData is like,
id: number
token; string
identities: List[identity]
rememberry: List[{title: name, id: <position id>}]

identities are like
	name: 'anuses',
	id: '883295275',
	realms: [
		'9325984273' ]
*/

var commandBarExpanded = false;
var controlsShown = false;
var trayDeploysOnMouse = true;
var trayItemActivationMethod = null;
var selectedIdTag = null;
var selectedId = null;
var isEditMode = false;
var treversalLink = null;
var redundanceMessage = {status:'shiny', detail:'redundant'};
var personaLoggedIn = false;

function easeOut(p){return p*p;}
function easeIn(p){return Math.sqrt(p);}
function easeInOut(p){
	if(p < 0)
		return 0;
	if(p >= 1)
		return 1;
	return p*p*(3-2*p);
}

function Graff(container){ //takes style from container and fills it with graff. Note, run its pageChange() every time your page change.
	this.nodeSelectListeners = new DataSource();
	this.nodeHoverListeners = new DataSource();
	this.nodeUnhoverListeners = new DataSource();
	this.pipWidth = 8;
	this.container = container;
	var self = this;
	
	this.graph = new Springy.Graph();
	
	// this.keym = new KeyMonitor();
	// this.keym.then('a', function(ev){
	// 
	// });
	window.addEventListener('keydown', function(ev){self.keyDown(ev)});
	window.addEventListener('keyup', function(ev){self.keyUp(ev)});
	
	this.graph.addGraphListener(this);
	this.layout = new Springy.Layout.ForceDirected(this.graph, 310,420,0.43);
	this.mousePosition = new Springy.Vector(0,0);
	
	this.animationsRunning = new List();
	
	this.pageChange();
	
	//register to render whenever's good
	this.startUpdatingBoard();
}
Graff.prototype = {
offsetx:0,
offsety:0,
scaleUp: 14,
cancon: null,
graph: null,
gravityx: 0,
gravityy: 0,
lineWidth: 8,
hoveredNode: null,
nodeUnhoverListener: null,
focusNodeX: 0,
focusNodeY: 0,
angleIncrement: 1.122, //selected to minimize repulsion forces as new neighbors are incrementally added to the same node.
currentNewNodeAngle: 0,
renderingUntil:0,
rendering: false,
anchorNode: null,
lastClickTime: 0, //for double click detection
doubleClickDuration: 400,
clickedDown: false,
nestling: false,
keyS: false, //because we can't tell the difference between the key being pressed and the key event being automatically repeated, otherwise =____=.
keyD: false,
keyC: false,
tilt: 1,
relocationDurationMilliseconds: 700,
extrusionEffecting: false,
highlightRgbStr: function(){return lightTheme?'0,0,0':'255,255,255'},
editMode: false,
setEditMode: function(whether){
	if(this.editMode ^ whether){
		this.editMode = whether;
		this.startUpdatingBoard();
		if(!whether){
			this.extrusionEffecting = false;
		}
	}
},
boostRenderingUntil: function(newTime){
	this.renderingUntil = Math.max(this.renderingUntil, newTime);
	this.startUpdatingBoard();
},
startAnimation: function(callback, duration){ //callback will be called with a number between 0 and 1. it is guaranteed to be called with 1 at the end of the animation's lifetime. Returns a cancellation callback. If the cancellation callback is passed true, it will abstain from rushing the animation to the end.
	var dis = this;
	var tab = {
		callback:callback,
		startTime: Date.now(),
		duration: duration,
		finished: false,
		rushConclusion: function(){
			if(!this.finished){
				this.callback(1);
				dis.animationsRunning.removeNode(this.node);
				this.finished = true;
			}
		},
		stop: function(){
			if(!this.finished){
				dis.animationsRunning.removeNode(this.node);
				this.finished = true;
			}
		},
		update: function(time){
			if(this.startTime + this.duration <= time){
				this.rushConclusion();
			}else{
				this.callback((time - this.startTime)/this.duration);
			}
		}
	};
	var node = this.animationsRunning.pushFront(tab);
	tab.node = node;
	this.startUpdatingBoard();
	return tab;
},
startUpdatingBoard: function(){
	var dis = this;
	if(!this.rendering){
		this.rendering = true;
		(function renderFun(timestamp){
			var time = Date.now();
			if(dis.nestling){
				dis.layout.nestle();
				dis.nestling = (dis.layout.totalEnergy() >= 0.01);
			}
			dis.animationsRunning.forEach(function(a){
				a.v.update(time); //may remove its node from the list, and yeah my lists can handle that.
			});
			if(dis.animationsRunning.isEmpty() && !dis.nestling)
				dis.rendering = false;
			else
				requestAnimFrame(renderFun);
			dis.render(time);
		})();
	}
},
setGravity: function(x,y, noAnimations){
	if(this.gravityCameraAnimation)
		this.gravityCameraAnimation.stop();
	if(noAnimations){
		this.gravityx = x;
		this.gravityy = y;
		this.startUpdatingBoard();
	}else{
		var ogx = this.gravityx;
		var ogy = this.gravityy;
		var dis = this;
		this.gravityCameraAnimation = this.startAnimation(
			function(elapsement){
				var smoothed = easeInOut(elapsement);
				dis.gravityx = ogx + smoothed*(x - ogx);
				dis.gravityy = ogy + smoothed*(y - ogy);
			}, 800);
	}
},
setFocusNode: function(node){
	if(this.focusNodeCameraAnimation)
		this.focusNodeCameraAnimation.stop();
	this.focusNode = node;
	var ofx = this.focusNodeX;
	var ofy = this.focusNodeY;
	var dis = this;
	var zeroVector = new Springy.Vector(0,0);
	var getTargetPoint = node?
			function(){return dis.upscaled(dis.layout.point(node).p);} :
			function(){return zeroVector;}
	this.focusNodeCameraAnimation = this.startAnimation(
		function(elapsement){
			var smoothed = easeOut(elapsement);
			var pt = getTargetPoint();
			dis.focusNodeX = ofx + (pt.x - ofx)*smoothed;
			dis.focusNodeY = ofy + (pt.y - ofy)*smoothed;
		}, 800);
},
fastConcludeCameraAnimations: function(){
	if(this.focusNodeCameraAnimation)
		this.focusNodeCameraAnimation();
	if(this.gravityCameraAnimation)
		this.gravityCameraAnimation();
},
pageChange: function(){
	var newCanvas = document.createElement('canvas');
	newCanvas.width = this.container.clientWidth;
	newCanvas.height = this.container.clientHeight;
	newCanvas.style.position = 'fixed';
	newCanvas.classList.add('graffCanvas');
	var self = this;
	newCanvas.themeChangeCallback = function(light){
		self.startUpdatingBoard();
	};
	newCanvas.classList.add('updateOnThemeChange');
	newCanvas.id = 'gameView';
	if(this.canvas)
		this.container.replaceChild(newCanvas, this.canvas);
	else
		this.container.appendChild(newCanvas);
	this.canvas = newCanvas;
	this.cancon = newCanvas.getContext('2d');
	this.assignCanvasContext(this.cancon);
	this.setGravity(this.gravityx, this.gravityy, true);
	this.startUpdatingBoard();
},
render: function(timestamp){
	this.drawBackground();
	//update offsetx and offsety
	var clamper = function(v){
		return (v<0)? 0 : ((v>1)? 1 : v);
	};
	var centerptx = this.container.clientWidth/2;
	var centerpty = this.container.clientHeight/2;
	var cgravityx = this.container.clientWidth*(this.gravityx)/2;
	var cgravityy = this.container.clientHeight*(this.gravityy)/2;
	var fnpt;
	this.offsetx = centerptx - this.focusNodeX + cgravityx;
	this.offsety = centerpty - this.focusNodeY + cgravityy;
	//now draw the focusNode highlight;
	if(this.focusNode){
		var pt = this.toScreen(this.layout.point(this.focusNode).p);
		// this.underlayPip.render(this.cancon, pt);
	}
	var dis = this;
	this.layout.eachEdge(function(edge, spring){
		dis.drawEdge(edge.source, edge.target);
	});
	// if(this.anchorNode){
	// 	var snp = this.toScreen(this.layout.nodePoints[this.anchorNode.id].p);
	// 	this.drawEdge(snp, this.mousePosition);
	// }
	this.layout.eachNode(function(node, point){
		dis.drawNode(dis.toScreen(point.p), node.data.grandMomentData.color());
	});
	this.layout.eachNode(function(node, point){
		var p = node.data.grandMomentData.lighting;
		var o = node.data.grandMomentData.lightingOpacity;
		if(node.data.grandMomentData != currentPosition && p && p > 0 && o && o > 0){
			var minThickness = 0.2;
			var thickness = easeIn(minThickness + (1 - minThickness)*p);
			var originNodePt = dis.toScreen(
				dis.layout.point(currentPosition.nodeQueueLNode.v).p);
			var loc = dis.toScreen(point.p);
			var angle = loc.subtract(originNodePt).angle();
			var innerRad = dis.pipWidth/2*3;
			var outerRad = innerRad + thickness*3.1;
			dis.cancon.beginPath();
			var arcSpread = Math.PI*2/5;
			// var arcSpread = Math.PI/2;
			dis.cancon.arc(loc.x, loc.y, innerRad, angle - arcSpread, angle + arcSpread, true);
			dis.cancon.arc(loc.x, loc.y, outerRad, angle + arcSpread, angle - arcSpread, false);
			dis.cancon.closePath();
			dis.cancon.fillStyle = 'rgba('+ dis.highlightRgbStr() +','+ o +')';
			dis.cancon.fill();
		}
	});
},

drawBackground: function(){
	this.cancon.fillStyle = backgroundColor();
	this.cancon.fillRect(0,0, this.canvas.width,this.canvas.height);
},
drawNode: function(pt, color){
	this.cancon.fillStyle = color;
	this.cancon.beginPath();
	this.cancon.arc(pt.x,pt.y, this.pipWidth/2, 0, Math.PI*2);
	this.cancon.fill();
},
assignCanvasContext: function(cancon){
	this.cancon = cancon;
	var dis = this;
	this.cancon.canvas.onselectstart = function(){ return false; }
	this.cancon.canvas.addEventListener('mousedown', function(ev){dis.clickDown(ev);});
	this.cancon.canvas.addEventListener('doubleclick', function(ev){dis.doubleClick(ev);});
	this.cancon.canvas.addEventListener('mouseup', function(ev){dis.clickUp(ev);});
	this.cancon.canvas.addEventListener('mousemove', function(ev){dis.mouseMove(ev);});
},
keyDown: function(kev){
	// var graffFocal = function(code, f){
	// 	this.keym.then(code, function(ev){
	// 		if(this.editMode && !hasEditableText(document.activeElement))
	// 			f(ev);
	// 	});
	// };
	// var explicitBindings = function(
	if(this.editMode && !hasEditableText(document.activeElement)){
		if(!(kev.shiftKey || kev.ctrlKey || kev.altKey)){
			switch(kev.keyCode){
				case 83:
					if(!this.keyS){
						this.keyS = true;
						this.extrusionEffecting = true;
						this.checkExtrusion();
					}
				break;
				case 68:
					if(!this.keyD){
						this.keyD = true;
						// this.deleteAction(); //too dangerous to have on ones' fingertips at all times. Leave it to the 'destroy' command.
					}
				break;
				case 67:
					if(!this.keyC){
						this.keyC = true;
						if(this.editMode)
							this.createAction();
					}
				break;
			}
		}
	}
},
keyUp: function(kev){
	switch(kev.keyCode){
		case 83: /* s */
			if(this.keyS){
				this.keyS = false;
				this.finishExtruding();
			}
		break;
		case 68: /* d */
			if(this.keyD){
				this.keyD = false;
			}
		break;
		case 67:
			if(!this.keyC){
				this.keyC = false;
			}
		break;
	}
},
graphChanged: function(){
	this.nestling = true;
	this.startUpdatingBoard();
},
upscaled: function(point){
	return new Springy.Vector(
		point.x*this.scaleUp,
		point.y*this.scaleUp*this.tilt);
},
toScreen: function(point){
	var ups = this.upscaled(point);
	return new Springy.Vector(
		this.offsetx + ups.x,
		this.offsety + ups.y);
},
fromScreen: function(screenP){
	return new Springy.Vector(
		(screenP.x - this.offsetx)/this.scaleUp,
		(screenP.y - this.offsety)/(this.scaleUp*this.tilt));
},
clickDown: function(ev){
	this.clickedDown = true;
	this.mousePosition.x = ev.clientX;
	this.mousePosition.y = ev.clientY;
	var nearest = this.layout.nearest(this.fromScreen(this.mousePosition));
	if(nearest.node && nearest.distance <= 1){
		if(this.editMode){
			this.beginExtrusionFrom(nearest.node);
		}else{
			if(this.focusNode != nearest.node)
				this.selectNode(nearest.node);
		}
	}
},
createAction: function(){
	tryToNavigateToPosition(Position.createIncomplete(this.mousePosition));
},
selectNode: function(node){
	this.nodeSelectListeners.publish(node);
},
cancelExtruding: function(){
	this.extrusionEffecting = false;
	this.anchorNode = null;
},
finishExtruding: function(){
	if(this.extrusionEffecting && this.anchorNode){
		var cloc = this.fromScreen(this.mousePosition);
		var nearnode = this.layout.nearest(cloc);
		if(nearnode.node && nearnode.node != this.anchorNode && nearnode.distance <= 1){
			var opos = this.anchorNode.data.grandMomentData;
			var fpos = nearnode.node.data.grandMomentData;
			var con = opos.linked(fpos);
			if(con){
				opos.unforgeLink(fpos);
			}else{
				opos.forgeLink(fpos);
			}
			this.startUpdatingBoard();
		}else{
			Position.createIncomplete(this.mousePosition, this.anchorNode.data.grandMomentData);
		}
		this.clickedDown = false;
	}
	this.cancelExtruding();
},
deleteAction: function(){
	var nearn = this.layout.nearest(this.fromScreen(this.mousePosition));
	if(nearn.distance <= 1){
		nearn.node.data.grandMomentData.destroyRightly();
	}
},
checkExtrusion: function(){
	var cloc = this.fromScreen(this.mousePosition);
	var nearnode = this.layout.nearest(cloc);
	if(this.anchorNode) this.startUpdatingBoard();
	if(nearnode && nearnode.distance <= 0.6){
		if(this.anchorNode){
			//make a connection.
			if(nearnode.node != this.anchorNode){
				this.finishExtruding();
			}
		}else{
			//start a new connection.
			this.anchorNode = nearnode.node;
		}
	}
},
beginExtrusionFrom: function(node){ //node optional
	this.anchorNode = node;
	this.extrusionEffecting = true;
	this.checkExtrusion();
},
mouseMove: function(ev){
	var shiftx = ev.clientX - this.mousePosition.x;
	var shifty = ev.clientY - this.mousePosition.y;
	this.mousePosition.x = ev.clientX;
	this.mousePosition.y = ev.clientY;
	if(this.clickedDown){
		if(this.extrusionEffecting){
			this.checkExtrusion();
		}else{
			if(shiftx != 0 || shifty != 0){
				this.focusNodeX -= shiftx;
				this.focusNodeY -= shifty;
				this.startUpdatingBoard();
			}
		}
	}
	var p = this.fromScreen(this.mousePosition);
	var nearest = this.layout.nearest(p);
	if(nearest.distance > 1) nearest.node = null;
	if(nearest.node != this.hoveredNode){
		this.nodeUnhoverListeners.publish();
		this.hoveredNode = nearest.node;
		if(nearest.node && (graphCentral || nearest.node.data.grandMomentData != currentPosition)){
			this.nodeHoverListeners.publish({
				p: this.locationOf(nearest.node),
				text: nearest.node.data.grandMomentData.title});
		}
	}
},
locationOf: function(node){
	return this.toScreen(this.layout.point(node).p);
},
doubleClick: function(ev){
	if(this.editMode)
		this.createAction();
},
clickUp: function(ev){
	if(this.clickedDown){
		this.clickedDown = false;
		if(this.lastClickTime + this.doubleClickDuration > ev.timeStamp)
			this.doubleClick();
		else if(this.editMode){
			var nearnode = this.layout.nearest(this.fromScreen(this.mousePosition));
			if(nearnode.node){
				if(nearnode.distance >= 1){
					this.finishExtruding();
				}else if(this.focusNode != nearnode.node){
					this.selectNode(nearnode.node);
				}
			}
			this.cancelExtruding();
		}
		this.lastClickTime = ev.timeStamp;
	}
},
drawEdge: function(node1, node2){
	var c1 = node1.data.grandMomentData.color();
	var p1 = this.toScreen(this.layout.point(node1).p);
	var c2 = node2.data.grandMomentData.color();
	var p2 = this.toScreen(this.layout.point(node2).p);
	var style;
	if(c1 == c2){
		style = c1;
	}else{
		var diff = p2.subtract(p1);
		var diffmag = diff.magnitude();
		var normal = diff.divide(diffmag);
		var gradius = this.pipWidth/2;
		var gstart = p1.add(normal.multiply(gradius));
		var gend = p1.add(normal.multiply(diffmag - gradius));
		var grad = this.cancon.createLinearGradient(gstart.x, gstart.y, gend.x, gend.y);
		grad.addColorStop(0, c1);
		grad.addColorStop(1, c2);
		style = grad;
	}
	var tis = this;
	var drawStraightLine = function(){
		tis.cancon.strokeStyle = style;
		tis.cancon.beginPath();
		tis.cancon.moveTo(p1.x, p1.y);
		tis.cancon.lineTo(p2.x, p2.y);
		tis.cancon.lineWidth = tis.lineWidth;
		tis.cancon.stroke();
	}
	var drawPointed = function(p1, p2){
		var diff = p2.subtract(p1);
		var diffmag = diff.magnitude();
		var normal = diff.divide(diffmag);
		var radi = tis.lineWidth/2;
		var length = diffmag - tis.pipWidth/2 - 2;
		var tip = p1.add(normal.multiply(length));
		var forth = normal.multiply(length - radi);
		var turned = new Springy.Vector(normal.y, -normal.x);
		var notchf = normal.multiply(radi);
		var notchs = turned.multiply(radi);
		var leftCorner = p1.add(notchs);
		var rightCorner = p1.subtract(notchs);
		var leftForth = leftCorner.add(forth);
		var rightForth = rightCorner.add(forth);
		var cpl = leftForth.add(normal.multiply(radi*0.4));
		var cpr = rightForth.add(normal.multiply(radi*0.4));
		tis.cancon.fillStyle = style;
		tis.cancon.beginPath();
		tis.cancon.moveTo(leftCorner.x, leftCorner.y);
		tis.cancon.lineTo(leftForth.x, leftForth.y);
		tis.cancon.bezierCurveTo(cpl.x, cpl.y,  tip.x, tip.y,  tip.x, tip.y);
		tis.cancon.bezierCurveTo(tip.x, tip.y,  cpr.x, cpr.y,  rightForth.x, rightForth.y);
		tis.cancon.lineTo(rightCorner.x, rightCorner.y);
		tis.cancon.closePath();
		tis.cancon.fill();
	}
	if(this.editMode){
		var con = node1.data.grandMomentData.getLinkTo(node2.data.grandMomentData).v;
		if(con.linkFrom(node1.data.grandMomentData)){
			if(con.linkFrom(node2.data.grandMomentData)){
				drawStraightLine();
			}else{
				drawPointed(p1,p2);
			}
		}else{
			if(con.linkFrom(node2.data.grandMomentData)){
				drawPointed(p2,p1);
			}else{
				throw new Error("there's no link here to be drawn!?!?");
				return;
			}
		}
	}else{
		drawStraightLine();
	}
	//so digraph
}
};

var resIdEx = /^[0-9]*$/;
function validResId(str){
	return !!resIdEx.exec(str);
}

function Realm(){
	this.pantheon = new List(function(a,b){return a.id < b.id});
}
Realm.cache = {};
Realm.futureCache = {};
Realm.getOrInstate = function(id){
	var prec = Realm.cache[id];
	if(!prec){
		prec = new Realm();
		prec.id = id;
		Realm.cache[id] = prec;
	}
	return prec;
};
Realm.getFuture = function(id){ //ensures there is only one realm fetch happening at a time for each realm. Future is directly sated if realm is loaded already.
	var dat = Realm.get(id);
	var cfut = Realm.futureCache.hasOwnProperty(id) && Realm.futureCache[id];
	var aw = new Awaited();
	if(dat){
		if(cfut){
			delete Realm.futureCache[id];
		}
		aw.publish(dat);
	}else if(cfut){
		return cfut;
	}else{
		var fut = fetchJson('realmData/'+id);
		fut.then(function(realm){
			delete Realm.futureCache[id];
			var processed = Realm.updateOrInstate(realm);
			aw.publish(processed);
		});
		fut.burden(aw);
		Realm.futureCache[id] = aw;
	}
	return aw;
};
Realm.get = function(id){
	return Realm.cache[id];
};
Realm.createNew = function(realmName){ //returns Awaited[Realm]
	var trans = doTransactions(foundRealmOp(realmName));
	var aw = new Awaited();
	var idOfCreation = selectedId;
	trans.then(function(res){
		var nr = Realm.getOrInstate(res.realmId);
		nr.setTitle(realmName);
		nr.addUser(idOfCreation);
		aw.publish(nr);
	});
	trans.burden(aw);
	return aw;
};
Realm.updateOrInstate = function(nr){
	var pot = Realm.getOrInstate(nr.id);
	pot.title = nr.title;
	if(nr.pantheon){
		if(nr.pantheon.constructor == Array)
			pot.pantheon = new List().fromArray(nr.pantheon);
		else
			pot.pantheon = nr.pantheon;
	}
	return pot;
};
Realm.pantheon = null;
Realm.title = "";
Realm.id = null;
Realm.prototype.addUser = function(ido){
	this.pantheon.insertSortedIffNotPresent(ido);
};
Realm.prototype.removeUser = function(ido){
	this.pantheon.removeIffPresent(ido, function(a,b){return a.id == b.id});
}
Realm.prototype.setTitle = function(v){ this.title = v; };
Realm.prototype.updatePantheonView = function(){
	var lineup = document.getElementById('localPantheon');
	clearEl(lineup);
	var canspan = lineup.offsetHeight;
	var bindToolTipToEl = function(el, text){
		var tipOn = new DataSource();
		var tipOff = new DataSource();
		el.addEventListener('mouseover', function(){
			var canloc = elementLocation(el);
			canloc.x += el.offsetWidth/2;
			canloc.y += el.offsetHeight;
			tipOn.publish({p:canloc, text:text});
		});
		el.addEventListener('mouseout', function(){tipOff.publish()});
		bindToolTip(tipOn, tipOff);
	};
	if(this.id == '7' || currentPosition.id == '94'){ //special case for The Babel and the room before it
		var theAll = document.createElement('div');
		theAll.classList.add('godProfile');
		theAll.textContent = '∀';
		bindToolTipToEl(theAll, 'the all');
		lineup.appendChild(theAll);
	}else{
		this.pantheon.forEach(function(c){
			var can = iconFor(c.v, canspan, treadedNodeColor);
			can.classList.add('godProfile');
			bindToolTipToEl(can, c.v.name);
			lineup.appendChild(can);
		});
	}
};


function Position(){
	this.links = new List();
}
Position.instateOrGet = function(posid, title){
	var pos = Position.getp(posid);
	if(pos){
		return pos;
	}else{
		var n = new Position();
		n.id = posid;
		if(userData){ //find out if starred
			n.starred = !!userData.rememberry.findFirstMatch(function(d){return d.id == n.id});
		}
		n.title = title;
		Position.cache[posid] = n;
		return n;
	}
};
Position.freshId = 0;
Position.createIncomplete = function(screenPosition, positionLinkedFrom, realm){ //Always cognisses the edge. all vars optional
	var v = new Position();
	v.realm =
		realm ||
		(positionLinkedFrom &&
			(positionLinkedFrom.id == '94' ?
				Realm.getOrInstate('7') :
				positionLinkedFrom.realm)) || 
		currentPosition.realm;
	v.isReadable = true;
	v.engraph(screenPosition && graff.fromScreen(screenPosition));
	positionLinkedFrom && positionLinkedFrom.link(v).setCognissLinkTo(v, true);
	return v;
};

Position.instateOrUpdate = function(jsonData){ //returns an awaited resolving the completed positionData
	var prec = Position.instateOrGet(jsonData.id, jsonData.title);
	prec.isReadable = true;
	prec.illustration = jsonData.illustration;
	var countObject = {};
	var changed = false;
	prec.timestamp = prec.serverTimestamp = jsonData.serverTimestamp;
	//start resolving the realm [usually instant]
	if(jsonData.realm.constructor != String) throw 'the fuck';
	var gettingRealm = Realm.getFuture(jsonData.realm);
	//links
	jsonData.paths.forEach(function(p){
		countObject[p.id] = p;
	});
	prec.links.forEach(function(c){
		var onode = c.v.other(prec);
		var oname = onode.id;
		if(oname){ //oname == undefined for half-formed nodes only the client knows
			if(countObject.hasOwnProperty(oname)){ //then merge the relationship in
				if(c.v.linkFrom(prec))
					delete countObject[oname];
			}else{
				//assuming jsonData is a complete list of which links we have.
				prec.unlink(onode);
			}
		}
	});
	for(var c in countObject){ //all that remains in here are new
		var co = countObject[c];
		var t = Position.instateOrGet(c, co.title);
		prec.link(t, co.relationship);
	}
	var backLinkCountObject = {};
	jsonData.backlinks.forEach(function(r){backLinkCountObject[r.id] = r;});
	prec.links.forEach(function(c){
		var onode = c.v.other(prec);
		var oname = onode.id;
		if(oname){ //again, half-formed nodes are ignored
			if(backLinkCountObject.hasOwnProperty(oname)){
				delete backLinkCountObject[oname];
			} //is NOT treated as an authoratative list of backlinks, as backlink lists could be anticipated to be exceedingly long and irrelevant to the user, in most cases.
		}
	});
	for(var c in backLinkCountObject){
		Position.instateOrGet(c, backLinkCountObject[c].title).link(prec);
	}
	return gettingRealm.map(
		function(r){
			prec.realm = r;
			if(prec == currentPosition)
				slideInPosition(prec);
			return prec});
}
Position.cache = {};
Position.getp = function(id){
	return Position.cache[id];
}
Position.prototype.id = null;
Position.prototype.title = null;
Position.prototype.timestamp = '';
Position.prototype.serverTimestamp = '';
Position.prototype.links = null;
Position.prototype.realm = null;
Position.prototype.starred = false;
Position.prototype.isModified = false;
Position.prototype.illustrationChanged = false;
Position.prototype.titleChanged = false;
Position.prototype.linksChanged = false;
//links: a dlist of connections,
Connection.prototype.ofForth = null; //PathLinks
Connection.prototype.foForth = null; //
Connection.prototype.ofBackCognissed = false; //iff o <- f has been cognissed.
Connection.prototype.foBackCognissed = false;
Connection.prototype.oNode = null;
Connection.prototype.fNode = null;
Connection.prototype.graphEdge = null;
function PathLink(positionData, relationship){
	this.title = positionData.title;
	this.relationship = relationship;
	this.positionData = positionData;
}
PathLink.prototype.relationship = null;
PathLink.prototype.altered = false; //set to false when synched with the server
PathLink.prototype.element = null; //the element associated with the link. Remember to annull when the position is unfocussed.
PathLink.prototype.reserveAlterations = function(){
	if(this.element){
		if(this.altered){
			if(textualEffectivelyEmpty(this.element)){
				this.relationship = null;
			}else{
				this.relationship = this.element.innerHTML;
			}
		}
	}
};
PathLink.prototype.positionData = null;
function Connection(n1, n2){
	this.oNode = n1;
	this.fNode = n2;
}
Connection.prototype.link = function(target, relationship){ //will update the graph if needed
	var pl = new PathLink(target, relationship);
	if(target == this.oNode){
		if(this.foForth){ //merge
			if(relationship) this.foForth.relationship = relationship;
			return this.foForth;
		}else{
			this.foForth = pl;
		}
	}else if(target == this.fNode){
		if(this.ofForth){ //merge
			if(relationship) this.ofForth.relationship = relationship;
			return this.ofForth;
		}else{
			this.ofForth = pl;
		}
	}else{
		throw new Error("can't link to a target not included in the relationship");
	}
	this.considerEngraphing();
	return pl;
};
Connection.prototype.backLinkToCognissedAndBothGraphed = function(node){
	return (this.oNode.nodeQueueLNode && this.fNode.nodeQueueLNode) &&
				 this.backLinkToCognissed(node);
};
Connection.prototype.backLinkToCognissed = function(node){ //iff the backlink to node is cognissed
	return (this.oNode == node && this.ofBackCognissed) ||
				 (this.fNode == node && this.foBackCognissed);
};
Connection.prototype.setCognissLinkTo = function(origin, v){ //may engraph/degraph
	if(origin == this.oNode){
		if(this.ofBackCognissed ^ v){
			if(v){
				this.ofBackCognissed = true;
				this.considerEngraphing();
			}else{
				this.ofBackCognissed = false;
				this.considerDegraphing();
			}
		}
	}else if(origin == this.fNode){
		if(this.foBackCognissed ^ v){
			if(v){
				this.foBackCognissed = true;
				this.considerEngraphing();
			}else{
				this.foBackCognissed = false;
				this.considerDegraphing();
			}
		}
	}else{
		throw new Error('origin is not in this link');
	}
};
Connection.prototype.isEmpty = function(){
	return !(this.ofForth || this.foForth);}
Connection.prototype.other = function(node){
	return (node == this.oNode)?
		this.fNode:
		((node == this.fNode)?
			this.oNode : null);}
Connection.prototype.considerDegraphing = function(){
	if(
		this.graphEdge &&
		(!(this.ofBackCognissed || this.foBackCognissed) ||
			!this.oNode.nodeQueueLNode || !this.fNode.nodeQueueLNode)
	){
		this.degraph();
	}
};
Connection.prototype.degraph = function(){
	if(!this.graphEdge) return;
	graph.removeEdge(this.graphEdge);
	this.graphEdge = null;
};
Connection.prototype.unlink = function(from, to){ //will update the graph and the nodes if needed.
	if(from == this.oNode && to == this.fNode){
		this.ofForth = null;
		this.ofBackCognissed = false;
	}else if(from == this.fNode && to == this.oNode){
		this.foForth = null;
		this.foBackCognissed = false;
	}
	if(this.isEmpty()){
		this.degraph();
	}
};
Connection.prototype.considerEngraphing = function(){ //man a change propagation framework would be welcome here. I could add it to shiver, I guess...
	if(
		(this.oNode.nodeQueueLNode && this.fNode.nodeQueueLNode) &&
		(this.ofBackCognissed || this.foBackCognissed)
	){
		this.engraph();
	}
};
Connection.prototype.engraph = function(){
	if(this.graphEdge || !this.oNode.nodeQueueLNode || !this.fNode.nodeQueueLNode) return;
	this.graphEdge = graph.newEdge(this.oNode.nodeQueueLNode.v, this.fNode.nodeQueueLNode.v);
};
Connection.prototype.speaksOf = function(node){
	return (this.oNode == node) || (this.fNode == node);
};
Connection.prototype.linkFrom = function(node){
	if(this.oNode == node)
		return this.ofForth;
	else if(this.fNode == node)
		return this.foForth;
	else return null;
}
Connection.prototype.doesLink = function(from, to){
	return ((from == this.oNode && to == this.fNode && this.ofForth) ||
					(from == this.fNode && to == this.oNode && this.foForth)) ;
};
//backlinks are PathLinks which may or may not have the isCognissed flag set, reflecting whether the user is aware of the backlink. If the user is aware that they came to a location by entering the spirit of a wooden parrot, then don't hide the parrot, they might want to go back through the parrot portal. But if they're not, showing the parrot would be very confusing.
Position.prototype.isReadable = false;
//isReadable iff the node is complete enough to be navigated to.
Position.prototype.isTreaded = false;
//isTreaded iff the node has been visited.
Position.prototype.nodeQueueLNode = null;
//list node to the graph node in the visualization if visible.
Position.prototype.illustration = "";
Position.prototype.linked = function(othernode){
	var dis = this;
	return this.links.findFirstMatch(function(c){
		return c.linkFrom(dis) && c.other(dis) == othernode;});
};
Position.prototype.forgeLink = function(othernode){ //saves the link with the server if new. Always cognisses.
	if(!this.linked(othernode)){
		this.link(othernode).setCognissLinkTo(othernode, true);
		if(this.online() && othernode.online())
			doTransactions(linkOp(this, othernode)).then(
				null,
				function(note){pushLine('could not save new link to server. ' + (note||''), true)});
	}
};
Position.prototype.setRealm = function(newRealm){
	var tran = doTransactions(reassignRealmOp(this, newRealm));
	var self = this;
	tran.then(function(res){
		self.realm = newRealm;
		if(self == currentPosition){
			newRealm.updatePantheonView();
		}
	});
	return tran;
};
Position.prototype.link = function(othernode, text){ //text optional. returns the connection.
	var precedent = this.links.findFirstMatch(
		function(c){return c.speaksOf(othernode)});
	var con;
	if(!precedent){
		con = new Connection(this, othernode);
		this.links.pushFront(con);
		othernode.links.pushFront(con);
	}else{
		con = precedent.v;
	}
	var pl = con.link(othernode, text);
	if(this == currentPosition){
		if(pl.element){
			pl.element.innerHTML = text;
		}else{
			var list = document.getElementById('linklist');
			list.insertBefore(forwardLinkEl(currentPosition, con), list.firstChild);
			editor.deactivate();
			editor.activate(); //includes the new link, as it has class editable
		}
	}
	return con;
};
Position.prototype.destroy = function(){ //removes from local
	var dis = this;
	this.links.forEach(function(c){
		var onode = c.v.other(dis);
		dis.unlink(onode);
		onode.unlink(dis);
	});
	this.degraph();
	if(this.id)
		delete Position.cache[this.id];
	if(this == currentPosition){
		history.back();
	}
};
Position.prototype.destroyRightly = function(){ //attempts to remove absolutely
	var aw;
	if(this.online()){
		aw = doTransactions(destroyPosition(currentPosition));
		var self = this;
		aw.then(function(){
			self.destroy();
		});
	}else{
		aw = new Awaited();
		this.destroy();
		aw.publish(redundanceMessage);
	}
	return aw;
}
Position.prototype.cogniss = function(){
	var dis = this;
	this.links.forEach(function(con){
		if(con.v.linkFrom(dis))
			con.v.setCognissLinkTo(dis, true);
	});
	this.engraphThisAndCognissedNeighbors();
};
Position.prototype.isComplete = function(){return this.title.length > 0;};
Position.prototype.color = function(){
	return this == currentPosition ?
		selectedNodeColor():
		this.isTreaded?
			treadedNodeColor() :
			backgroundColor();
};
Position.prototype.controlledBy = function(ident){
	return this.id == '94' || this.realm.id == '7' ||
		!!this.realm.pantheon.findFirstMatch(
			function(c){return c.id == ident.id});
};
Position.prototype.tread = function(){ //handles the change in the model as we transfer to the new node
	previousPosition = currentPosition;
	currentPosition = this;
	this.isTreaded = true;
	this.cogniss();
	graff.setFocusNode(this.nodeQueueLNode.v);
	if(!previousPosition || previousPosition.id == '94' || this.id == '94' || previousPosition.realm != this.realm){
		updateIdenticon();
		this.realm.updatePantheonView();
	}
	if(previousPosition){
		//annull references to link elements and store state from editions.
		previousPosition.links.forEach(function(c){
			var outgo = c.v.linkFrom(previousPosition);
			outgo && outgo.reserveAlterations();
		});
		previousPosition.title = document.getElementById('title').textContent;
		previousPosition.illustration = document.getElementById('illustration').innerHTML;
	}
}
Position.prototype.update = function(){
	if(!this.online()) return;
	var self = this;
	fetchPosition(this.id).then(function(r){
		if(r.serverTimestamp > self.serverTimestamp){
			if(self.isModified){
				//drop it and complain
				pushLine("another god has altered this position since you started. Be sure you keep out of each others' way.", true);
			}else{
				Position.instateOrUpdate(r);
			}
		}
	});
};
Position.prototype.discardChanges = function(){
	var aw = new Awaited();
	if(!this.online()){
		aw.ashame("there is no state to revert to, this position was never saved.");
	}else{
		this.setModified(false);
		var fetch = fetchPosition(this.id);
		fetch.then(function(r){
			Position.instateOrUpdate(r);
		});
		fetch.chain(aw);
	}
	return aw;
}
Position.prototype.getLinkTo = function(other){
	return this.links.findFirstMatch(
		function(c){return c.speaksOf(other);});
};
Position.prototype.unlink = function(othernode){ //fully removes from this.links if necessary
	var connection = this.getLinkTo(othernode);
	if(connection){
		connection.v.unlink(this, othernode);
		if(connection.v.isEmpty()){
			this.links.removeNode(connection);
			othernode.links.removeNode(othernode.getLinkTo(this));
		}
	}
};
Position.prototype.unforgeLink = function(other){ //returns the awaited transaction
	var aw;
	if(this.linked(other)){
		this.unlink(other);
		aw = doTransactions(unlinkOp(this, other));
		aw.then(null, function(note){pushLine("can't sever the link. " + note, true)});
	}else{
		aw = new Awaited();
		aw.publish(redundanceMessage);
	}
	return aw;
};
Position.prototype.online = function(){
	return this.id;
};
Position.prototype.setLinkChanged = function(connection){
	this.setModified(true);
	this.linksChanged = true;
	connection.linkFrom(this).altered = true;
}
Position.prototype.reserveLinkAlterations = function(){
	var self = this;
	this.links.forEach(function(c){
		var ln = c.v.linkFrom(self);
		if(ln) ln.reserveAlterations();
	});
};
Position.prototype.createNodeOnServer = function(){ //By the time the awaited is satisfied, this position will have its id, and will be marked as being online. This operation includes the recording of links to and from saved nodes.
	var aw = new Awaited();
	if(this.online()){
		aw.publish(this.id);
	}else{
		this.reserveLinkAlterations();
		var self = this;
		doTransactions(creationOp(this)).then(function(r){
			self.id = r.posId;
			if(currentPosition == self)
				history.replaceState(self.id, self.title||standardAppTitle, self.id);
			Position.cache[self.id] = self;
			graff.startUpdatingBoard();
			//check to save formerly unlogged links
			var linkTransactions = [];
			self.links.forEach(function(c){
				var other = c.v.other(self);
				if(other.online()){
					var plin = c.v.linkFrom(self);
					if(plin)
						linkTransactions.push(linkOp(self, other, plin.relationship));
					var oplin = c.v.linkFrom(other);
					if(oplin)
						linkTransactions.push(linkOp(other, self, oplin.relationship));
				}
			});
			if(linkTransactions.length)
				doTransactions(linkTransactions).chain(aw);
			else
				aw.publish();
		}, function(note){
			aw.ashame(note);
		});
	}
	return aw;
};
Position.prototype.save = function(){ //returns the moment of save. Assumes the creation ops have gone through and this node is online. Does not assume other creation ops have gone through, 
	var aw = new Awaited();
	var tcreation = this.createNodeOnServer();
	tcreation.burden(aw);
	var self = this;
	tcreation.then(function(){
		if(self.isModified){
			var transactions = [];
			var ops = [];
			var creations = [];
			var beingCreated = [];
			if(self.illustrationChanged){
				ops.push(
					alterIllustrationEdition(
						document.getElementById('illustration').innerHTML));
			}
			if(self.titleChanged){
				ops.push(
					alterTitleEdition(
						document.getElementById('title').textContent));
			}
			if(self.linksChanged){
				self.links.forEach(function(c){
					var fn = c.v.other(self);
					var plin = c.v.linkFrom(self);
					if(plin && plin.altered){
						plin.reserveAlterations();
						if(!fn.online()){
							creations.push(fn.createNodeOnServer()); //not ideal. Sending off each request individually instead of getting all the location IDs in one batch. A better architecture isn't exactly springing to mind right now though.
							beingCreated.push(c.v);
						}else{
							ops.push( alterLinkOp(fn, plin.element.innerHTML));
						}
						plin.altered = false;
					}
				});
			}
			var creatings = awaitAll(creations);
			creatings.burden(aw);
			creatings.then(function(){
				beingCreated.forEach(function(c){
					var el = c.linkFrom(self).element;
					transactions.push(linkOp(
						self,
						c.other(self),
						textualEffectivelyEmpty(el)?
							null:
							el.innerHTML))});
				transactions.push(editionOp(self, ops));
				doTransactionListReportingToAwaited(aw, transactions);
			});
			aw.then(function(){
				self.setModified(false);
			}, function(note){
				pushLine("Saving position state failed. " + note, true);
			});
		}else{
			aw.publish(redundanceMessage);
		}
	});
	return aw;
};
Position.prototype.setStarred = function(whether){ //returns server starring
	var trans = null;
	if(this.starred ^ whether){
		var collectionl = document.getElementById('notedPages');
		var self = this;
		var memActual = userData.rememberry.findFirstMatch(function(c){return c.id == self.id});
		if(whether){
			trans = doTransactions(starOp(this));
			if(!memActual){
				var mark = document.createElement('div');
				mark.classList.add('trayItem');
				mark.textContent = this.title;
				mark.addEventListener('mousedown', (function(curPo){return function(ev){
					tryToNavigateToPosition(curPo);
				}})(this));
				collectionl.insertBefore(mark, collectionl.firstChild);
				var mem = userData.rememberry.pushBack({name: this.title, id: this.id, el: mark});
			}
			document.body.classList.add('starred');
		}else{
			trans = doTransactions(unstarOp(this));
			if(memActual){
				collectionl.removeChild(memActual.v.el);
				userData.rememberry.removeNode(memActual);
			}
			document.body.classList.remove('starred');
		}
		this.starred = whether;
	}
	if(!trans){
		trans = new Awaited();
		trans.publish(redundanceMessage);
	}
	return trans;
};
Position.prototype.setModified = function(whether){
	if(this.isModified ^ whether){
		if(whether){
			if(this == currentPosition){
				document.body.classList.add('modified');
				var dis = this;
				document.getElementById('changeSender').onmousedown = function(ev){
					outputTransaction(currentPosition.save());
				};
			}
		}else{
			if(this == currentPosition)
				document.body.classList.remove('modified');
			this.illustrationChanged = false;
			this.titleChanged = false;
			this.linksChanged = false;
			var dis = this;
			this.links.forEach(function(c){
				var fl = c.v.linkFrom(dis);
				if(fl)
					fl.altered = false;
			});
		}
		this.isModified = whether;
	}
};
Position.prototype.engraph = function(pos){ //pos is optional
	if(this.nodeQueueLNode){
		nodeQueue.removeNode(this.nodeQueueLNode);
		nodeQueue.insertFront(this.nodeQueueLNode);
	}else{
		++nodeQueueCount;
		if(nodeQueueCount > nodeQueueLimit)
			nodeQueue.back().v.data.grandMomentData.degraph();
		var startingpos = undefined;
		if(pos){
			startingpos = pos;
		}else{
			var dis = this;
			this.links.findFirstMatch(function(con){ //findFirstMatch is used here to allow breaking/continuing from the foreach.
				var nd = con.other(dis);
				if(!nd.nodeQueueLNode) return false;
				var np = graff.layout.point(nd.nodeQueueLNode.v).p;
				graff.currentNewNodeAngle += graff.angleIncrement;
				var initialRad = 1.9;
				startingpos = np.add(new Springy.Vector(
					initialRad*Math.cos(graff.currentNewNodeAngle),
					initialRad*Math.sin(graff.currentNewNodeAngle)));
				return true;
			});
		}
		var node = graph.newNode({
			grandMomentData: this,
			mass: 0.43,
			initialPos: startingpos });
		this.nodeQueueLNode = nodeQueue.pushFront(node);
		setTimeout(function(){
			graff.layout.point(node).m = 1;
		}, 1200);
	}
	var dis = this;
	this.links.forEach(function(c){
		c.v.considerEngraphing();
	});
};
Position.prototype.engraphThisAndCognissedNeighbors = function(){
	this.engraph();
	var dis = this;
	this.links.forEach(function(om){
		if(om.v.backLinkToCognissed(dis)){
			om.v.other(dis).engraph();
		}
	});
};
Position.prototype.degraph = function(){
	if(!this.nodeQueueLNode) return;
	graph.removeNode(this.nodeQueueLNode.v);
	nodeQueue.removeNode(this.nodeQueueLNode);
	--nodeQueueCount;
	this.nodeQueueLNode = null;
	this.links.forEach(function(c){c.v.considerDegraphing()});
};

function forEachArrayAnywhereWithin(arr, f){
	f(arr);
	arr.forEach(function(el){
		if(el.constructor == Array)
			forEachArrayAnywhereWithin(el, f);
	});
}

function boostLNodeSalience(lnode){
	nodeQueue.removeNode(lnode);
	nodeQueue.insertFront(lnode);
}

function setLoadingMode(on){ //whether the page is sitting around waiting for the next to arrive.
	if(loadingMode ^ on){ //then this is a change.
		loadingMode = on;
		var spinner = document.getElementById('spinner');
		if(on){
			spinner.classList.add('showing');
		}else{
			spinner.classList.remove('showing');
		}
	}
}

function createAndNavToRealm(realmName){
	var tr = Realm.createNew(realmName);
	tr.then(function(realm){
		tryToNavigateToPosition(Position.createIncomplete(null, null, realm));
	});
	return tr;
}

function hasEditableText(element){
	return element.isContentEditable || element.tagName == 'input' || element.tagName == 'INPUT';
}

function doTransactionListReportingToAwaited(aw, tlist){
	if(!selectedId || !userData){
		aw.ashame('cannot construct operation specification, not identified');
	}
	postJsonGetJson('/action', {
		identity: selectedId.id,
		authorizationKey: userData.token,
		ops: tlist.slice()
	}).then(function(res){
		if(res.status == 'authorization key expired. Please log in again.'){
			considerLoggingIn.then(
				function(){doTransactionListReportingToAwaited(aw, tlist);},
				function(note){aw.ashame(note);});
		}else if(res.status == 'shiny'){
			aw.publish(res);
		}else if(res.status == 'no'){
			aw.ashame(res.detail);
		}else{
			aw.ashame('unknown error in exacting transactions');
		}
	}, function(note){
		aw.ashame(note);
	});
}
function doTransactions(){
	var aw = new Awaited();
	var argList =
		arguments[0].constructor == Array ? arguments[0] :
		[].slice.call(arguments) /*RRROOAAAAARRRRRRR*/;
	doTransactionListReportingToAwaited(aw, argList);
	return aw;
}

function editionOp(positionConcerned, editions){
	return {
		opname: 'edit',
		posId: positionConcerned.id,
		properties: editions
	};
}
function alterIllustrationEdition(newIllustration){
	return {
		property: 'illustration',
		val: newIllustration
	};
}
function alterTitleEdition(newTitle){
	return {
		property: 'title',
		val: newTitle
	};
}
function alterLinkOp(dst, newIllustration){
	return {
		property: 'link',
		dst: dst.id,
		illustration: newIllustration
	};
}

function creationOp(position){
	return {
		opname: "create",
		realmId: position.realm.id
	};
}

function foundRealmOp(realmName){
	return {
		opname: "foundRealm",
		realmName: realmName
	};
}

function destroyPosition(position){
	return {
		opname: "destroy",
		posId: position.id
	};
}

function linkOp(src, dst, illustration){ //illustration optional
	var o = {
		opname: "link",
		srcWorldId: src.id,
		dstWorldId: dst.id
	};
	if(illustration)
		o.illustration = illustration;
	return o;
}

function createIdentityOp(name){ //name optional
	var o = {
		opname: "createidentity",
	};
	if(name) o.name = name;
	return o;
}

function identityNameOp(identity, newName){
	return {
		opname: "idname",
		idId: identity.id,
		newName: newName
	};
}

function unlinkOp(from, to){
	return {
		opname: "unlink",
		srcWorldId: from.id,
		dstWorldId: to.id
	};
}

function inductOp(realm, idId){
	return {
		opname: "induct",
		realmId: realm.id,
		subject: idId
	};
}

function starOp(pos){
	return {
		opname: "remember",
		posId: pos.id
	};
}

function unstarOp(pos){
	return {
		opname: "forget",
		posId: pos.id
	};
}

function reassignRealmOp(pos, realm){
	return {
		opname: "transfer",
		posId: pos.id,
		newRealmId: realm.id
	};
}

function textualEffectivelyEmpty(el){
	// function recurse(el, condition){
	// 	if(el.children){
	// 		for(var i=0; i<el.children.length; ++i){
	// 			if(!recurse(el.children[i], condition))
	// 				return false;
	// 		}
	// 	}else{
	// 		return condition(el);
	// 	}
	// }
	// return recurse(el, function(el){
		return el.textContent.length==0;
	// });
}

var filterAbbreviatedPosIdFromResource = /\/(-?\d+)/;

function bindHovers(el, pos){
	function startIndicate(){
		if(pos.nodeLightAnimation)
			pos.nodeLightAnimation.stop();
		if(pos.nodeFadeAnimation)
			pos.nodeFadeAnimation.stop();
		var currentLighting = pos.lighting || 0;
		pos.nodeLightAnimation = graff.startAnimation(function(time){
			pos.lighting = currentLighting + (1 - currentLighting)*time;
		}, 90);
		pos.nodeFadeAnimation = graff.startAnimation(function(progress){
			pos.lightingOpacity = 1 - Math.pow(progress, 2);
		}, 5300);
	};
	function retractIndicate(){
		if(pos.nodeLightAnimation)
			pos.nodeLightAnimation.stop();
		if(pos.nodeFadeAnimation)
			pos.nodeFadeAnimation.stop();
		var currentLighting = pos.lighting || 0;
		pos.nodeLightAnimation = graff.startAnimation(function(time){
			pos.lighting = currentLighting - currentLighting*time;
		}, 90);
	};
	el.addEventListener('mouseover', startIndicate);
	el.addEventListener('mouseout', retractIndicate);
	el.addEventListener('mousedown', retractIndicate);
}
function bindDivToPosition(div, arrow, pos){
	div.addEventListener('mousedown', function(ev){
		if(!isEditMode)
			tryToNavigateToPosition(pos);
	});
	if(arrow)
		arrow.addEventListener('mousedown', function(ev){
			if(isEditMode)
				tryToNavigateToPosition(pos);
		});
	bindHovers(div, pos);
}
function bindAToPosition(a, pos){
	a.addEventListener('click', function(ev){
		tryToNavigateToPosition(pos);
		ev.preventDefault();
	});
	bindHovers(a, pos);
}
function forwardLinkEl(pos, rel){
	var onode = rel.other(pos);
	var flink = rel.linkFrom(pos);
	var el = document.createElement('div');
	el.classList.add('listLink');
	el.style.position = 'relative';
	var text = document.createElement('div');
	text.classList.add('editable');
	text.addEventListener('input', function(){
		pos.setLinkChanged(rel);
	});
	text.classList.add('listLinkText');
	text.innerHTML =
		(flink && flink.relationship) || (onode.title? '<p>'+onode.title+'</p>' :
		(onode.online()? '<p>#'+onode.id+'</p>' : '<p><br></p>'));
	flink.element = text;
	var arrow = document.createElement('div');
	arrow.classList.add('minorFont');
	arrow.classList.add('listLinkArrow');
	// arrow.textContent = '❯❯'; //the kerning. There is none.
	arrow.textContent = '➜';
	bindDivToPosition(el, arrow, onode);
	el.appendChild(arrow);
	el.appendChild(text);
	return el;
}
function treversalLinkEl(pos, rel){
	var onode = rel.other(pos);
	var flink = rel.linkFrom(pos);
	var el = document.createElement('div');
	el.classList.add('listLink');
	el.classList.add('treversalLink');
	el.style.position = 'relative';
	var text = document.createElement('div');
	text.classList.add('editable');
	text.addEventListener('input', function(){
		pos.setLinkChanged(rel);
	});
	text.classList.add('listLinkText');
	text.innerHTML =
		(flink && flink.relationship) || (onode.title? '<p>'+onode.title+'</p>' :
		(onode.online()? '<p>#'+onode.id+'</p>' : '<p><br></p>'));
	flink.element = text;
	var titlet = document.createElement('div');
	titlet.classList.add('listLinkTitle');
	titlet.innerHTML =
		(onode.title? '<p>'+onode.title+'</p>' : (flink && flink.relationship)) ||
		(onode.online()? '<p>#'+onode.id+'</p>' : '<p><br></p>');
	var arrow = document.createElement('div');
	arrow.classList.add('minorFont');
	arrow.classList.add('listLinkArrow');
	// arrow.textContent = '❮❮';
	arrow.textContent = '↩';
	bindDivToPosition(el, arrow, onode);
	el.appendChild(arrow);
	el.appendChild(titlet);
	el.appendChild(text);
	return el;
}

function slideInPosition(positionNode){ //positionNode must be engraphed and readable
	var title = document.getElementById('title');
	var illustration = document.getElementById('illustration');
	if(positionNode.id == '92' /*IE, the shifting wall, title:Free*/){
		setTimeout(function(){document.body.classList.add('indicatorsShown')}, 1000);
	}
	treversalLink = null;
	var titleFlow = document.getElementById('titleFlow');
	var pageContent = document.getElementById('pageContent');
	pageContent.classList.remove('easein');
	pageContent.classList.remove('easeinout');
	pageContent.style.left = '0px';
	if(!graphCentral)
		document.body.scrollTop = 0;
	title.textContent = positionNode.title;
	document.title = positionNode.title;
	illustration.innerHTML = positionNode.illustration||""; //illustration is now html instead of markdown. It's sanitized on the server, and considering you're already trusting html the server gave you, I see no benifit to sanitizing it here.
	if(positionNode.isModified)
		document.body.classList.add('modified');
	else
		document.body.classList.remove('modified');
	if(currentPosition.starred)
		document.body.classList.add('starred');
	else
		document.body.classList.remove('starred');
	var list = document.getElementById('linklist');
	while(list.children.length)
		list.removeChild(list.firstChild);
	
	var treversal = null;
	positionNode.links.forEach(function(p){
		var rel = p.v;
		var fl = rel.linkFrom(positionNode);
		var onode = rel.other(positionNode);
		if(fl){
			if( previousPosition && onode == previousPosition ){
				treversal = rel; //handled separately, after the rest.
			}else{
				list.appendChild(forwardLinkEl(positionNode, rel));
			}
		}
	});
	//now add the backlink
	if(treversal){
		// "〈〈 " "⟪" "＜＜" "❯❯" here are some nice alternative arrows.
		var el = treversalLinkEl(positionNode, treversal);
		treversalLink = treversal;
		list.appendChild(el);
	}
	
	//now enhance all of the links on the page
	var links = pageContent.getElementsByTagName('a');
	var makeExternalLink = function(a){
		a.classList.add('external');
		a.target = '_blank';
	}
	var makeNodeConnectionIfRefMakesSense = function(id, a){
		var pos = Position.getp(id);
		if(pos){
			bindAToPosition(a, pos);
		}else{
			makeExternalLink(a);
		}
	}
	for(var i=0; i<links.length; ++i){
		var a = links[i];
		a.style.position = 'relative';
		a.addEventListener('mousedown', function(ev){ev.target.style.top = '1px'});
		a.addEventListener('mouseup', function(ev){ev.target.style.top = '0px'});
		var matching = filterAbbreviatedPosIdFromResource.exec(a.pathname);
		if(matching){
			var resName = matching[1];
			a.href = resName;
			makeNodeConnectionIfRefMakesSense(resName, a);
		}else{
			makeExternalLink(a);
		}
	}
	
	if(isEditMode)
		editor.activate();
	
	setTimeout(function(){
		titleFlow.style.opacity = 1;
		pageContent.classList.remove('easein');
		pageContent.classList.add('easeinout');
		pageContent.style.left = '0px';
		pageContent.style.opacity = 1;
	}, 1); //because it doesn't seem to instate the value we assign above right away =______=
}

function coinRealm(name){ //returns awaited[realm]
	var aw = Realm.createNew(name);
	aw.then(function(realm){
		setEditMode(true);
		selectedId.realms.push(realm);
		tryToNavigateToPosition(Position.createIncomplete(null, null, realm));
	});
	return aw;
}

function createIdentity(name){ //name optional. Returns awaited[identity]
	var creation = doTransactions(createIdentityOp(name));
	creation.then(function(res){
		var newid = {id:res.id, name:res.name, realms:[]};
		userData.identities.pushBack(newid);
		document.getElementById('identities').appendChild(identityEl(newid));
	});
	return creation;
}

function startMoving(goingLeft){
	var title = document.getElementById('titleFlow');
	title.style.opacity = 0;
	var pageContent = document.getElementById('pageContent');
	pageContent.classList.remove('easeinout');
	pageContent.classList.add('easein');
	pageContent.style.opacity = 0;
	pageContent.style.left =
		goingLeft?'-40px':'40px';
	editor.deactivate();
	return awaitTime(300);
}

function identityEl(ident){
	var ide = document.createElement('div');
	ide.appendChild(iconFor(ident, 8));
	ide.appendChild(document.createTextNode(ident.name));
	ide.data = ident;
	ide.classList.add('trayItem', 'loggedInOnly', 'unselected');
	ident.el = ide;
	ide.addEventListener('mousedown', function(ev){
		setSelectedId(ident);
	});
	return ide;
}

function fetchPosition(pId){
	return fetchJson('data/'+pId);
}

function fetchPositionSurrounds(pId){
	return fetchJson('surrounding/'+pId);
}

var navagating = new DataSource();
var pageOver = new DataSource();

function tryToNavigateToPosition(datSpec, isPopping){ //datSpec can be an id, or position data. isPopping optional
	navagating.publish();
	var pId, dat;
	if(datSpec.constructor == String){
		pId = datSpec;
		dat = Position.getp(datSpec);
	}else{
		pId = datSpec.id;
		dat = datSpec;
	}
	var moved = startMoving(!(  (isPopping != undefined)? isPopping : (dat == previousPosition)  ));
	if(dat && dat.isReadable){
		moved.then(function(){
			dat.tread();
			slideInPosition(dat);
			dat.update();
		});
	}else{
		//fetch it, show loading animation.
		setLoadingMode(true);
		var hadDat = !!dat;
		var wasReadable = hadDat && dat.isReadable;
		awaitAll(
			fetchPositionSurrounds(pId).flatmap(function(poses){
				return awaitAll(poses.map(function(p){return Position.instateOrUpdate(p)}))}), //And at that, the acolyte understood why a functional PL needs types.
			moved
		).then(function(o, nothing){
			var pos = Position.getp(pId);
			if(pos){
				pos.tread();
				slideInPosition(pos);
			}else{
				pushLine("The server's response did not contain the requested position data. Wtf? Seriously, wtf??", true);
			}
			setLoadingMode(false);
		},function(note){
			setLoadingMode(false);
			pushLine('Failed to fetch the position data because '+note+'. Please refresh.', true);
			//TODO, notify of error
		});
	}
	
	if(isPopping){
		navigationBackstack.pop();
	}else{
		history.pushState(pId, null, pId); //needs dat.id in there in case the user navigates somewhere before we get the position description then comes back. Without this we would not know where we were.
		navigationBackstack.push(pId);
	}
}

function considerLoggingIn(){
	var naw = new Awaited();
	naw.ashame('idk how to prompt user');
	pushLine('your authorization key has expired. Please log in again.');
	return naw;
}

function loggingin(assertion){
	var fail = function(msg){
		var str = msg || 'login failed';
		pushLine(str, true);
		navigator.id.logout();
	}
	postDataGetJson('/login', assertion).then(function(o){
		if(!o.status){
			fail();
		}else if(o.status == "shiny"){
			communistBear = 12;
			personaLoggedIn = true;
			setUserData(o.user);
		}else{
			fail(o.detail?  o.status + ', ' + o.detail: o.status);
		}
	},
		fail);
}

function setUserData(udat){ //IE, log in
	var controls = document.getElementById('controls');
	if(udat){
		userData = udat;
		userData.rememberry = new List().fromArray(udat.rememberry);
		userData.identities = new List().fromArray(udat.identities);
		pushLine('logged in as ' + userData.email);
		if(!userData.identities.isEmpty()){
			var idlist = document.getElementById('identities');
			userData.identities.forEach(function(idc){
				idlist.appendChild(identityEl(idc.v));
			});
			var oldIdSelection = localStorage.getObject('selectedId', null);
			if(oldIdSelection){
				var id = userData.identities.findFirstMatch(function(cid){return cid.id == oldIdSelection;});
				if(id) setSelectedId(id.v);
			}else
				setSelectedId(userData.identities.front().v);
			var memList = document.getElementById('notedPages');
			userData.rememberry.forEach(function(st){
				var mem = document.createElement('div');
				mem.textContent = st.v.title;
				mem.classList.add('trayItem', 'loggedInOnly');
				var known = Position.getp(st.v.id);
				if(known) known.starred = true;
				mem.addEventListener('mousedown', function(ev){
					tryToNavigateToPosition(st.v.id);
				});
				st.v.el = mem;
				memList.appendChild(mem);
			});
		}else{
			//TODO. new user configuration.
		}
		localStorage.setObject('email', userData.email);
		localStorage.setObject('token', userData.token);
		document.body.classList.add('loggedIn');
	}else{
		userData = null;
		clearEl(document.getElementById('notedPages'));
		clearEl(document.getElementById('identities'));
		document.body.classList.remove('loggedIn');
		setEditMode(false);
	}
}

function setTheme(light){
	if(lightTheme ^ light){
		lightTheme = light;
		if(light){
			document.body.classList.add('lightTheme');
		}else{
			document.body.classList.remove('lightTheme');
		}
		var changerList = document.getElementsByClassName('updateOnThemeChange');
		for(var i=0; i<changerList.length; ++i){
			if(changerList[i].themeChangeCallback)
				changerList[i].themeChangeCallback(light);
			else //assumes svg
				changerList[i].style.color = foregroundColor();
		}
		localStorage.setObject('theme', light);
	}
}

function setEditMode(whether){
	if(isEditMode ^ whether){
		if(whether){
			document.body.classList.add('editMode');
			document.getElementById('title').contentEditable = true;
			graff.setEditMode(whether);
			editor.activate();
		}else{
			document.body.classList.remove('editMode');
			document.getElementById('title').contentEditable = false;
			graff.setEditMode(whether);
			editor.deactivate();
		}
		isEditMode = whether;
	}
}

function loggingout(){
	setUserData(null);
}

function iconFor(identity, width, colorLight, colorDark){
	var can = document.createElement('canvas');
	can.width = can.height = width;
	can.themeChangeCallback = function(light){
		var con = can.getContext('2d');
		con.clearRect(0,0, can.width,can.height);
		con.fillStyle =
			(colorLight && (colorLight.constructor == Function ?
				colorLight() :
				(light? colorLight : colorDark))) || foregroundColor();
		pathHexFace(con, identity.id.hashCode());
		con.fill();
	}
	can.themeChangeCallback(lightTheme);
	can.classList.add('updateOnThemeChange');
	return can;
}

function updateIdenticon(){
	if(!selectedId) return;
	var godfd = document.getElementById('godFaceContainer');
	if(godfd.firstChild){
		godfd.removeChild(godfd.firstChild);
	}
	var hasPerms = currentPosition.controlledBy(selectedId);
	var fac = iconFor(
		selectedId, 24,
		hasPerms? foregroundColor : treadedNodeColor);
	bindToolTip(
		event(fac, 'mouseover').map(function(ev){
			var p = elementLocation(fac);
			p.x += fac.offsetWidth/2;
			p.y += fac.offsetHeight;
			return {
				p:p,
				text: hasPerms?
					'this realm is yours':
					'you do not have permission to alter this realm'};
		}),
		event(fac, 'mouseout'))
	fac.id = 'godFace';
	godfd.appendChild(fac);
}

function setSelectedId(id){
	if(selectedId == id) return;
	selectedId = id;
	if(selectedIdTag){
		selectedIdTag.classList.add('unselected');
	}
	id.el.classList.remove('unselected');
	selectedIdTag = id.el;
	updateIdenticon();
	localStorage.setObject('selectedId', id.id);
}

var smoothDeploymentCount = 0;
var trayPushedOut;
function deployTray(pushed){
	trayPushedOut = pushed;
	if(controlsShown) return;
	if(pushed){
		if(smoothDeploymentCount > 0)
			--smoothDeploymentCount;
	}else{
		if(++smoothDeploymentCount > 4){
			localStorage.setObject('proDeployer', true);
			document.body.classList.add('proDeployer');
		}
	}
	document.body.classList.add('controlsDeployed');
	controlsShown = true;
}
function hideTray(){
	if(!controlsShown) return;
	document.body.classList.remove('controlsDeployed');
	controlsShown = false;
}
function setTrayDeploysOnMouse(bool){
	if(trayDeploysOnMouse == bool) return;
	trayDeploysOnMouse = bool;
	if(bool){
		hideTray();
	}
}

// var linePushQueue = new List();

var pushLineTimeout = null;
var pushBuffer = new List();
function pushLine(text, alarm){
	if(pushLineTimeout != null){
		pushBuffer.pushFront({t:text, a:alarm});
	}
	var backlog = document.getElementById('backlog');
	var cli = document.getElementById('cli');
	if(cli.value.length){
		//TODO idk lol
	}
	var newl = document.createElement('span');
	newl.textContent = text || '♠';
	newl.classList.add('line');
	if(alarm)
		newl.classList.add('feedback');
	backlog.appendChild(newl);
	backlog.style.top = (cli.offsetHeight - backlog.offsetHeight)+'px';
	if(pushLineTimeout != null){
		clearTimeout(pushLineTimeout);
	}
	pushLineTimeout = setTimeout(function(){
		backlog.style.top = (- backlog.offsetHeight)+'px';
		pushLineTimeout = null;
		if(!pushBuffer.isEmpty()){
			var nl = pushBuffer.popBack().v;
			pushLine(nl.t, nl.a);
		}
	}, 2640 + (text? text.length*51 : 0));
}

var commands = { //op returns true iff you want command.usage to be pushlined.
	'destroy':{
		about:"irrecoverably destroys the current position.",
		op:function(args){
			outputTransaction(currentPosition.destroyRightly());
		}},
	'remember':{
		about:"puts the current position in your control bar for later reference.",
		op:function(args){
			outputTransaction(currentPosition.setStarred(true));
		}},
	'forget':{
		about:"removes the current position from your stores.",
		op:function(args){
			outputTransaction(currentPosition.setStarred(false));
		}},
	'nameself':{
		usage: "<new god name>", about:"renames your currently selected identity.",
		op:function(args){
			if(args[2]){
				outputTransaction(doTransactions(identityNameOp(selectedId, args[2]))); //UI wont update. TODO I guess..
			}else{
				return true;
			}
		}},
	'induct':{
		usage: "<god id>", about:"gives the referenced god permission to alter the realm you're currently in.",
		op:function(args){
			if(args[2]){
				outputTransaction(doTransactions(inductOp(currentPosition.realm, args[2])));
			}else{
				return true;
			}
		}},
	'createrealm':{
		usage: "<evocative name>", about:"creates a new realm.",
		op:function(args){
			if(args[2]){
				outputTransaction(coinRealm(args[2]));
			}else{
				return true;
			}
		}},
	'createidentity':{
		usage: "[<god name>]", about:"creates a new identity for you, with the given name, or a generated name if none is given.",
		op:function(args){
			outputTransaction(createIdentity(args[2]));
		}},
	'warp':{
		usage: "<position id>", about:"warps you to the given location.",
		op:function(args){
			if(args[2])
				tryToNavigateToPosition(args[2]);
			else
				return true;
		}},
	'yank':{
		usage: "<realm id>", about:"takes the current position into the given realm. You must must control both the position and the realm to do this.",
		op:function(args){
			if(args[2])
				if(validResId(args[2])){
					Realm.getFuture(args[2]).then(function(args){
						outputTransaction(currentPosition.setRealm(args));
					},function(note){
						pushLine("Couldn't get referenced realm. "+note, true);
					});
				}else
					pushLine('invalid realm id', true);
			else
				return true;
		}},
	'revert':{
		about:"updates this position with the state stored on the server.",
		op:function(args){
			outputTransaction(currentPosition.discardChanges());
		}},
	'help':{
		about:"tells you about the commands", usage: '[<command>]',
		op:function(args){
			var put = function(name){
				var command = commands[name];
				if(command){
					if(command.about)
						pushLine(name+': '+command.about);
					else
						pushLine(name+": no info");
					if(command.usage)
						pushLine('usage: '+name+' '+command.usage);
				}
			};
			if(args[2]){
				if(commands[args[2]])
					put(args[2]);
				else
					pushLine('\''+args[2]+'\' is not a command', true);
			}else{
				for(var c in commands)
					put(c);
			}
		}}
};
var cliParse = /^([a-z]+)\s*(.*)/;
var outputTransaction = function(v){output(v, function(v){return v.detail;})};
function processLine(){
	// var bay = document.getElementById('bay');
	var cli = document.getElementById('cli');
	var res = cliParse.exec(cli.value);
	if(res){
		var command = commands[res[1]];
		if(command){
			if(command.op(res))
				pushLine(command.usage, true);
		}else{
			pushLine('command not recognized', true);
		}
	}else
		pushLine('invalid syntax', true);
	cli.value = '';
}

var otherTooltipDSOff = null;
function bindToolTip(dsOn, dsOff){ //dsOn must send {p{x,y}, text}
	dsOn.then(function(o){
		if(otherTooltipDSOff){
			otherTooltipDSOff.publish();
		}
		otherTooltipDSOff = dsOff;
		var p = o.p;
		var text = o.text;
		if(!text || text == '') return;
		var ttsp = document.createElement('span');
		ttsp.classList.add('tip');
		ttsp.textContent = text;
		document.body.appendChild(ttsp);
		var w = ttsp.offsetWidth;
		var h = ttsp.offsetHeight;
		var l = Math.floor(Math.max(0, p.x - w/2));
		var t = Math.floor(Math.max(0, p.y - h));
		ttsp.style.left = l+'px';
		ttsp.style.top = t+'px';
		ttsp.classList.add('opaque');
		var offs = dsOff.then(function(){
			if(offs) offs.unsubscribe(); //callee can get called before the return of ::then in the case of an immediately satisfied awaited.
			otherTooltipDSOff = null;
			ttsp.classList.remove('opaque');
			setTimeout(function(){
				document.body.removeChild(ttsp);
				ttsp = null;
			},200);
		});
		if(!offs){
			throw new Error('arg');
		}
	});
}

function output(awaited, transform){
	var sub = awaited.then(
		function(res){
			sub && sub.unsubscribe();
			if(transform)
				pushLine(transform(res));
			else
				pushLine(res);
		},function(note){
			sub.unsubscribe();
			pushLine(note, true)
		});
}

function mouseMove(ev){
	if(trayDeploysOnMouse){
		if(!controlsShown){
			if(ev.clientX < 3)
				deployTray();
		}
	}
	return false;
}
window.addEventListener('mousemove', mouseMove);

var graphCentral = false;
window.addEventListener('scroll', function(ev){
	if(graphCentral){
		if(window.pageYOffset + window.innerHeight - 2 < document.body.offsetHeight){
			graphCentral = false;
			graff.setGravity(0,0.5);
		}
	}else{
		if(window.pageYOffset + window.innerHeight + 2 >= document.body.offsetHeight){
			graphCentral = true;
			graff.setGravity(0,0);
		}
	}
});

function size(){
	var page = document.getElementById('page');
	var spinner = document.getElementById('spinner');
	var prop = document.getElementById('prop');
	var graffcontainer = document.getElementById('graff');
	var actionbar = document.getElementById('action');
	var sw = window.innerWidth;
	var sh = window.innerHeight;
	spinner.style.left = Math.round((sw - spinner.offsetWidth)/2) + 'px';
	spinner.style.top = Math.round((sh - spinner.offsetHeight)/2) + 'px';
	prop.style.height = Math.round(window.innerHeight*0.86)+'px';
	var contentPreferredWidth = 530;
	var contentWidth = (sw < contentPreferredWidth)?sw:contentPreferredWidth;
	page.style.left = Math.round((sw - contentWidth)/2)+'px';
	page.style.width = contentWidth+'px';
	graff.pageChange();
}

var moveCount=0;
var clickCount=0; //basically, move and click have a quota of 30 and 4 respectively, and a modality of mouse and touch respectively. Whichever event exceeds event.quota first resolves that the user is favoring event.modality.
function mouseModeDetectionTouch(ev){
	document.body.classList.add('touchMode');
	mouseModeDetectionResolved();
}
function mouseModeDetectionClick(ev){
	if(++clickCount > 3){
		document.body.classList.add('touchMode');
		mouseModeDetectionResolved();
	}
}
function mouseModeDetectionMove(ev){
	if(++moveCount > 22){
		document.body.classList.add('mouseMode');
		mouseModeDetectionResolved();
	}
}
function mouseModeDetectionResolved(){
	document.body.removeEventListener('mousemove', mouseModeDetectionMove);
	document.body.removeEventListener('touchstart', mouseModeDetectionTouch);
	document.body.removeEventListener('click', mouseModeDetectionClick);
}
function mouseModeDetectionBegin(){
	document.body.addEventListener('mousemove', mouseModeDetectionMove);
	document.body.addEventListener('touchstart', mouseModeDetectionTouch);
	document.body.addEventListener('click', mouseModeDetectionClick);
}

var keyEnter=false;
document.addEventListener('keydown', function(kev){
	if(!hasEditableText(document.activeElement)){
		switch(kev.keyCode){
			case 37: //left
				history.back();
			break;
			case 39: //right
				history.forward();
			break;
		}
	}
	switch(kev.keyCode){
		case 13:
			if(!keyEnter && kev.ctrlKey){
				keyEnter = true;
				outputTransaction(currentPosition.save());
				kev.preventDefault();
				kev.stopPropagation();
			}
		break;
	}
});
document.addEventListener('keyup', function(kev){
	switch(kev.keyCode){
		case 13:
			keyEnter = false;
		break;
	}
});


document.addEventListener('DOMContentLoaded', function(){
	
	setTheme(localStorage.getObject('theme', false));
	
	if(localStorage.getObject('proDeployer', false)){
		document.body.classList.add('proDeployer');
	}
	
	editor = new MediumEditor('.editable', {
		buttons: ['bold', 'italic', 'underline', 'anchor', 'header1'],
		firstHeader: 'h2',
		placeholder: 'empty'
	});
	editor.deactivate();
	
	var controls = document.getElementById('controls');
	var ghosty = document.getElementById('ghosty');
	ghosty.addEventListener('mousedown', function(ev){
		if(controlsShown)
			hideTray();
		else{
			deployTray(true);
		}
	});
	pageOver.then(hideTray);
	login.addEventListener('mousedown', function(ev){
		var personaLogin = function(){
			navigator.id.request({siteName: "The Manifold Realms"});
		}
		var oldEmail = localStorage.getObject('email', null);
		var oldToken = localStorage.getObject('token', null);
		if(oldEmail && oldToken){
			//we'll have to eschew our asynchronous vestments, if the token isn't enough, we need to do a persona login, and that needs a popup. Chrome will block popups if they're not happening as the direct result of a user action- an asynchronous callback, apparently, is not direct enough.
			var q = new XMLHttpRequest();
			q.open('POST', 'tokenLogin', false);
			q.setRequestHeader('Content-Type', 'application/json');
			q.send(JSON.stringify({email: oldEmail, authorizationKey: oldToken}));
			if(q.status == 200){
				personaLoggedIn = false;
				var o;
				try{
					o = JSON.parse(q.responseText);
					setUserData(o);
				}catch(e){
					pushLine('json malformed. wtf, server?', true);
				}
			}else if(q.status == 406){
				pushLine("It's been a while. Verify your identity again.");
				localStorage.removeItem('email');
				localStorage.removeItem('token');
				personaLogin();
			}
		}else{
			personaLogin();
		}
	});
	logout.addEventListener('mousedown', function(ev){
		if(personaLoggedIn)
			navigator.id.logout();
		else
			setUserData(null);
	});
	navigator.id.watch({
		loggedInUser:null,
		onlogin: loggingin,
		onlogout: loggingout
	});
	
	var editMode = document.getElementById('editMode');
	var unEditMode = document.getElementById('unEditMode');
	editMode.addEventListener('mousedown', function(){
		setEditMode(true);
	});
	unEditMode.addEventListener('mousedown', function(){
		setEditMode(false);
	});
	
	document.getElementById('notePage').addEventListener('click', function(){
		currentPosition.setStarred(true);
	});
	document.getElementById('unnotePage').addEventListener('click', function(){
		currentPosition.setStarred(false);
	});
	
	setTimeout(function(){
		if(smoothDeploymentCount < 2)
			document.body.classList.add('indicatorsShown');
	}, 80*1000); //users do not need to be introduced to the controls in the first 80 seconds.
	
	mouseModeDetectionBegin();
	
	var pageBroader = document.getElementById('pageBroader');
	pageBroader.addEventListener('mouseover', function(){
		pageOver.publish();
	});
	
	var cli = document.getElementById('cli');
	var lineCandidate = -1;
	var finalWord = /\w+$/;
	cli.addEventListener('input', function(ev){
		switch(ev.which){
		case 32://space
			//so autocomplete if matches
			
		break;
		default:
			
		break;
		}
	});
	cli.addEventListener('keydown', function(ev){
		if(ev.keyCode == 13) processLine();
	});
	
	var illustration = document.getElementById('illustration');
	illustration.addEventListener('input', function(ev){
		currentPosition.illustrationChanged = true;
		currentPosition.setModified(true);
	});
	
	var title = document.getElementById('title');
	title.addEventListener('input', function(ev){
		currentPosition.titleChanged = true;
		currentPosition.setModified(true);
	});
	
	var titleFlow = document.getElementById('titleFlow');
	titleFlow.addEventListener('click', function(ev){
		title.focus();
	});
	
	var themeSwitcher = document.getElementById('themeSwitcher');
	themeSwitcher.addEventListener('mousedown', function(ev){
		setTheme(!lightTheme);
	});
	
	var graffcontainer = document.getElementById('graff');
	graff = new Graff(graffcontainer);
	graff.setGravity(0, 0.53, true);
	graph = graff.graph;
	graff.nodeSelectListeners.then(function(node){
		tryToNavigateToPosition(node.data.grandMomentData);
	});
	
	var placeTooltipOff = streamMerge(navagating, graff.nodeUnhoverListeners, pageOver);
	bindToolTip(graff.nodeHoverListeners, placeTooltipOff);
	
	size();
	var resource = filterAbbreviatedPosIdFromResource.exec(window.location.pathname);
	tryToNavigateToPosition((resource && resource[1]) || '47');
});

window.addEventListener('load', function(){
	var ghosty = document.getElementById('ghosty');
});

window.addEventListener('resize', function(ev){size()});

window.addEventListener('popstate', function(ev){
	if(history.state)
		tryToNavigateToPosition(history.state, true);
});
//the project that made me swear off javascript.
//~mako yass

// identity storage stuff

// Storage.prototype.setObject = function(key, value) {
//     this.setItem(key, JSON.stringify(value));
// }

// Storage.prototype.getObject = function(key) {
//     var value = this.getItem(key);
//     return value && JSON.parse(value);
// }
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

function pointWithinElement(el, point){
	var elor = elementLocation(el);
	return (point.x >= elor.x && point.x < elor.x + el.offsetWidth && point.y >= elor.y && point.y < elor.y + el.offsetHeight)
}

function clearEl(el){
	while(el.firstChild)
		el.removeChild(el.firstChild);
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

//globals:
var graff;
var editor;
var graph;
var navigationBackstack = []; //because for some reason history wont let us access data about that. They probably said "security" and then stopped thinking about it.
var previousPosition;
var standardAppTitle = "The Manifold Realms";
var nodeQueueLimit = 190;
var nodeQueueCount = 0;
var nodeQueueEye = 0; //nodeQueue[nodeQueueEye] is front.
var nodeQueue = new List(); //list of graph nodes
var autoCompletions = [
	'back',
	'edit'
];
var loadingMode = false;
var currentPosition = null;
var treadedNodeColor = '#bbc8bf';
var untreadedNodeColor = '#dbdbdb';
var unreadableNodeColor = '#ffffff';
var selectedNodeColor = '#92a899';
var userIconBackdrop = 'rgb(99,126,118)';
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

var authToken = null;
var commandBarExpanded = false;
var controlsShown = false;
var trayDeploysOnMouse = true;
var identified = false;
var trayItemActivationMethod = null;
var selectedIdTag = null;
var selectedId = null;
var isEditMode = false;
var treversalLink = null;
var redundanceMessage = {status:'shiny', detail:'redundant'};

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
	var dis = this;
	
	this.graph = new Springy.Graph();
	
	window.addEventListener('keydown', function(ev){dis.keyDown(ev);});
	window.addEventListener('keyup', function(ev){dis.keyUp(ev);});
	
	this.graph.addGraphListener(this);
	this.layout = new Springy.Layout.ForceDirected(this.graph, 310,420,0.43);
	this.mousePosition = new Springy.Vector(0,0);
	
	var containerComputedStyle = window.getComputedStyle(container, null);
	this.backgroundStyle = containerComputedStyle.getPropertyValue('background-color') || '#000000';
	
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
highlightColor:'#000000',
highlightRgbStr:'0,0,0',
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
		var c = node.data.grandMomentData.id? node.data.color : this.backgroundStyle;
		var pt = dis.toScreen(point.p);
		dis.drawNode(pt, c);
	});
	this.layout.eachNode(function(node, point){
		var p = node.data.grandMomentData.lighting;
		if(node.data.grandMomentData != currentPosition && p && p > 0){
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
			dis.cancon.fillStyle = 'rgba('+ dis.highlightRgbStr +','+ thickness +')';
			dis.cancon.fill();
		}
	});
},

drawBackground: function(){
	this.cancon.fillStyle = this.backgroundStyle;
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
	if(this.editMode){
	// 	switch(kev.keyCode){    TODO needs careful focus handling. The ideal vision would be to focus wherever the mouse goes.
	// 		case 83: /* s */
	// 			if(!this.keyS){
	// 				this.keyS = true;
	// 				this.extrusionEffecting = true;
	// 				this.checkExtrusion();
	// 			}
	// 		break;
	// 		case 68: /* d */
	// 			if(!this.keyD){
	// 				this.keyD = true;
	// 				this.deleteAction();
	// 			}
	// 		break;
	// 		case 67:
	// 			if(!this.keyC){
	// 				this.keyC = true;
	// 				if(this.editMode)
		// 				this.createAction();
	// 			}
	// 		break;
	// 	}
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
	this.mousePosition.x = ev.x;
	this.mousePosition.y = ev.y;
	var nearest = this.layout.nearest(this.fromScreen(ev));
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
		if(nearnode.node && nearnode.distance <= 1){
			var opos = this.anchorNode.data.grandMomentData;
			var fpos = nearnode.node.data.grandMomentData;
			var con = opos.linked(fpos);
			if(con)
				opos.unforgeLink(fpos);
			else
				opos.forgeLink(fpos);
		}else{
			Position.createIncomplete(this.mousePosition, this.anchorNode.data.grandMomentData);
		}
	}
	this.cancelExtruding();
},
deleteAction: function(){
	var nearn = this.layout.nearest(this.fromScreen(this.mousePosition));
	if(nearn.distance <= 1) this.graph.removeNode(nearn.node);
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
	if(this.clickedDown){
		if(this.extrusionEffecting){
			this.checkExtrusion();
		}else{
			var shiftx = ev.x - this.mousePosition.x;
			var shifty = ev.y - this.mousePosition.y;
			if(shiftx != 0 || shifty != 0){
				this.focusNodeX -= shiftx;
				this.focusNodeY -= shifty;
				this.mousePosition.x = ev.x;
				this.mousePosition.y = ev.y;
				this.startUpdatingBoard();
			}
		}
	}
	var p = this.fromScreen(ev);
	var nearest = this.layout.nearest(p);
	if(nearest.distance > 1) nearest.node = null;
	if(nearest.node != this.hoveredNode){
		this.nodeUnhoverListeners.publish();
		this.hoveredNode = nearest.node;
		if(nearest.node && nearest.node.data.grandMomentData != currentPosition){
			this.nodeHoverListeners.publish({
				p: this.locationOf(nearest.node),
				text: nearest.node.data.grandMomentData.title});
		}
	}
	this.mousePosition.x = ev.x;
	this.mousePosition.y = ev.y;
},
locationOf: function(node){
	return this.toScreen(this.layout.point(node).p);
},
doubleClick: function(ev){
	if(this.editMode)
		this.createAction();
},
clickUp: function(ev){
	this.clickedDown = false;
	if(this.lastClickTime + this.doubleClickDuration > ev.timeStamp)
		this.doubleClick();
	else if(this.editMode){
		var nearnode = this.layout.nearest(this.fromScreen(ev));
		if(nearnode.node){
			if(nearnode.distance >= 1){
				if(nearnode.node != this.anchorNode)
					this.finishExtruding();
			}else if(this.focusNode != nearnode.node){
				this.selectNode(nearnode.node);
			}
		}
		this.cancelExtruding();
	}
	this.lastClickTime = ev.timeStamp;
},
drawEdge: function(node1, node2){
	var c1 = node1.data.color;
	var p1 = this.toScreen(this.layout.point(node1).p);
	var c2 = node2.data.color;
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
	this.pantheon.forEach(function(c){
		var can = iconFor(c.v, canspan, treadedNodeColor);
		can.classList.add('godProfile');
		var tipOn = new DataSource();
		var tipOff = new DataSource();
		can.addEventListener('mouseover', function(){
			var canloc = elementLocation(can);
			canloc.x += can.offsetWidth/2;
			canloc.y += can.offsetHeight+8;
			tipOn.publish({p:canloc, text:c.v.name});
		});
		can.addEventListener('mouseout', function(){tipOff.publish()});
		bindToolTip(tipOn, tipOff);
		lineup.appendChild(can);
	});
};
Realm.prototype.tread = function(){
	this.updatePantheonView();
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
	v.realm = realm || (positionLinkedFrom && positionLinkedFrom.realm) || currentPosition.realm;
	v.isReadable = true;
	v.engraph(screenPosition && graff.fromScreen(screenPosition));
	positionLinkedFrom && positionLinkedFrom.link(v).setCognissLinkTo(v, true);
	return v;
};
Position.instateOrUpdate = function(jsonData){
	var prec = Position.instateOrGet(jsonData.id, jsonData.title);
	prec.isReadable = true;
	prec.illustration = jsonData.illustration;
	prec.realm = jsonData.realm;
	var countObject = {};
	var changed = false;
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
	return prec;
}
Position.cache = {};
Position.getp = function(id){
	return Position.cache[id];
}
Position.prototype.id = null;
Position.prototype.title = null;
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
	this.relationship = relationship || ('<p>'+positionData.title+'</p>');
	this.positionData = positionData;
}
PathLink.prototype.relationship = null;
PathLink.prototype.altered = false; //set to false when synched with the server
PathLink.prototype.element = null; //the element associated with the link. Remember to annull when the position is unfocussed.
PathLink.prototype.positionData = null;
function Connection(n1, n2){
	if(n1.id < n2.id){ //hrm. often, the positions' IDs will be undefined initially. I guess it doesn't really matter.
		this.oNode = n1;
		this.fNode = n2;
	}else{
		this.oNode = n2;
		this.fNode = n1;
	}
}
Connection.prototype.link = function(target, relationship){ //will update the graph if needed
	var pl = new PathLink(target, relationship);
	if(target == this.oNode){
		if(this.foForth){ //merge
			if(relationship) this.foForth.relationship = relationship;
			return;
		}else{
			this.foForth = pl;
		}
	}else{
		if(this.ofForth){ //merge
			if(relationship) this.ofForth.relationship = relationship;
			return;
		}else{
			this.ofForth = pl;
		}
	}
	this.considerEngraphing();
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
		this.graphEdge && !(this.ofBackCognissed || this.foBackCognissed)
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
				function(note){pushLine('could not save new link to server. ' + (note||''))});
	}
};
Position.prototype.link = function(othernode, text){ //text optional. returns the connection.
	var precedent = this.links.findFirstMatch(
		function(c){return c.speaksOf(othernode)});
	var con;
	if(!precedent){
		con = new Connection(this, othernode);
		this.links.pushFront(con);
		othernode.links.pushFront(con);
	}else
		con = precedent.v;
	con.link(othernode, text);
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
	if(previousPosition){
		tryToNavigateToPosition(previousPosition, true);
	}else{
		tryToNavigateToPosition("0", true);
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
Position.prototype.tread = function(){
	this.isTreaded = true;
	this.cogniss();
	graff.setFocusNode(this.nodeQueueLNode.v);
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
		aw.then(null, function(note){pushLine("can't sever the link. " + note)});
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
	var plin = connection.linkFrom(this);
	plin.altered = true;
}
Position.prototype.createNodeOnServer = function(){ //returns an awaited that is fed the id of the new entity, though you wont need it, cause it'll then be logged in the position concerned.
	var aw = new Awaited();
	if(this.online()){
		aw.publish(this.id);
	}else{
		var dis = this;
		doTransactions(creationOp(this)).then(function(r){
			dis.id = r.posId;
			history.replaceState(dis.id, dis.title||standardAppTitle, dis.id);
			Position.cache[dis.id] = dis;
			graff.startUpdatingBoard();
			//check to save unlogged links
			dis.links.forEach(function(c){
				var other = c.v.other(dis);
				if(other.online()){
					if(c.v.linkFrom(dis))
						doTransactions(linkOp(dis, other)).then(
							null,
							function(note){
								pushLine('Could not save links from newly created node. '+note)});
					if(c.v.linkFrom(other))
						doTransactions(linkOp(other, dis)).then(
							null,
							function(note){
								pushLine('Could not save links to newly created node. '+note)})
				}
			});
			aw.publish(r.posId);
		}, function(note){
			aw.ashame(note);
		});
	}
	return aw;
};
Position.prototype.saveStateToServer = function(){ //returns the moment of save
	if(this.isModified){
		var ops = [];
		if(this.illustrationChanged){
			ops.push(
				alterIllustrationEdition(
					document.getElementById('illustration').innerHTML));
		}
		if(this.titleChanged){
			ops.push(
				alterTitleEdition(
					document.getElementById('title').textContent));
		}
		if(this.linksChanged){
			var dis = this;
			this.links.forEach(function(c){
				var fn = c.v.other(dis);
				var plin = c.v.linkFrom(dis);
				if(fn.online() && plin.altered)
					ops.push(
						alterLink(fn.id, plin.element.innerHTML));
			});
		}
		var aw = new Awaited();
		doTransactionListReportingToAwaited(aw, [editionOp(this, ops)]);
		var dis = this;
		aw.then(function(){
			dis.setModified(false);
		}, function(note){
			pushLine("Saving position state failed. " + note, true);
		});
		return aw;
	}else{
		var aw = new Awaited();
		aw.publish(redundanceMessage);
		return aw;
	}
}
Position.prototype.save = function(){ //returns moment of save, includes creation ops if necessary
	var dis = this;
	var aw = new Awaited();
	var saving = function(){
		var saved = dis.saveStateToServer();
		saved.then(null, function(note){
			pushLine(note, true);
		});
		saved.chain(aw);
	};
	if(!dis.id)
		dis.createNodeOnServer(null,function(){pushLine(note)}).then(saving);
	else
		saving();
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
			document.body.classList.add('modified');
			var dis = this;
			document.getElementById('changeSender').onmousedown = function(ev){
				dis.save();
			};
		}else{
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
	if(this.nodeQueueLNode) return;
	if(nodeQueueCount < nodeQueueLimit){
		++nodeQueueCount;
	}else{
		var incumbent = nodeQueue.back();
		nodeQueue.removeNode(incumbent);
		incumbent.v.data.grandMomentData.degraph();
	}
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
		initialPos: startingpos,
		color:
			((this == currentPosition)?
				selectedNodeColor:
				(this.isReadable?
					(this.isTreaded?
						treadedNodeColor:
						untreadedNodeColor):
					unreadableNodeColor))});
	this.nodeQueueLNode = nodeQueue.pushFront(node);
	setTimeout(function(){
		graff.layout.point(node).m = 1;
	}, 1200);
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
			om.v.considerEngraphing();
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

function doTransactionListReportingToAwaited(aw, tlist){
	if(!selectedId || !authToken){
		aw.ashame('cannot construct operation specification, not identified');
	}
	postJsonGetJson('/action', {
		identity: selectedId.id,
		authorizationKey: authToken,
		ops: tlist.slice()
	}).then(function(res){
		if(res.status == 'authorization key expired'){
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
	doTransactionListReportingToAwaited(aw, [].slice.call(arguments) /*RRROOAAAAARRRRRRR*/);
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
function alterLink(dstId, newIllustration){
	return {
		property: 'link',
		dst: dstId,
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

var filterAbbreviatedPosIdFromResource = /\/(-?\d+)/;

function slideInPosition(positionNode){ //positionNode must be engraphed and readable
	previousPosition = currentPosition;
	currentPosition = positionNode;
	if(!previousPosition || currentPosition.realm != previousPosition.realm){
		currentPosition.realm.tread();
	}
	var title = document.getElementById('title');
	var star = document.getElementById('star');
	var illustration = document.getElementById('illustration');
	if(previousPosition){
		if(previousPosition.nodeQueueLNode)
			previousPosition.nodeQueueLNode.v.data.color = treadedNodeColor;
		//annull references to link elements and store state from editions.
		previousPosition.links.forEach(function(c){
			var fl = c.v.linkFrom(previousPosition);
			if(fl && fl.element){
				fl.relationship = fl.element.innerHTML;
				fl.element = null;
			}
		});
		previousPosition.title = title.textContent;
		previousPosition.illustration = illustration.innerHTML;
	}
	treversalLink = null;
	positionNode.nodeQueueLNode.v.data.color = selectedNodeColor;
	var titleFlow = document.getElementById('titleFlow');
	var pageContent = document.getElementById('pageContent');
	pageContent.classList.remove('easein');
	pageContent.classList.remove('easeinout');
	pageContent.style.left = '0px';
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
	var bindHovers = function(el, pos){
		var startIndicate = function(){
			if(pos.nodeLightAnimation)
				pos.nodeLightAnimation.stop();
			var currentLighting = pos.lighting || 0;
			pos.nodeLightAnimation = graff.startAnimation(function(time){
				pos.lighting = currentLighting + (1 - currentLighting)*time;
			}, 90);
		};
		var retractIndicate = function(){
			if(pos.nodeLightAnimation)
				pos.nodeLightAnimation.stop();
			var currentLighting = pos.lighting || 0;
			pos.nodeLightAnimation = graff.startAnimation(function(time){
				pos.lighting = currentLighting - currentLighting*time;
			}, 90);
		};
		el.addEventListener('mouseover', startIndicate);
		el.addEventListener('mouseout', retractIndicate);
		el.addEventListener('mousedown', retractIndicate);
	}
	var bindDivToPosition = function(div, arrow, pos){
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
	};
	var bindAToPosition = function(a, pos){
		a.addEventListener('click', function(ev){
			tryToNavigateToPosition(pos);
			ev.preventDefault();
		});
		bindHovers(a, pos);
	};
	var forwardLinkFromRel = function(rel){
		var onode = rel.other(positionNode);
		var flink = rel.linkFrom(positionNode);
		var el = document.createElement('div');
		el.classList.add('listLink');
		el.style.position = 'relative';
		var text = document.createElement('div');
		text.classList.add('editable');
		text.addEventListener('input', function(){
			positionNode.setLinkChanged(rel);
		});
		text.classList.add('listLinkText');
		text.innerHTML =
			flink.relationship || onode.title ||
			(onode.online()? '#'+onode.id : 'New position');
		flink.element = text;
		var arrow = document.createElement('div');
		arrow.classList.add('minorFont');
		arrow.classList.add('listLinkArrow');
		arrow.textContent = '➜';
		bindDivToPosition(el, arrow, onode);
		el.appendChild(arrow);
		el.appendChild(text);
		return el;
	}
	var treversalLinkFromRel = function(rel){
		var onode = rel.other(positionNode);
		var flink = rel.linkFrom(positionNode);
		var el = document.createElement('div');
		el.classList.add('listLink');
		el.classList.add('treversalLink');
		el.style.position = 'relative';
		var text = document.createElement('div');
		text.classList.add('editable');
		text.addEventListener('input', function(){
			positionNode.setLinkChanged(rel);
		});
		text.classList.add('listLinkText');
		text.innerHTML =
			flink.relationship || '<p>'+onode.title+'</p>' ||
			(onode.online()? '<p>#'+onode.id+'</p>' : '<em>unnamed position</em>');
		flink.element = text;
		var titlet = document.createElement('div');
		titlet.classList.add('listLinkTitle');
		titlet.innerHTML =
			'<p>'+onode.title+'</p>' || flink.relationship ||
			(onode.online()? '<p>#'+onode.id+'</p>' : '<em>unnamed position</em>');;
		var arrow = document.createElement('div');
		arrow.classList.add('minorFont');
		arrow.classList.add('listLinkArrow');
		arrow.textContent = '↩';
		bindDivToPosition(el, arrow, onode);
		el.appendChild(arrow);
		el.appendChild(titlet);
		el.appendChild(text);
		return el;
	}
	var treversal = null;
	positionNode.links.forEach(function(p){
		var rel = p.v;
		var fl = rel.linkFrom(positionNode);
		var onode = rel.other(positionNode);
		if(fl){
			if( previousPosition && onode == previousPosition ){
				treversal = rel; //handled separately, after the rest.
			}else{
				list.appendChild(forwardLinkFromRel(rel));
			}
		}
	});
	//now add the backlink
	if(treversal){
		// "〈〈 " "⟪" "＜＜" here are some nice alternative back arrows.
		var el = treversalLinkFromRel(treversal);
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

function loggedIn(whether){
	if(identified ^ whether){
		var controls = document.getElementById('controls');
		if(whether){ //then assumes userData
			if(!userData.identities.isEmpty()){
				var idlist = document.getElementById('identities');
				userData.identities.forEach(function(idc){
					var id = idc.v;
					var ide = document.createElement('div');
					ide.appendChild(iconFor(id, 18));
					ide.appendChild(document.createTextNode(id.name));
					ide.data = id;
					ide.classList.add('trayItem', 'loggedInOnly', 'unselected');
					id.el = ide;
					ide.addEventListener('mousedown', function(ev){
						setSelectedId(id);
					});
					idlist.appendChild(ide);
				});
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
			document.body.classList.add('loggedIn');
		}else{
			userData = null;
			authToken = null;
			clearEl(document.getElementById('notedPages'));
			clearEl(document.getElementById('identities'));
			document.body.classList.remove('loggedIn');
			setEditMode(false);
		}
		identified = whether;
	}
}

function awaitRequest(httpType, address, data, contentType){
	var pr = new Awaited();
	var q = new XMLHttpRequest();
	q.open(httpType, address, true);
	if(contentType)
		q.setRequestHeader('Content-Type', contentType);
	q.onreadystatechange = function(ev){
		if(q.readyState === 4){
			if(q.status === 200){
				var o;
				try{
					o = JSON.parse(q.responseText);
				}catch(e){
					console.error('json malformed. wtf, server?');
					pr.ashame();
					return;
				}
				pr.publish(o);
			}else{
				console.error('problem fetching json. ' + q.status + '.');
				pr.ashame();
			}
		}
	};
	q.ontimeout = function(ev){
		console.error('ajax query took too long. Network problem?');
		pr.ashame();
	};
	q.send(data || null);
	return pr;
}

function postJsonGetJson(address, data){ //returns an awaited<json of response>.
	return awaitRequest('POST', address, JSON.stringify(data), 'application/json');
}

function postDataGetJson(address, data){ //returns an awaited<json of response>.
	return awaitRequest('POST', address, data);
}

function fetchJson(address){ //returns an awaited<json of response>.
	return awaitRequest('GET', address, null);
}

function fetchPositionSurrounds(pId){
	return fetchJson('surrounding/'+pId);
}

function fetchDependencies(positionData){ //returns awaited that publishes the completed positionData. realms need to be fetched.
	var aw = new Awaited();
	if(positionData.realm.constructor == String){
		Realm.getFuture(positionData.realm).then(function(o){
			positionData.realm = o;
			aw.publish(positionData);
		}, function(note){
			aw.ashame(note);
		});
	}else{ //else the realm is a realm and it is complete
		aw.publish(positionData);
	}
	return aw;
}

function integratePositionData(os){
	var deps = [];
	os.forEach(function(c){
		deps.push(fetchDependencies(c));
	});
	var resolved = awaitAll.apply(null, deps);
	resolved.then(function(){
		for(var i=0; i<arguments.length; ++i){
			Position.instateOrUpdate(arguments[i]);
		}
	});
	return resolved;
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
		dat.tread();
		moved.then(function(){
			slideInPosition(dat);
		});
	}else{
		//fetch it, show loading animation.
		setLoadingMode(true);
		var hadDat = !!dat;
		var wasReadable = hadDat && dat.isReadable;
		awaitAll(
			fetchPositionSurrounds(pId).flatmap(integratePositionData),
			moved
		).then(function(o, nothing){
			var pos = Position.getp(pId);
			if(pos){
				pos.tread();
				slideInPosition(pos);
			}else{
				console.error("The server's response did not contain the requested position data. Wtf? Seriously, wtf??");
			}
			setLoadingMode(false);
		},function(note){
			setLoadingMode(false);
			console.error('Failed to fetch the position data because '+note+'. Please refresh.');
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
			userData = o.user;
			//prep user data
			userData.rememberry = new List().fromArray(userData.rememberry);
			userData.identities = new List().fromArray(userData.identities);
			authToken = o.token;
			loggedIn(true);
			pushLine('logged in as ' + userData.email);
		}else{
			fail(o.detail?  o.status + ', ' + o.detail: o.status);
		}
	},
		fail);
}

function setEditMode(whether){
	if(isEditMode ^ whether){
		if(whether){
			document.body.classList.add('editMode');
			document.getElementById('title').contentEditable = true;
			graff.setEditMode(whether);
			//update treversalLinkElement text if necessary
			if(treversalLink){
				treversalLink.linkFrom(currentPosition).element.innerHTML =
					treversalLink.linkFrom(currentPosition).relationship;
			}
			editor.activate();
		}else{
			document.body.classList.remove('editMode');
			document.getElementById('title').contentEditable = false;
			graff.setEditMode(whether);
			//update treversalLinkElement text if necessary
			if(treversalLink){
				treversalLink.linkFrom(currentPosition).element.innerHTML =
					treversalLink.other(currentPosition).title;
			}
			editor.deactivate();
		}
		isEditMode = whether;
	}
}

function loggingout(){
	loggedIn(false);
}

function iconFor(identity, width, color){
	var can = document.createElement('canvas');
	can.width = can.height = width;
	var con = can.getContext('2d');
	con.fillStyle = color || 'rgb(0,0,0)';
	pathHexFace(con, identity.id.hashCode() ^ 666);
	con.fill();
	return can;
}

function setSelectedId(id){
	if(selectedId == id) return;
	if(selectedIdTag){
		selectedIdTag.classList.add('unselected');
	}
	id.el.classList.remove('unselected');
	selectedIdTag = id.el;
	var godfd = document.getElementById('godFaceContainer');
	if(godfd.firstChild){
		godfd.removeChild(godfd.firstChild);
	}
	var fac = iconFor(id, 50, userIconBackdrop);
	fac.id = 'godFace';
	godfd.appendChild(fac);
	selectedId = id;
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
		if(++smoothDeploymentCount > 4)
			document.body.classList.add('proDeployer');
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
	}, 1000 + (text? text.length*70 : 0));
}

var cliParse = /^([a-z]+)\s*(.*)/;
var outputTransaction = function(v){output(v, function(v){return v.detail;})};
function processLine(){
	// var bay = document.getElementById('bay');
	var cli = document.getElementById('cli');
	var res = cliParse.exec(cli.value);
	if(res){
		switch(res[1]){
		case 'destroy':
			outputTransaction(currentPosition.destroyRightly());
		break;
		case 'star':
			outputTransaction(currentPosition.setStarred(true));
		break;
		case 'unstar':
			outputTransaction(currentPosition.setStarred(false));
		break;
		case 'nameself':
			if(res[2]){
				outputTransaction(doTransactions(identityNameOp(selectedId, res[2]))); //UI wont update. TODO I guess..
			}else{
				pushLine('no, nameself <name>. You have to give a name.', true);
			}
		break;
		case 'induct':
			if(res[2]){
				outputTransaction(doTransactions(inductOp(currentPosition.realm, res[2])));
			}else{
				pushLine("usage: induct <id>. How to get the ID number? You figure it out.", true);
			}
		break;
		case 'createrealm':
			if(res[2]){
				outputTransaction(Realm.createNew(res[2]));
			}else{
				pushLine("usage: createrealm <realm name>", true);
			}
		break;
		default:
			pushLine('command not recognized', true);
		break;
		}
	}
	cli.value = '';
}

function bindToolTip(dsOn, dsOff){ //dsOn must send {p[x,y], text}
	dsOn.then(function(o){
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
			if(ev.x < 1)
				deployTray();
		}else{
			if(ev.x > 9 && !trayPushedOut){
				if(trayItemActivationMethod)
					trayItemActivationMethod();
				hideTray();
			}
		}
	}
	if(controlsShown){
		if(!pointWithinElement(document.getElementById('controls'), ev)){
			hideTray();
		}
	}
	return false;
}
window.addEventListener('mousemove', mouseMove);

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
	prop.style.height = Math.round(window.innerHeight*0.73)+'px';
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


document.addEventListener('DOMContentLoaded', function(){
	
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
	login.addEventListener('mousedown', function(ev){
		navigator.id.request();
	});
	logout.addEventListener('mousedown', function(ev){
		navigator.id.logout();
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
		case 32: //space
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
	
	if(surroundData){
		integratePositionData(surroundData);
	}
	
	tryToNavigateToPosition(startingId);
});

window.addEventListener('load', function(){
	var ghosty = document.getElementById('ghosty');
	document.getElementById('ghostyMimic').style.height = ghosty.offsetHeight+'px';
});

window.addEventListener('resize', function(ev){size()});

window.addEventListener('popstate', function(ev){
	if(history.state)
		tryToNavigateToPosition(history.state, true);
});
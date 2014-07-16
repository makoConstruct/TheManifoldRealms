//mako.shiv(javascript);


function List(comparator){ //all just for constant time removal :[
	if(comparator) this.comparator = comparator;
	this.iterationStack = [];
}
List.prototype ={
	comparator: function(a, b){return a < b}, //elements that verify on the left of the relation will be at the end of the list. Note, for no a, b may compmarator(a,b) and comparator(b,a). This is how we judge equality in IffNotPresent
	sentinel: null, //the sentinel is the head of the list, and it is backlinked to the final element of the list. The list is a closed loop, internally.
	iterationStack: null, //keeps track of the iterations going on. If we're in a forEach, its curIter value will be registered here and kept up to date over changes to the structure of the list.
	isEmpty: function(){return this.sentinel == null},
	makeEmpty: function(){sentinel = null;},
	back: function(){return this.sentinel.prev;},
	front: function(){return this.sentinel;},
	isEnd: function(node){return this.sentinel && this.sentinel.prev == node;},
	isFront: function(node){return this.sentinel && this.sentinel == node;},
	popBack: function(){
		if(this.sentinel){
			var ret = this.sentinel.prev;
			this.removeNode(ret);
			return ret;
		}else return null;
	},
	insertFront: function(node){
		if(this.sentinel)
			this.insertBefore(this.sentinel, node);
		else
			this.sentinel = node;
	},
	removeNode: function(node){
		this.iterationStack.forEach(function(v){
			if(v.v == node){
				if(v.v.next == this.sentinel) v.v = null;
				else v.v = v.v.next;
			}
		});
		if(node == this.sentinel){
			if(node.next == node){
				this.sentinel = null;
				return;
			}else
				this.sentinel = node.next;
		}
		if(node.next){ //otherwise it's not hooked into this list, or any list.
			node.next.prev = node.prev;
			node.prev.next = node.next;
		}
	},
	getLength: function(){//note, just counts them, not even slightly efficient.
		var i =0;
		this.forEach(function(it){++i});
		return i;
	},
	fromArray: function(arr){
		var dis = this;
		arr.forEach(function(el){
			dis.pushBack(el);
		});
		return this;
	},
	insertBefore: function(target, newNode){
		newNode.prev = target.prev;
		newNode.next = target;
		target.prev = newNode;
		newNode.prev.next = newNode;
		if(target == this.sentinel)
			this.sentinel = newNode;
	},
	findFirstMatch: function(pred){ //returns the first node for which pred returns true on the node's inner value.
		if(this.sentinel){
			var iter = this.sentinel;
			do{
				if(pred(iter.v))
					return iter;
				iter = iter.next;
			}while(iter != this.sentinel);
		}
		return null;
	},
	insertAfter: function(target, newNode){
		newNode.next = target.next;
		newNode.prev = target;
		newNode.next.prev = newNode;
		target.next = newNode;
		this.iterationStack.forEach(function(v){
			if(v.v == null){
				if(newNode.next == this.sentinel){
					v.v = newNode.prev; //in other words, if the marker was terminating, it's now before the newNode.
				}
			}
		});
	},
	insertSorted: function(el){ //warning, this introduces some subtle irregularities when done during a forEach. Prefer insertFront or insertBack during these times, if possible.
		var newNode = {
			v:el,
			prev:null,
			next:null };
		if(this.sentinel){
			var iter = this.sentinel;
			while(true){
				if(this.comparator(el, iter.v)){
					if(iter.next != this.sentinel){
						iter = iter.next;
					}else{
						this.insertAfter(iter, newNode);
						break;
					}
				}else{
					this.insertBefore(iter, newNode);
					break;
				}
			}
		}else{
			this.sentinel = newNode;
			newNode.next = newNode;
			newNode.prev = newNode;
		}
		return newNode;
	},
	insertSortedIffNotPresent: function(el){
		var newNode = {
			v:el,
			prev:null,
			next:null };
		if(this.sentinel){
			var iter = this.sentinel;
			while(true){
				if(this.comparator(el, iter.v)){
					if(iter.next != this.sentinel){
						iter = iter.next;
					}else{
						//couldn't be equal as this.comparator
						this.insertAfter(iter, newNode);
						break;
					}
				}else{
					if(this.comparator(el, iter.v) || this.comparator(iter.v, el)) //then they're not equal
						this.insertBefore(iter, newNode);
					break;
				}
			}
		}else{
			this.sentinel = newNode;
			newNode.next = newNode;
			newNode.prev = newNode;
		}
		return newNode;
	},
	removeIffPresent: function(el){
		var re = this.findFirstMatch(function(v){
			return !this.comparator(el, v) || !this.comparator(v, el)});
		if(re) this.removeNode(re);
	},
	pushFrontIffNotPresent: function(d, equality){
		var eq = equality || function(a,b){return a == b};
		if(!this.findFirstMatch(function(a){return eq(a, d);}))
			this.pushFront(d);
	},
	bubbleSort: function(){ //don't do this during forEaches. Like what would you even expect.
		var iter = this.sentinel;
		if(iter)
			while(iter.next != this.sentinel){
				if(!this.comparator(iter.next.v, iter.v)){//out of order, send iter.next back to where it belongs.
					this.relocateElementHeadward(iter.next);
				}
				iter = iter.next;
			}
	},
	forEach: function(f){
		if(this.isEmpty()) return;
		var v = {v:this.sentinel};
		this.iterationStack.push(v);
		do{
			var cur = v.v;
			if(v.v.next == this.sentinel) v.v = null; //null has a very special meaning: I am about to end. I can be put on track if new end nodes appear.
			f(cur);
			if(v.v) v.v = v.v.next;
		}while(v.v);
		this.iterationStack.pop();
	},
	backwardsForEach: function(f){ //NOTE. f is fed elements, not nodes. different from the other foreaches.
		var ar = this.toArray();
		for (var i = ar.length - 1; i >= 0; i--) {
			f(ar[i]);
		}
	},
	toArray: function(){
		var out = [];
		this.forEach(function(c){out.push(c.v)});
		return out;
	},
	shallowClone: function(){
		var n = new List();
		this.forEach(function(o){n.pushBack(o.v);});
		return n;
	},
	shiftElement: function(node, newValue){  //relocates a node according to the ordering(assumes thing is in the list). More efficient than removing and inserting for small shifts
		if(this.comparator(newValue, node.v)){
			node.v = newValue;
			this.relocateElementTailward(node);
		}else{
			node.v = newValue;
			this.relocateElementHeadward(node);
		}
	},
	relocateElementTailward:function(node){
		//search forward
		if(node.next != this.sentinel){
			var iter = node.next;
			//lifting out
			this.removeNode(node);
			while(true){
				if(this.comparator(iter.v, node.v)){
					//mid insertion
					this.insertBefore(iter, node);
					break;
				}else if(iter.next != this.sentinel){
					iter = iter.next;
				}else{
					//end insertion
					this.insertAfter(iter, node);
					break;
				}
			}
		}
	},
	relocateElementHeadward:function(node){
		if(node != this.sentinel){
			var iter = node.prev;
			//lifting out
			this.removeNode(node);
			while(true){
				if(this.comparator(node.v, iter.v)){
					//mid insertion
					this.insertAfter(iter, node);
					break;
				}else if(iter != this.sentinel){
					iter = iter.prev;
				}else{
					this.insertBefore(this.sentinel, node);
					break;
				}
			}
		}
	},
	resettle:function(node){
		if(node.next != this.sentinel){
			if(!this.comparator(node.v, node.next.v))
				this.relocateElementTailward(node);
		}else if(node != this.sentinel)
			if(this.comparator(node.v, node.prev.v))
				this.relocateElementHeadward(node);
	},
	pushBack: function(el){
		var newNode = {
			v:el,
			prev:null,
			next:null };
		if(this.sentinel){
			this.insertAfter(this.sentinel.prev, newNode);
		}else{
			this.sentinel = newNode;
			newNode.next = newNode;
			newNode.prev = newNode;
			this.iterationStack.forEach(function(v){
				if(v.v == null)
					v.v = newNode;
			});
		}
		return newNode;
	},
	pushFront: function(el){
		var newNode = {
			v:el,
			prev:null,
			next:null };
		if(this.sentinel){
			this.insertBefore(this.sentinel, newNode);
		}else{
			this.sentinel = newNode;
			newNode.next = newNode;
			newNode.prev = newNode;
		}
		return newNode;
	},
	toString: function(){
		var st = "{";
		if(this.sentinel){
			st += this.sentinel.v;
			var iter = this.sentinel.next;
			while(iter != this.sentinel){
				st += ", " + iter.v.toString();
				iter = iter.next;
			}
		}
		return st + "}";
	}
};


//defining our own subscribables because the standards are not broadly available and the libraries are too large.
function DataSource(value){
	this.listeners = new List();
	if(value != undefined){
		this.publish(value);
	}
}
function SubHandle(listNode, parentListeners){
	this.listNode = listNode;
	this.parentListeners = parentListeners;
}
SubHandle.prototype.listNode = null;
SubHandle.prototype.parentListeners = null;
SubHandle.prototype.unsubscribe = function(){
	if(this.listNode){
		this.parentListeners.removeNode(this.listNode);
		this.listNode = null;
	}
}
DataSource.prototype.listeners = null;
DataSource.prototype.arrived = false;
DataSource.prototype.then = function(callback){
	var listNode = this.listeners.pushBack(callback);
	return new SubHandle(listNode, this.listeners);
};
DataSource.prototype.map = function(otof){
	var ds = new DataSource();
	this.then(function(res){ds.publish(otof(res))});
	return ds;
};
DataSource.prototype.publish = function(valOfMoment){
	this.valOfMoment = valOfMoment;
	this.arrived = true;
	this.listeners.forEach(function(l){l.v(valOfMoment)});
};

//and these are basically futures.
function Awaited(){
	this.listeners = new List();
	if(arguments.length){
		this.publish(arguments[0]);
	}
}
Awaited.prototype.listeners = null;
Awaited.prototype.fail = false;
Awaited.prototype.arrived = false;
Awaited.prototype.result = null;
Awaited.prototype.note = null;
Awaited.prototype.then = function(callback, fail){ //both args optional, returns a subscription cancelation handle
	if(this.arrived){
		if(this.fail){
			fail && fail(this.note);
		}else{
			callback && callback(this.result);
		}
		return new SubHandle(null,null);
	}else{
		return new SubHandle(
			this.listeners.pushBack({succ:callback, fail:fail}),
			this.listeners);
	}
};
Awaited.prototype.chain = function(other){
	return this.then(
		function(r){other.publish(r)},
		function(note){other.ashame(note)});
};
Awaited.prototype.burden = function(other){
	return this.then(null, function(note){other.ashame(note)});
};
Awaited.prototype.share = function(other){
	return this.then(function(res){other.publish(res)});
};
Awaited.prototype.flatmap = function(otof){
	var aw = new Awaited();
	this.then(
		function(res){otof(res).chain(aw)},
		function(note){aw.ashame(note)});
	return aw;
};
Awaited.prototype.map = function(otof){
	var aw = new Awaited();
	this.then(
		function(res){aw.publish(otof(res))},
		function(note){aw.ashame(note)});
	return aw;
};
Awaited.prototype.publish = function(result){
	if(this.arrived)
		throw Error("no you shouldn't do that! An Awaited can only be received once!");
	this.result = result;
	this.arrived = true;
	this.listeners.forEach(function(l){if(l.v.succ) l.v.succ(result)});
	this.listeners = null; //free the callback closures
};
function awaitAll(){ //this and the following method can be used on datasources or awaiteds. They're variadic. If the iniput is an array it'll treat that as an argument list instead.
	var inlist = (arguments[0].constructor == Array)? arguments[0] : arguments;
	var ret = new Awaited();
	var retlist = new Array(inlist.length);
	var failed = false;
	var unarrived = inlist.length;
	if(inlist.length){
		for(var i=0; i<inlist.length; ++i){
			var pr = inlist[i];
			pr.then( (function(thisIndex){return function(r){
				if(!failed){
					if(inlist[thisIndex]){ //so that datasources can only satisfy one arrival.
						inlist[thisIndex] = null; //
						retlist[thisIndex] = r;
						if(--unarrived == 0){
							Awaited.prototype.publish.apply(ret, retlist);
						}
					}
				}
			}})(i) ,function(note){
				if(!failed){
					failed = true;
					ret.ashame(note);
				}
			});
		}
	}else{
		Awaited.prototype.publish.apply(ret, retlist);
	}
	return ret;
}
function awaitSome(){ //
	var inlist = arguments;
	var ret = new Awaited();
	for(var i=0; i<inlist.length; ++i){
		var v = inlist[i];
		v.then(function(r){
			if(!ret.arrived){
				ret.publish(r);
			}
		},function(){
			if(!ret.arrived){
				ret.fail();
			}
		});
	}
	return ret;
}
Awaited.prototype.ashame = function(note){
	if(this.arrived)
		throw Error("no you shouldn't do that! An Awaited can only resolve once!");
	this.arrived = true;
	this.note = note;
	this.fail = true;
	this.listeners.forEach(function(l){if(l.v.fail) l.v.fail(note)});
	this.listeners = null;
};

function streamMerge(){ //returns a datasource<> that fires whenever any of the inputs fire
	var inlist = arguments;
	var ret = new DataSource();
	for(var i=0; i<inlist.length; ++i){
		var v = inlist[i];
		v.then(function(){
			ret.publish();
		},function(note){
			ret.fail(note);
		});
	}
	return ret;
}

//this file is getting longer and longer..
// function liveVariable(inputs, f){ //returns a datasource that is a function of the inputs, and is updated whenever an input changes. f should be arity inputs.length, all input datasources must be initialized.
// 	var ret = new DataSource();
// 	var inputs = new Array(inputs.length);
// 	var 
// 	for(var i=0; i<inlist.length; ++i){
		
// 	}
// 	for(var i=0; i<inlist.length; ++i){
// 		var v = inlist[i];
// 		v.then((function(index){return function(through){
// 			inputs[index] = through;
// 			ret.publish(f.call(window, inputs));
// 		}})(i), function(note){
// 			ret.fail(note);
// 		});
// 	}
// 	return ret;
// }

// var a = new DataSource(2);
// var b = new DataSource(2);
// var four = liveVariable([a,b], function(a,b){return a+b});


function awaitTime(milliseconds){
	var pr = new Awaited();
	setTimeout(function(){pr.publish();}, milliseconds);
	return pr;
}

function event(element, eventName){ //returns DataSource[ev]
	var ds = new DataSource();
	element.addEventListener(eventName, function(ev){ds.publish(ev)});
	return ds;
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
					pr.ashame('json malformed. wtf, server?');
					return;
				}
				pr.publish(o);
			}else{
				pr.ashame('problem fetching json. ' + q.status + '.');
			}
		}
	};
	q.ontimeout = function(ev){
		pr.ashame('ajax query took too long. Network problem?');
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
package controllers

import play.api._
import play.api.Play.current
import play.api.mvc._
import java.nio._
import util.Random
import scala.collection.JavaConverters._
import play.api.templates._
import Enums.PathTypes._ //thence our edge type constants
import org.neo4j._
import org.neo4j.graphdb._
import org.neo4j.tooling.GlobalGraphOperations
import play.api.libs.json._
import java.lang.System.currentTimeMillis

class Position(in:Node) extends Ordered[Position]{ //in must have a realm attached to it
	val v = in
	def realm =
		new Realm(v.getSingleRelationship(IN_REALM, Direction.OUTGOING).getEndNode)
	def transfer(newRealm:Realm) ={
		v.getSingleRelationship(IN_REALM, Direction.OUTGOING).delete
		v.createRelationshipTo(newRealm.v, IN_REALM)
	}
	def compare(other:Position) =
		id compare other.id
	def title =
		v.getProperty("title", "").asInstanceOf[String]
	def title(in:String) =
		v.setProperty("title",in)
	def purge{
		for(r <- v.getRelationships(Direction.BOTH).asScala)
			r.delete
		v.delete
	}
	def timestamp:Long =
		v.getProperty("serverTimestamp").asInstanceOf[Long]
	def touch{
		v.setProperty("serverTimestamp", currentTimeMillis)
	}
	def illustration(in:String) =
		v.setProperty("illustration", in)
	def illustration =
		v.getProperty("illustration", "").asInstanceOf[String]
	def id =
		v.getProperty("id").asInstanceOf[Long]
	def backlinks:Iterator[Relationship] =
		v.getRelationships(Direction.INCOMING, TO)
			.asScala.iterator
	def refJson =
		Json.obj(
			"title" -> JsString(title),
			"id" -> JsString(id.toString) )
	def delvings:Iterator[Relationship] =
		v.getRelationships(Direction.OUTGOING, TO)
			.asScala.iterator
	def outLinkArray(rs: Iterator[Relationship]) =
		JsArray(rs.toArray.map((r:Relationship) =>{
			val onode = r.getEndNode
			Json.obj(
				"id" -> JsString(onode.getProperty("id").asInstanceOf[Long].toString),
				"title" -> (
					if(onode.hasProperty("title"))
						JsString(onode.getProperty("title").asInstanceOf[String])
					else
						JsNull ),
				"relationship" -> (
					if(r.hasProperty("relationship"))
						JsString(r.getProperty("relationship").asInstanceOf[String])
					else
						JsNull ) )}))
	def inLinkArray(rs: Iterator[Relationship]) =
		JsArray(rs.toArray.map((r:Relationship) =>{
			val onode = r.getStartNode
			Json.obj(
				"id" -> JsString(
					onode.getProperty("id").asInstanceOf[Long].toString),
				"title" -> (
					if(onode.hasProperty("title"))
						JsString(onode.getProperty("title").asInstanceOf[String])
					else
						JsNull ) ) } ))
	def json:JsObject ={
		Json.obj(
			"title" -> JsString(title),
			"id" -> JsString(id.toString),
			"serverTimestamp" -> JsString(timestamp.toString),
			"realm" -> JsString(realm.id.toString),
			"illustration" -> JsString(illustration),
			"paths" -> outLinkArray(delvings),
			"backlinks" -> inLinkArray(backlinks) )
	}
	def proximalJs = /*the json of here and the surrounding area*/
		JsArray(Array(json) ++ delvings.map(r => new Position(r.getEndNode)).toArray.sorted.map(_.json))
	def sameRealm(other:Position) =
		realm equals other.realm
	def link(other:Position) ={
		v.createRelationshipTo(other.v, TO)
	}
	def link(forwardIllustration:String)(other:Position) ={
		v.createRelationshipTo(other.v, TO)
			.setProperty("relationship", forwardIllustration)
	}
	def link(forwardIllustration:String, backIllustration:String)(other:Position) ={
		v.createRelationshipTo(other.v, TO)
			.setProperty("relationship", forwardIllustration)
		other.v.createRelationshipTo(v, TO)
			.setProperty("relationship", backIllustration)
	}
	def getLinkTo(other:Position):Option[Relationship] ={
		for(r <- v.getRelationships(Direction.OUTGOING, TO).asScala){
			if(r.getEndNode.getId == other.v.getId)
				return Some(r)
		}
		None
	}
}

object User{
	def createOrGet(email:String):User ={
		Global.lookUpNode(Global.userLabel, "email", email) match {
			case None =>{
				val node = Global.db createNode Global.userLabel
				node.setProperty("email", email)
				node.setProperty("id", Global.takeCount("newestUserId"))
				val user = new User(node)
				val firstIdentity = Identity.generateNew(user)
				user
			}
			case Some(node) => new User(node)
		}
	}
}
class User(node:Node){
	val v = node
	def id:Long =
		v.getProperty("id").asInstanceOf[Long]
	def email:String = 
		v.getProperty("email").asInstanceOf[String]
	def identities:Iterator[Identity] =
		v.getRelationships(Direction.OUTGOING, IDENTIFIES)
			.asScala.iterator.map(r => new Identity(r.getEndNode))
	def unstar(pos:Position):Unit =
		Global.findConnection(v, pos.v, Direction.OUTGOING, REMEMBERS)
			.map((r:Relationship) => r.delete)
	def star(pos:Position):Unit ={
		if(!Global.areConnected(v, pos.v, Direction.OUTGOING, REMEMBERS))
			v.createRelationshipTo(pos.v, REMEMBERS)
	}
	def rememberry:Iterator[Position] =
		v.getRelationships(Direction.OUTGOING, REMEMBERS)
			.asScala.iterator.map(r => new Position(r.getEndNode))
	def json(token: Long):JsObject ={
		JsObject(
			"email" -> JsString(email) ::
			"id" -> JsNumber(id) ::
			"token" -> JsString(token.toString) ::
			"identities" -> JsArray(identities.toArray.sorted.map(_.json)) ::
			"rememberry" -> JsArray(rememberry.toArray.sorted.map(_.refJson)) ::
		Nil)
	}
}

object Realm{
	def create(name:String):Realm = {
		val n = Global.db.createNode(Global.realmLabel)
		n.setProperty("title", name)
		n.setProperty("id", Global.takeCount("newestRealmId"))
		new Realm(n)
	}
}
class Realm(node:Node) extends Ordered[Realm]{
	val v = node
	def title =
		v.getProperty("title").asInstanceOf[String]
	def equals(other:Realm) =
		v.getId == other.v.getId
	def id =
		v.getProperty("id").asInstanceOf[Long]
	def compare(other:Realm) =
		id compare other.id
	def hasFigure(id: Identity):Boolean ={
		for(r <- v.getRelationships(Direction.INCOMING, MANIFESTS).asScala){
			if(r.getStartNode.getId == id.v.getId)
				return true
		}
		false
	}
	def induct(ident: Identity):Unit ={
		if(id != Global.freeRealm && !hasFigure(ident))
			ident.v.createRelationshipTo(v, MANIFESTS)
	}
	def pantheon:Iterable[Identity] =
		v.getRelationships(Direction.INCOMING, MANIFESTS).asScala
			.map((r:Relationship) => new Identity(r.getStartNode))
	def json =
		Json.obj(
			"id" -> JsString(id.toString),
			"title" -> JsString(title),
			"pantheon" -> JsArray((pantheon.map((g:Identity) => g.json)).toSeq) )
}

object Identity{
	val namer:nameDiviner = new nameDiviner(new Random())
	def generateNew(user:User, name:String):Identity ={
		val n = Global.db.createNode(Global.identityLabel)
		user.v createRelationshipTo(n, IDENTIFIES)
		n.setProperty("id", Global.takeCount("newestIdentityId").asInstanceOf[Long])
		n.setProperty("name", name)
		new Identity(n)
	}
	def generateNew(user:User):Identity =
		generateNew(user, namer())
}
class Identity(node:Node) extends Ordered[Identity]{
	val v = node
	def id:Long =
		v.getProperty("id").asInstanceOf[Long]
	def name:String =
		v.getProperty("name").asInstanceOf[String]
	def name(newName:String):Unit =
		v.setProperty("name", newName)
	def compare(other:Identity) =
		id compare other.id
	def user:User =
		new User(v.getSingleRelationship(IDENTIFIES, Direction.INCOMING).getStartNode)
	def realms:Iterable[Node] =
		v.getRelationships(Direction.OUTGOING, MANIFESTS).asScala.map(_.getEndNode)
	def realmIds:Iterator[Long] =
		realms.iterator.map(_.getProperty("id").asInstanceOf[Long])
	def json:JsObject =
		Json.obj(
			"name" -> JsString(name),
			"id" -> JsString(id.toString),
			"realms" -> JsArray(realmIds.toArray.sorted.map(l => JsString(l.toString))) )
	def manifests(r:Realm):Boolean =
		r.id == Global.freeRealm /*the seventh realm is Free, The Babel*/ || r.hasFigure(this)
	def manifests(p:Position):Boolean =
		manifests(p.realm)
}


object Global extends GlobalSettings{
	val dbLocation = "grandMoment/db/"
	//edge types are kept in Enum.java
	//node labels
	val realmLabel = DynamicLabel label "Realm"
	val positionLabel = DynamicLabel label "Position"
	val gsLabel = DynamicLabel label "GlobalStore"
	val userLabel = DynamicLabel label "User"
	val pantheonLabel = DynamicLabel label "Pantheon"
	val identityLabel = DynamicLabel label "Identity"
	def takeCount(property:String):Long ={
		val next = globalBean.getProperty(property).asInstanceOf[Long] + 1
		globalBean.setProperty(property, next)
		next
	}
	def instateNewPosition(realm:Node, title:String, illustration:String):Position = {
		val node = dbs createNode positionLabel
		node.createRelationshipTo(realm, IN_REALM)
		node.setProperty("title", title)
		node.setProperty("id", takeCount("newestPositionId"))
		node.setProperty("illustration", illustration)
		node.setProperty("serverTimestamp", currentTimeMillis)
		new Position(node)
	}
	def instateNewPosition(realm:Node):Position = {
		val node = dbs createNode positionLabel
		node.setProperty("id", takeCount("newestPositionId"))
		node.setProperty("serverTimestamp", currentTimeMillis)
		node.createRelationshipTo(realm, IN_REALM)
		new Position(node)
	}
	def transact[A](action: =>A):A = {
		val tx = dbs.beginTx
		try{
			val ret = action
			tx.success
			ret
		}finally{
			tx.close
		}
	}
	lazy val secret:Long ={
		val apsec = Play.application.configuration.getString("application.secret").get.getBytes
		val longArrLength = (apsec.length/8 + {if(apsec.length%8 > 0) 1 else 0})
		val bb = ByteBuffer.wrap(apsec)
		val la = new Array[Long](longArrLength)
		// println(apsec.length +" "+ longArrLength)
		bb.asLongBuffer.get(la)
		la.foldRight(0l)((l,r) => (l+r)^(l*r))
	}
	var domain:String = null
	val placeNameRegexString = "[a-zA-Z0-9]+"
	val placeName = placeNameRegexString.r
	var globalBean:Node = null
	val freeNexus:Long = 94l
	val freeRealm:Long = 7l
	private var defaultPosition: Position = null
	private var voidPosition: Position = null
	private var dbs: GraphDatabaseService = null
	var voidJson:JsObject = null;
	def db = dbs
	var hasher:SaltFlatLoper = null
	def currentTimeSegment = currentTimeMillis/(1000*60*60*24)
	val maxAge = 5 //so, basically, a key will be accepted if it's within 6(valid() is inclined to go one extra) segments[6 days] of the current time
	def authorizationKey(id:Long, time:Long):Long =
		Global.hasher(431861l*id + time) //TODO, use a real large prime
	def authorizationKey(id:Long):Long =
		authorizationKey(id, currentTimeSegment)
	def authorizationKey(u:User):Long =
		authorizationKey(u.id.asInstanceOf[Long])
	def valid(user:User, token:String):Boolean =
		valid(user.id.asInstanceOf[Long], java.lang.Long.parseLong(token))
	def valid(userid:Long, token:Long):Boolean ={
		val currentTime = currentTimeSegment
		def matchesOlder(i:Int):Boolean =
			if(token == authorizationKey(userid, currentTime - i))
				true
			else if(i > maxAge)
				false
			else
				matchesOlder(i+1)
		matchesOlder(0)
	}
	def defaultHtml :Html = views.html.grandMoment()
	def lookUpNode(label:Label, feild:String, value:Any):Option[Node] = {
		val resultsiter =
			dbs.findNodesByLabelAndProperty(label, feild, value)
				.iterator
		if(resultsiter hasNext)
			Some(resultsiter next)
		else
			None
	}
	def findConnection(lessGregariousNode:Node, moreGregariousNode:Node, dirFromLess:Direction, pathType:Enums.PathTypes):Option[Relationship] ={
		for(r <- lessGregariousNode.getRelationships(dirFromLess, pathType).asScala){
			if(r.getOtherNode(lessGregariousNode).getId == moreGregariousNode.getId)
				return Some(r)
		}
		None
	}
	def areConnected(lessGregariousNode:Node, moreGregariousNode:Node, dirFromLess:Direction, pathType:Enums.PathTypes):Boolean ={
		for(r <- lessGregariousNode.getRelationships(dirFromLess, pathType).asScala){
			if(r.getOtherNode(lessGregariousNode).getId == moreGregariousNode.getId)
				return true
		}
		false
	}
	def purge(n:Node):Unit ={
		for(c <- n.getRelationships.asScala)
			c.delete
		n.delete
	}
	def getIdentity(id:Long):Option[Identity] =
		lookUpNode(identityLabel, "id", id).map(new Identity(_))
	def getPosition(placeSpecifier:Long): Option[Position] = {
		lookUpNode(positionLabel, "id", placeSpecifier).map(new Position(_))
	}
	def getRealm(realmId:String): Option[Realm] = {
		lookUpNode(realmLabel, "name", realmId).map(new Realm(_))
	}
	def getRealm(realmId:Long): Option[Realm] = {
		lookUpNode(realmLabel, "id", realmId).map(new Realm(_))
	}
	
	override def onStart(app: Application){
		dbs = new factory.GraphDatabaseFactory() newEmbeddedDatabase dbLocation
		hasher = new SaltFlatLoper(secret)
		domain = Play.application.configuration.getString("application.domain").get
		
		if( transact{ /*checks whether the db has been initialized*/
			GlobalGraphOperations.at(dbs).getAllNodesWithLabel(gsLabel).iterator.hasNext
		} ){
			println("preexisting database found, loaded.")
		}else{
			println("database not found, initializing a new db.")
			transact {
				var schema = dbs.schema
				schema.indexFor(realmLabel).on("id").create
				schema.indexFor(realmLabel).on("name").create
				schema.indexFor(positionLabel).on("id").create
				schema.indexFor(identityLabel).on("id").create
				schema.indexFor(userLabel).on("id").create
				schema.indexFor(userLabel).on("email").create
			}
			transact {
				var gb = dbs createNode gsLabel
				gb.setProperty("newestUserId", 0l)
				gb.setProperty("newestIdentityId", 0l)
				gb.setProperty("newestRealmId", 1l)
				gb.setProperty("newestPositionId", 1l)
				
				val void = dbs createNode realmLabel
				void setProperty("title", "The Void")
				void setProperty("id", 0l)
				val nullPosition = dbs createNode positionLabel
				nullPosition.setProperty("title", "Nowhere")
				nullPosition.setProperty("id", 0l)
				nullPosition.setProperty("illustration", "<p>There is nothing here.</p>")
				nullPosition.setProperty("serverTimestamp", currentTimeMillis)
				nullPosition.createRelationshipTo(void, IN_REALM);
				
				val city = dbs createNode realmLabel
				city setProperty("title", "Manifold City")
				city setProperty("id", 1l)
				val manCity = dbs createNode positionLabel
				manCity.setProperty("title", "The Crook")
				manCity.setProperty("id", 1l)
				manCity.setProperty("illustration", "<p>The city hums to the resonant frequency of the interleaved waxed dreams of the manifold exuberant gods who slumber in every nook.</p>")
				manCity.setProperty("serverTimestamp", currentTimeMillis)
				manCity.createRelationshipTo(city, IN_REALM);
				
				val aleph = dbs createNode userLabel
				aleph setProperty("email", "marcus.yass@gmail.com")
				aleph setProperty("id", 0l)
				val mako = dbs createNode identityLabel
				mako setProperty("name", "mako")
				mako setProperty("id", 0l)
				aleph createRelationshipTo(mako, IDENTIFIES)
				
				mako.createRelationshipTo(city, MANIFESTS)
			}
		}
		transact{
			globalBean = 
				GlobalGraphOperations.at(dbs).getAllNodesWithLabel(gsLabel).iterator.next
			voidPosition = 
				new Position(dbs.findNodesByLabelAndProperty(positionLabel, "id", 0l).iterator.next)
			voidJson =
				new Realm(dbs.findNodesByLabelAndProperty(realmLabel, "id", 0l).iterator.next).json
			defaultPosition = 
				new Position(dbs.findNodesByLabelAndProperty(positionLabel, "id", 47l).iterator.next)
		}
	}
	override def onStop(app: Application){
		if(dbs != null) dbs.shutdown()
	}
}
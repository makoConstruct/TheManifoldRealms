package controllers

import play.api._
import play.api.mvc._
import org.neo4j._
import org.neo4j.graphdb._
import Enums.PathTypes._
import org.owasp.html._
import play.api.libs.json._
import play.api.libs.ws._
import play.api.libs.concurrent.Execution.Implicits._
import java.lang.System.currentTimeMillis

import Global.transact

object Application extends Controller {
	
	def main = Action {
		Ok(Global.defaultHtml)}
	def pageFor(l:Long) = Action { //ignore l, let the client ask for what it wants.
		Ok(Global.defaultHtml)}
	
	def domainData(placeSpecifier:Long) = Action{ //throws back jsons for that position and everything surrounding it.
		Global.transact{
			Global getPosition placeSpecifier match{
				case Some(pos) => Ok(Json.stringify(pos proximalJs))
				case None => NotFound
			}
		}
	}
	
	def positionData(placeSpecifier:Long) = Action{
		Global.transact{
			Global getPosition placeSpecifier match{
				case Some(pos) => Ok(Json.stringify(pos.json))
				case None => NotFound
			}
		}
	}
	
	def realmData(realmId:Long) = Action{
		Global.transact{
			Global getRealm realmId match{
				case Some(realm) => Ok(realm.json)
				case None => NotFound
			}
		}
	}
	
	val sanitizer =
		(Sanitizers.BLOCKS and Sanitizers.FORMATTING and Sanitizers.LINKS and Sanitizers.STYLES)
	// private def sanitize[T](str:String, good: String=>T, bad: =>T):T ={
	// 	if(str.length > 1000){
	// 		bad
	// 	else
	// 		good(sanitize.sanitize(str))
	// }
	def sanitize(v:String) = sanitizer.sanitize(v)
	private trait Report{
		def isShiny:Boolean
		def toJson:JsObject
	}
	private class Shiny(args: Pair[String, String]*) extends Report{
		def isShiny = true
		def toJson = JsObject(
			args.map( pair => (pair._1, JsString(pair._2)) ) :+
			"status" -> JsString("shiny") )
	}
	private class BadReport(detail:String) extends Report{
		def isShiny = false
		def toJson = JsObject(
			"status" -> JsString("no") ::
			"detail" -> JsString(detail) ::
		Nil)
	}
	private class NeedMoreGodhood(worldConcerned:String) extends Report{
		def isShiny = false
		def toJson = JsObject(
			"status" -> JsString("no") ::
			"detail" -> JsString("insufficient identity privilages") ::
			"worldConcerned" -> JsString(worldConcerned) ::
		Nil)
	}
	private object shiny extends Report{
		def isShiny = true
		def toJson = JsObject("status" -> JsString("shiny") :: Nil)
	}
	
	private def longFromJsString(jv: JsValue) = java.lang.Long.parseLong(jv.as[String])
	
	
	private def doTransactions(ident: Identity, op:JsObject):Report ={ //returns the report of the final op, or the report of the breaking op. Should revise all db ops issued prior to a breaking op.
		val seq = (op \ "ops").as[Seq[JsObject]]
		if(seq.isEmpty){
			shiny
		}else{
			var res:Report = null
			for(o <- seq){
				val opname = (o \ "opname").as[String]
				res = transact{ opname match {
					case "destroy" =>
						destroyPosition(ident, o)
					case "create" =>
						createPosition(ident, o)
					case "edit" =>
						editPosition(ident, o)
					case "link" =>
						createLink(ident, o)
					case "unlink" =>
						deleteLink(ident, o)
					case "transfer" =>
						movePosition(ident, o)
					case "induct" =>
						induct(ident, o)
					case "remember" =>
						remember(ident, o)
					case "forget" =>
						forget(ident, o)
					case "foundRealm" =>
						foundRealm(ident, o)
					case "idname" =>
						changeName(ident, o)
					case "createidentity" =>
						createIdentity(ident, o)
					case _ =>
						new BadReport("unsupported operation")
				}}
				if(!res.isShiny)
					return res
			}
			res
		}
	}
	
	private def destroyPosition(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "posId")) match{
			case Some(pos) =>
				if(ident manifests pos){
					pos.purge
					shiny
				}else
					new NeedMoreGodhood(pos.title)
			case None =>
				new BadReport("no such position")
		}
	}
	
	private def createLink(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "srcWorldId")) match {
			case Some(sw) =>{
				if(sw.id == Global.freeNexus /*anyone can make links from the babel origin*/ || (ident manifests sw))
					Global.getPosition(longFromJsString(op \ "dstWorldId")) match{
						case Some(dw) =>{
							sw getLinkTo dw match{
								case Some(rel) =>
									(op \ "illustration").asOpt[String] match {
										case Some(str) =>
											rel.setProperty("relationship", sanitizer.sanitize(str))
										case None => Unit
									}
								case None =>
									(op \ "illustration").asOpt[String] match {
										case Some(str) =>
											sw.link(sanitizer.sanitize(str))(dw)
										case None =>
											sw.link(dw)
									}
							}
							sw.touch
							shiny
						}
						case None => new BadReport("dst position does not exist")
					}
				else
					new NeedMoreGodhood(sw.title)
			}
			case None => new BadReport("src position does not exist")
		}
	}
	
	// private def createAndLinkTo(ident:Identity, op:JsObject):Report ={
	// 	Global.getRealm(longFromJsString(op \ "realmId")) match{
	// 		case Some(realm) =>{
	// 			if(ident manifests realm){
	// 				val npos = Global.instateNewPosition(realm.v)
	// 				Global.getPosition(longFromJsString(op \ "srcLinkingId")) match {
	// 					case Some(from) => {
	// 						val fromRealm = from.realm
	// 						if(realm.id == fromRealm.id || (ident manifests fromRealm)){
	// 							(op \ "relationship").asOpt[String] match{
	// 								case Some(relstr) =>
	// 									from.link(relstr)(npos)
	// 								case None =>
	// 									from.link(npos)
	// 							}
	// 							new Shiny("posId" -> npos.id.toString)
	// 						}else
	// 							new NeedMoreGodhood(from.title)
	// 					}
	// 					case None =>
	// 						new BadReport("linking from position that does not exist")
	// 				}
	// 			}else{
	// 				new NeedMoreGodhood(realm.title)
	// 			}
	// 		}
	// 		case None => new BadReport("no such realm")
	// 	}
	// }
	
	private def createIdentity(ident:Identity, op:JsObject):Report ={
		val user = ident.user
		val id = (op \ "name").asOpt[String] match {
			case Some(name) =>
				Identity.generateNew(user, name)
			case None =>
				Identity.generateNew(user)
		}
		new Shiny("id" -> id.id.toString, "name" -> id.name)
	}
	
	private def remember(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "posId")) match {
			case Some(pos) =>{
				ident.user star pos
				shiny
			}
			case None => new BadReport("that position does not exist")
		}
	}
	
	private def forget(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "posId")) match {
			case Some(pos) => {
				ident.user unstar pos
				shiny
			}
			case None => new BadReport("that position does not exist")
		}
	}
	
	private def deleteLink(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "srcWorldId")) match {
			case Some(sw) =>{
				if((ident manifests sw) || sw.id == Global.freeNexus)
					Global.getPosition(longFromJsString(op \ "dstWorldId")) match{
						case Some(dw) =>{
							sw getLinkTo dw match{
								case Some(rel) =>
									rel.delete
								case None => Unit
							}
							sw.touch
							shiny
						}
						case None => new BadReport("dst position does not exist")
					}
				else
					new NeedMoreGodhood(sw.title)
			}
			case None => new BadReport("src position does not exist")
		}
	}
	
	private def movePosition(ident:Identity, op:JsObject):Report ={
		Global.getPosition(longFromJsString(op \ "posId")) match {
			case Some(pos) =>{
				if(ident manifests pos)
					Global.getRealm(longFromJsString(op \ "newRealmId")) match{
						case Some(newRealm) =>
							if(ident manifests newRealm){
								pos transfer newRealm
								shiny
							}else
								new NeedMoreGodhood(newRealm.title)
						case None =>
							new BadReport("target realm does not exist")
					}
				else
					new NeedMoreGodhood(pos.title)
			}
			case None =>
				new BadReport("object position does not exist")
		}
	}
	
	private def createPosition(ident:Identity, op:JsObject):Report ={
		Global.getRealm(longFromJsString(op \ "realmId")) match{
			case Some(realm) =>{
				if(ident manifests realm){
					val npos = Global.instateNewPosition(realm.v)
					new Shiny("posId" -> npos.id.toString)
				}else{
					new NeedMoreGodhood(realm.title)
				}
			}
			case None => new BadReport("no such realm")
		}
	}
	
	private def induct(ident:Identity, op:JsObject):Report ={
		Global.getRealm(longFromJsString(op \ "realmId")) match{
			case Some(realm) =>
				if(ident manifests realm)
					Global.getIdentity(longFromJsString(op \ "subject")) match{
						case Some(id) =>{
							realm induct id
							shiny
						}
						case None =>
							new BadReport("inductee does not exist")
					}
				else
					new BadReport("insufficient identity privilages")
			case None => new BadReport("referenced realm does not exist")
		}
	}
	
	private def changeName(ident:Identity, op:JsObject):Report ={
		val asking = (op \ "newName").as[String]
		if(asking.length < 37){
			ident name asking
			shiny
		}else
			new BadReport("that name is too long")
	}
	
	private def foundRealm(ident:Identity, op:JsObject):Report ={
		val realmn = (op \ "realmName").asOpt[String] match {
			case Some(rn) => rn
			case None => Identity.namer()
		}
		if(realmn.length > 100){
			new BadReport("realm name too long")
		}else{
			Global.getRealm(realmn) match{
				case Some(realm) =>
					new BadReport("A realm by that name already exists")
				case None =>{
					val realm = Realm.create(realmn)
					realm induct ident
					new Shiny("realmId" -> realm.id.toString)
				}
			}
		}
	}
	
	private def editPosition(ident:Identity, op:JsObject):Report ={
		val id = longFromJsString(op \ "posId")
		Global.getPosition(id) match {
			case Some(place) => {
				if(ident manifests place){
					place.touch
					val seq = (op \ "properties").as[Seq[JsValue]]
					if(seq.isEmpty)
						shiny
					else{
						var ret:Report = null
						for(o <- seq){
							ret = (o \ "property").as[String] match {
								case "illustration" => {
									place illustration sanitize((o \ "val").as[String])
									shiny
								}
								case "title" => {
									place title (o \ "val").as[String]
									shiny
								}
								case "link" => {
									Global.getPosition(longFromJsString(o \ "dst")) match {
										case Some(near) =>
											Global.findConnection(place.v, near.v, Direction.OUTGOING, TO) match{
												case Some(r) => {
													r.setProperty("relationship", sanitize((o \ "illustration").as[String]))
													shiny
												}
												case None => new BadReport("there is no link to that position from here")
											}
										case None => new BadReport("the terminus of your link edit does not exist")
									}
								}
								case _ => new BadReport("edit property specified is not recognized")
							}
							if(!ret.isShiny){
								return ret
							}
						}
						ret
					}
				}else{
					new NeedMoreGodhood(place.title)
				}
			}
			case None => {
				new BadReport("position doesn't exist")
			}
		}
	}
	
	def actionActions = Action(parse.json){ request =>
		Ok(try{
			val o = request.body.as[JsObject]
			val res = Global.transact{
				Global.getIdentity(longFromJsString(o \ "identity"))
			} match {
				case Some(ident) =>{
					if(Global.transact{ Global.valid(
							ident.user.id.asInstanceOf[Long],
							longFromJsString(o \ "authorizationKey")
					)}){
						doTransactions(ident, o)
					}else{
						new BadReport("authorization key expired")
					}
				}
				case None => new BadReport("invalid identity number")
			}
			res.toJson
		}catch{
			case JsResultException(error) => new BadReport("arg. Syntax error at " + error).toJson
		})
	}
	
	def login = Action.async(parse.text){ request => {
		WS.url("https://verifier.login.persona.org/verify")
			.withQueryString(
				"assertion" -> request.body,
				"audience" -> Global.domain)
			.post("")
			.map( response => {
				val o = response.json
				var status = (o \ "status").as[String]
				if(status equals "okay"){
					Ok(Global.transact{
						//get user data
						val email = (o \ "email").as[String]
						val user = User.createOrGet(email)
						//send back user data and session key
						JsObject(
							"status" -> JsString("shiny") ::
							"user" -> user.json(Global.authorizationKey(user.id.asInstanceOf[Long])) ::
						Nil)
					})
				}else{
					Ok(JsObject(
						"status" -> JsString("no") ::
						"detail" -> JsString("BrowserID assertion failed") ::
						"mozilla response" -> o ::
					Nil))
				}	
			})
	}}
	
	def tokenLogin = Action(parse.json){ request => {
		val o = request.body.as[JsObject]
		transact{
			val user =  User createOrGet (o \ "email").as[String]
			val userid = user.id
			val token = longFromJsString(o \ "authorizationKey")
			if(Global.valid(userid, token)){
				Ok(user.json(token))
			}else{
				NotAcceptable
			}
		}
	}}
}

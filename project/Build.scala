import sbt._
import Keys._
import play.Project._

object ApplicationBuild extends Build {

		val appName         = "grandMoment"
		val appVersion      = "1.0-SNAPSHOT"

		val appDependencies = Seq(
			// Add your project dependencies here,
			"org.neo4j" % "neo4j" % "2.0.3",
			"com.googlecode.owasp-java-html-sanitizer" % "owasp-java-html-sanitizer" % "[r136,)"
			// "redis.clients" % "jedis" % "2.2.0"
			// "org.pegdown" % "pegdown" % "1.4.2"
		)

		val main = play.Project(appName, appVersion, appDependencies).settings(
			// publishTo := Some(
			//   "SylphSpinner" at "http://makopool.com/mavenrepo"
			// ),
			
			// credentials += Credentials(
			//   "Repo", "http://makopool.com/mavenrepo", "admin", "admin123"
			// )
		)

}

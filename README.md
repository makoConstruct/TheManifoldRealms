##This is The Manifold Realms

A vast and detailed net of interconnected scenes. [Explore](http://themanifoldrealms.makopool.com).


###building

* install playframework

* initialize the play application in the project's directory

* add `application.domain="http://<your domain>"` to conf/application.conf to allow persona to work. This must be exactly as it is when seen in a user's browser. We cannot supply a conf file for you, as this contains the core secret from which all secrets stem.

* ask me to add the files I inevitably forgot to add to the index.

* `play run`, and visit localhost:9000 to see it run.

* logins fail, because your url does not match the one provided in the configuration. This violates the persona protocol. You may wish to change the domain parameter for testing.

###deploying

* Remember to change the domain configuration parameter back.

* `play dist` will produce a standalone package, which can be started by running `./bin/grandmoment`. Running from the bin directory, mysteriously, causes an exception in neo4j's initialization routines.

* after the first deploy, you wont want to keep pushing standalones. The key jar to update most of the time is `target/scala-2.10/grandmoment_2.10-1.0-SNAPSHOT.jar`. This should be copied into `~/<deploy directory>/lib/grandmoment.grandmoment-1.0-SNAPSHOT.jar`. This is a very hairy solution but it's the best we've got while we're not doing a source deployment.

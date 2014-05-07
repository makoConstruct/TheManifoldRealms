package controllers;

public class Enums{
	public enum PathTypes implements org.neo4j.graphdb.RelationshipType{
		TO, IN_REALM, IDENTIFIES, MANIFESTS, REMEMBERS
	}
}
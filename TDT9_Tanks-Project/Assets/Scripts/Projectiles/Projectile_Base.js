#pragma strict

var myExplosion : GameObject;
var myTarget : Transform;
var myRange : float = 10;
var mySpeed : float = 10;
var myDamageAmount : float = 25;
var myDist : float;

function OnTriggerEnter(other : Collider)
{
	if(other.gameObject.tag == "Air Enemy" || other.gameObject.tag == "Ground Enemy")
	{
		Explode();
		other.gameObject.SendMessage("TakeDamage", myDamageAmount, SendMessageOptions.DontRequireReceiver);
	}
}

function Explode()
{
	Instantiate(myExplosion, transform.position, Quaternion.identity);
	Destroy(gameObject);
}